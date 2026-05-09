import { createClient } from '@supabase/supabase-js'
import { TrackPrompt, AlbumPrompt, GeneratedLyric, GeneratedSong, GeneratedCover, SeedProgress } from '../types'
import { CONFIG } from '../config'
import { saveProgress } from '../utils/progress'

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceRoleKey)

async function ensureSeedUser(): Promise<string> {
  if (CONFIG.seedUserId) {
    return CONFIG.seedUserId
  }

  // 尝试创建系统用户
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'seed@kiyo.local',
    password: crypto.randomUUID(),
    email_confirm: true,
  })

  if (error) {
    if (error.message.includes('already been registered')) {
      // 用户已存在，查找它
      const { data: users } = await supabase.auth.admin.listUsers()
      const existing = users?.users.find(u => u.email === 'seed@kiyo.local')
      if (existing) return existing.id
    }
    throw new Error(`Failed to create seed user: ${error.message}`)
  }

  if (!data.user) throw new Error('Seed user creation returned no user')
  console.log(`[DB] Created seed user: ${data.user.id}`)
  return data.user.id
}

async function downloadAndUploadAudio(userId: string, songId: string, audioUrl: string): Promise<string> {
  const res = await fetch(audioUrl)
  if (!res.ok) throw new Error(`Failed to download audio: ${res.status}`)
  const buffer = await res.arrayBuffer()

  const filePath = `${userId}/${songId}/${Date.now()}.mp3`
  const { error } = await supabase.storage
    .from('audio')
    .upload(filePath, buffer, { contentType: 'audio/mpeg' })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from('audio').getPublicUrl(filePath)
  return data.publicUrl
}

async function downloadAndUploadCover(userId: string, targetId: string, imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`Failed to download cover: ${res.status}`)
  const buffer = await res.arrayBuffer()

  const filePath = `${userId}/${targetId}/${Date.now()}.png`
  const { error } = await supabase.storage
    .from('covers')
    .upload(filePath, buffer, { contentType: 'image/png' })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from('covers').getPublicUrl(filePath)
  return data.publicUrl
}

export async function writeAlbums(
  albums: AlbumPrompt[],
  userId: string,
  progress: SeedProgress
): Promise<string[]> {
  console.log(`[DB] Writing ${albums.length} albums...`)

  const albumData = albums.map(album => ({
    user_id: userId,
    title: album.title,
    description: album.description,
    genre: album.genre,
    status: 'completed',
    cover_status: 'none',
  }))

  const { data, error } = await supabase.from('albums').insert(albumData).select('id')
  if (error) throw new Error(`Album insert failed: ${error.message}`)

  const ids = data.map((a: { id: string }) => a.id)
  progress.dbAlbumIds = ids
  saveProgress(progress)

  console.log(`[DB] ✅ ${ids.length} albums written`)
  return ids
}

export async function writeLyrics(
  lyrics: GeneratedLyric[],
  userId: string,
  progress: SeedProgress
): Promise<Record<number, string>> {
  console.log(`[DB] Writing ${lyrics.length} lyrics...`)

  const lyricData = lyrics.map(lyric => ({
    user_id: userId,
    title: lyric.title,
    content: lyric.content,
    source: 'ai_generated',
    status: 'draft',
    ai_prompt: lyric.content.slice(0, 200),
  }))

  const { data, error } = await supabase.from('lyrics').insert(lyricData).select('id')
  if (error) throw new Error(`Lyrics insert failed: ${error.message}`)

  const ids: Record<number, string> = {}
  for (let i = 0; i < lyrics.length; i++) {
    ids[lyrics[i].trackId] = data[i].id
    progress.lyricResults[lyrics[i].trackId].dbId = data[i].id
  }
  progress.dbLyricIds = ids
  saveProgress(progress)

  console.log(`[DB] ✅ ${Object.keys(ids).length} lyrics written`)
  return ids
}

