import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface MinimaxResponse {
  data?: { audio?: string; status?: number }
  extra_info?: { music_duration?: number }
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'http://host.docker.internal:54321'
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')

  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // 1. Claim one pending task
  const { data: task, error: claimError } = await supabase
    .rpc('claim_pending_task', { task_type: 'music' })

  if (claimError || !task || !task.id) {
    return new Response(
      JSON.stringify({ processed: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const minimaxApiKey = Deno.env.get('MINIMAX_API_KEY')
  if (!minimaxApiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing MINIMAX_API_KEY', task_id: task.id }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const payload = task.payload as {
      prompt: string
      genre?: string | null
      mood?: string | null
      mode: string
      lyric_id?: string | null
      language?: string | null
    }

    // 2. Build Minimax request
    const minimaxBody: Record<string, unknown> = {
      model: 'music-2.6',
      output_format: 'url',
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    }

    const promptParts: string[] = []
    if (payload.language) {
      const langMap: Record<string, string> = { zh: '中文', en: '英文', ja: '日文' }
      if (langMap[payload.language]) promptParts.push(langMap[payload.language])
    }
    promptParts.push(payload.prompt)
    if (payload.genre) promptParts.push(`风格：${payload.genre}`)
    if (payload.mood) promptParts.push(`情绪：${payload.mood}`)

    minimaxBody.prompt = promptParts.join('，')

    if (payload.mode === 'instrumental') {
      minimaxBody.is_instrumental = true
    } else if (payload.mode === 'auto_lyrics') {
      minimaxBody.lyrics_optimizer = true
    } else if (payload.mode === 'existing_lyric' && payload.lyric_id) {
      const { data: lyric } = await supabase
        .from('lyrics')
        .select('content')
        .eq('id', payload.lyric_id)
        .single()
      if (lyric?.content) minimaxBody.lyrics = lyric.content
    }

    // 3. Call Minimax API
    const minimaxRes = await fetch('https://api.minimax.chat/v1/music_generation', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(minimaxBody),
    })

    if (!minimaxRes.ok) {
      throw new Error(`Minimax API error: ${minimaxRes.status}`)
    }

    const minimaxData = (await minimaxRes.json()) as MinimaxResponse
    const audioUrl = minimaxData.data?.audio
    const durationMs = minimaxData.extra_info?.music_duration ?? 0
    const durationSeconds = Math.round(durationMs / 1000)

    if (!audioUrl) {
      throw new Error('Minimax response missing audio URL')
    }

    // 4. Download audio
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) throw new Error('Failed to download audio')
    const audioBuffer = await audioRes.arrayBuffer()

    // 5. Upload to Storage
    const filePath = `${task.user_id}/${task.song_id}/${Date.now()}.mp3`
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filePath, audioBuffer, { contentType: 'audio/mpeg' })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    // 6. Get public URL
    const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(filePath)

    // 7. Mark task completed
    await supabase
      .from('generation_tasks')
      .update({
        status: 'completed',
        result: {
          audio_url: publicUrl.publicUrl,
          file_path: filePath,
          duration: durationSeconds,
        },
        completed_at: new Date().toISOString(),
      })
      .eq('id', task.id)

    return new Response(
      JSON.stringify({ processed: 1, task_id: task.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const retryCount = (task.retry_count ?? 0) + 1

    if (retryCount >= task.max_retries) {
      await supabase
        .from('generation_tasks')
        .update({
          status: 'failed',
          retry_count: retryCount,
          error_message: message,
        })
        .eq('id', task.id)
    } else {
      const delaySeconds = retryCount === 1 ? 0 : retryCount === 2 ? 30 : 60
      const retryAt = new Date(Date.now() + delaySeconds * 1000)

      await supabase
        .from('generation_tasks')
        .update({
          status: 'pending',
          retry_count: retryCount,
          error_message: message,
          created_at: retryAt.toISOString(),
        })
        .eq('id', task.id)
    }

    return new Response(
      JSON.stringify({ processed: 0, error: message, task_id: task.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
