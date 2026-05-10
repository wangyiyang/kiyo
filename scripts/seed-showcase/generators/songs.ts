import { generateMusic } from '../../../packages/ai/index.ts'
import { TrackPrompt, GeneratedLyric, GeneratedSong, SeedProgress } from '../types'
import { withRetry } from '../utils/rate-limiter'
import { saveProgress } from '../utils/progress'
import { CONFIG } from '../config'
import { pLimit } from '../utils/p-limit'

export async function generateAllSongs(
  tracks: TrackPrompt[],
  lyrics: GeneratedLyric[],
  progress: SeedProgress
): Promise<GeneratedSong[]> {
  const results: GeneratedSong[] = []
  const lyricMap = new Map(lyrics.map(l => [l.trackId, l]))

  const pendingTracks = tracks.filter(
    t => !progress.completedSongs.includes(t.id) && !progress.failedTrackIds.includes(t.id)
  )

  console.log(`[Songs] Generating ${pendingTracks.length} remaining songs (batch size: ${CONFIG.batchSize.songs})...`)

  const limit = pLimit(CONFIG.batchSize.songs)

  for (let i = 0; i < pendingTracks.length; i += CONFIG.batchSize.songs) {
    const batch = pendingTracks.slice(i, i + CONFIG.batchSize.songs)
    console.log(`[Songs] Batch ${Math.floor(i / CONFIG.batchSize.songs) + 1}/${Math.ceil(pendingTracks.length / CONFIG.batchSize.songs)}: tracks [${batch.map(t => t.id).join(', ')}]`)

    const batchResults = await Promise.all(
      batch.map(track =>
        limit(() => generateSingleSong(track, lyricMap, progress))
      )
    )

    results.push(...batchResults.filter((r): r is GeneratedSong => r !== null))

    // 批次间等待（除了最后一批）
    if (i + CONFIG.batchSize.songs < pendingTracks.length) {
      console.log(`[Songs] Waiting ${CONFIG.rateLimits.songs.delayMs}ms before next batch...`)
      await new Promise(r => setTimeout(r, CONFIG.rateLimits.songs.delayMs))
    }
  }

  return results
}

async function generateSingleSong(
  track: TrackPrompt,
  lyricMap: Map<number, GeneratedLyric>,
  progress: SeedProgress
): Promise<GeneratedSong | null> {
  try {
    const lyric = lyricMap.get(track.id)
    const { audioUrl, duration } = await withRetry(
      () => generateMusic({
        prompt: track.prompt,
        lyrics: lyric?.content,
        isInstrumental: !lyric,
      }),
      `song-${track.id}`
    )

    const song: GeneratedSong = {
      trackId: track.id,
      title: track.title,
      audioUrl,
      duration,
      lyricId: lyric ? String(lyric.trackId) : undefined,
    }

    progress.completedSongs.push(track.id)
    progress.songResults[track.id] = { audioUrl, duration, storagePath: '' }
    saveProgress(progress)

    console.log(`[Songs] ✅ Track ${track.id}: "${track.title}" (${duration}s)`)
    return song
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Songs] ❌ Track ${track.id}: ${message}`)
    progress.failedTrackIds.push(track.id)
    saveProgress(progress)
    return null
  }
}
