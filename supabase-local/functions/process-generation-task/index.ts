import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface MinimaxResponse {
  data?: { audio?: string; status?: number }
  extra_info?: { music_duration?: number }
}

interface MinimaxImageResponse {
  data?: { image?: { url?: string }; image_urls?: string[] }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`${label} timed out after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

function buildCoverPrompt(
  type: 'album' | 'song',
  data: {
    title: string
    description?: string | null
    genre?: string | null
    mood?: string | null
  }
): string {
  if (type === 'album') {
    return data.description
      ? `专辑: ${data.title}。${data.description}`
      : `专辑: ${data.title}`
  }
  const parts = [`歌曲: ${data.title}`]
  if (data.genre) parts.push(`风格：${data.genre}`)
  if (data.mood) parts.push(`情绪：${data.mood}`)
  return parts.join('，')
}

async function downloadImage(url: string, timeoutMs: number): Promise<ArrayBuffer> {
  const res = await fetchWithTimeout(url, {}, timeoutMs, 'Image download')
  if (!res.ok) {
    throw new Error('Failed to download generated image')
  }
  return res.arrayBuffer()
}

async function uploadToCovers(
  supabase: any,
  filePath: string,
  buffer: ArrayBuffer
): Promise<string> {
  const { error } = await supabase.storage
    .from('covers')
    .upload(filePath, buffer, { contentType: 'image/png' })
  if (error) throw new Error(error.message || 'Storage upload failed')
  const { data } = supabase.storage.from('covers').getPublicUrl(filePath)
  return data.publicUrl
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'http://host.docker.internal:54321'
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')

  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Try to claim a task in priority order: music, cover, album_cover
  const taskTypes = ['music', 'cover', 'album_cover']
  let task: any = null

  for (const taskType of taskTypes) {
    const { data: claimed, error: claimError } = await supabase
      .rpc('claim_pending_task', { task_type: taskType })

    if (!claimError && claimed && claimed.id) {
      task = claimed
      break
    }
  }

  if (!task) {
    return new Response(
      JSON.stringify({ processed: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const minimaxApiKey = Deno.env.get('MINIMAX_API_KEY')
    if (!minimaxApiKey) {
      throw new Error('Missing MINIMAX_API_KEY')
    }
    const minimaxBaseUrl = (Deno.env.get('MINIMAX_BASE_URL') ?? 'https://api.minimaxi.com').replace(/\/+$/, '')
    const minimaxTimeoutMs = Number(Deno.env.get('MINIMAX_TIMEOUT_MS') ?? '120000')
    const assetDownloadTimeoutMs = Number(Deno.env.get('ASSET_DOWNLOAD_TIMEOUT_MS') ?? '60000')

    // ── MUSIC GENERATION ──
    if (task.type === 'music') {
      const payload = task.payload as {
        prompt: string
        genre?: string | null
        mood?: string | null
        mode: string
        lyric_id?: string | null
        language?: string | null
      }

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

      const minimaxRes = await fetchWithTimeout(
        `${minimaxBaseUrl}/v1/music_generation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${minimaxApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(minimaxBody),
        },
        minimaxTimeoutMs,
        'Minimax music generation'
      )

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

      const audioRes = await fetchWithTimeout(audioUrl, {}, assetDownloadTimeoutMs, 'Audio download')
      if (!audioRes.ok) throw new Error('Failed to download audio')
      const audioBuffer = await audioRes.arrayBuffer()

      const filePath = `${task.user_id}/${task.song_id}/${Date.now()}.mp3`
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filePath, audioBuffer, { contentType: 'audio/mpeg' })

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(filePath)

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
        JSON.stringify({ processed: 1, task_id: task.id, type: 'music' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── COVER GENERATION (song or album) ──
    if (task.type === 'cover' || task.type === 'album_cover') {
      const payload = task.payload as {
        prompt: string
        title: string
        description?: string | null
        genre?: string | null
        mood?: string | null
      }

      const entityType = task.type === 'album_cover' ? 'album' : 'song'
      const prompt = buildCoverPrompt(entityType, {
        title: payload.title,
        description: payload.description,
        genre: payload.genre,
        mood: payload.mood,
      })

      const minimaxRes = await fetchWithTimeout(
        `${minimaxBaseUrl}/v1/image_generation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${minimaxApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'image-01',
            prompt,
            aspect_ratio: '1:1',
            response_format: 'url',
            n: 1,
          }),
        },
        minimaxTimeoutMs,
        'Minimax image generation'
      )

      if (!minimaxRes.ok) {
        throw new Error(`Minimax image API error: ${minimaxRes.status}`)
      }

      const minimaxData = (await minimaxRes.json()) as MinimaxImageResponse
      const imageUrl = minimaxData.data?.image?.url ?? minimaxData.data?.image_urls?.[0]

      if (!imageUrl) {
        throw new Error('Minimax response missing image URL')
      }

      const imageBuffer = await downloadImage(imageUrl, assetDownloadTimeoutMs)

      const entityId = task.type === 'album_cover' ? task.album_id : task.song_id
      const filePath = `${task.user_id}/${entityId}/${Date.now()}.png`
      const publicUrl = await uploadToCovers(supabase, filePath, imageBuffer)

      await supabase
        .from('generation_tasks')
        .update({
          status: 'completed',
          result: {
            cover_url: publicUrl,
            file_path: filePath,
          },
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id)

      return new Response(
        JSON.stringify({ processed: 1, task_id: task.id, type: task.type }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    throw new Error(`Unknown task type: ${task.type}`)
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
          started_at: null,
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