export async function writeSongs(
  tracks: TrackPrompt[],
  songs: GeneratedSong[],
  lyricIds: Record<number, string>,
  userId: string,
  progress: SeedProgress
): Promise<Record<number, string>> {
  console.log(`[DB] Writing ${songs.length} songs...`)

  const songMap = new Map(songs.map(s => [s.trackId, s]))
  const ids: Record<number, string> = {}

  // 分批写入（每批10首）
  const BATCH_SIZE = 10
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    const batch = tracks.slice(i, i + BATCH_SIZE)
    const batchData = []

    for (const track of batch) {
      const song = songMap.get(track.id)
      if (!song) continue

      batchData.push({
        user_id: userId,
        title: track.title,
        genre: track.genre,
        mood: track.mood,
        ai_prompt: track.prompt,
        source: 'ai_generated',
        status: 'completed',
        is_featured: track.isFeatured,
        lyric_id: track.hasLyrics ? lyricIds[track.id] ?? null : null,
      })
    }

    if (batchData.length === 0) continue

    const { data, error } = await supabase.from('songs').insert(batchData).select('id')
    if (error) throw new Error(`Songs insert failed: ${error.message}`)

    for (let j = 0; j < batch.length; j++) {
      const track = batch[j]
      const song = songMap.get(track.id)
      if (!song || j >= data.length) continue
      ids[track.id] = data[j].id
    }
  }

  progress.dbSongIds = ids
  saveProgress(progress)

  console.log(`[DB] ✅ ${Object.keys(ids).length} songs written`)
  return ids
}

export async function uploadAudioFiles(
  songs: GeneratedSong[],
  dbSongIds: Record<number, string>,
  userId: string,
  progress: SeedProgress
): Promise<void> {
  console.log(`[DB] Uploading ${songs.length} audio files...`)

  for (const song of songs) {
    const dbId = dbSongIds[song.trackId]
    if (!dbId) continue

    try {
      const publicUrl = await downloadAndUploadAudio(userId, dbId, song.audioUrl)
      const storagePath = publicUrl.replace(/^.*\/storage\/v1\/object\/public\/audio\//, '')

      const { error } = await supabase
        .from('songs')
        .update({ audio_url: publicUrl, duration: song.duration, file_path: storagePath })
        .eq('id', dbId)

      if (error) throw new Error(`Update failed: ${error.message}`)

      progress.songResults[song.trackId].storagePath = storagePath
      saveProgress(progress)

      console.log(`[DB] ✅ Audio uploaded for track ${song.trackId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[DB] ❌ Audio upload failed for track ${song.trackId}: ${message}`)
    }
  }
}

export async function writeAlbumSongs(
  tracks: TrackPrompt[],
  dbAlbumIds: string[],
  dbSongIds: Record<number, string>,
  progress: SeedProgress
): Promise<void> {
  console.log(`[DB] Writing album_songs relations...`)

  const relations = tracks
    .map(track => ({
      album_id: dbAlbumIds[track.albumIndex],
      song_id: dbSongIds[track.id],
      order_index: track.id % CONFIG.counts.songsPerAlbum,
    }))
    .filter(r => r.album_id && r.song_id)

  if (relations.length === 0) {
    console.log('[DB] No relations to write')
    return
  }

  const { error } = await supabase.from('album_songs').insert(relations)
  if (error) throw new Error(`Album songs insert failed: ${error.message}`)

  console.log(`[DB] ✅ ${relations.length} album_songs relations written`)
}

export async function uploadCoverFiles(
  covers: GeneratedCover[],
  userId: string,
  progress: SeedProgress
): Promise<void> {
  console.log(`[DB] Uploading ${covers.length} covers...`)

  for (const cover of covers) {
    const coverId = `${cover.targetType}-${cover.targetId}`

    try {
      const publicUrl = await downloadAndUploadCover(userId, cover.targetId, cover.imageUrl)
      const storagePath = publicUrl.replace(/^.*\/storage\/v1\/object\/public\/covers\//, '')

      const table = cover.targetType === 'album' ? 'albums' : 'songs'
      const { error } = await supabase
        .from(table)
        .update({ cover_url: publicUrl, cover_status: 'completed' })
        .eq('id', cover.targetId)

      if (error) throw new Error(`Update failed: ${error.message}`)

      progress.coverResults[coverId].storagePath = storagePath
      saveProgress(progress)

      console.log(`[DB] ✅ Cover uploaded for ${cover.targetType} ${cover.targetId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[DB] ❌ Cover upload failed for ${cover.targetType} ${cover.targetId}: ${message}`)
    }
  }
}

export { ensureSeedUser }
