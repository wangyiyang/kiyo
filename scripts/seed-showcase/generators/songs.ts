import { generateMusic } from '../../../packages/ai/index.ts'
import { TrackPrompt, GeneratedLyric, GeneratedSong, SeedProgress } from '../types'
import { RateLimiter, withRetry } from '../utils/rate-limiter'
import { saveProgress } from '../utils/progress'

const limiter = new RateLimiter('songs')

export async function generateAllSongs(
  tracks: TrackPrompt[],
  lyrics: GeneratedLyric[],
  progress: SeedProgress
): Promise<GeneratedSong[]> {
  const results: GeneratedSong[] = []
  const lyricMap = new Map(lyrics.map(l => [l.trackId, l]))

  console.log(`[Songs] Generating ${tracks.length} songs...`)

  for (const track of tracks) {
    if (progress.completedSongs.includes(track.id)) {
      console.log(`[Songs] ⏭️ Track ${track.id} already generated`)
      continue
    }

    if (progress.failedTrackIds.includes(track.id)) {
      console.log(`[Songs] ⏭️ Track ${track.id} previously failed, skipping`)
      continue
    }

    try {
      await limiter.acquire()

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

      results.push(song)
      progress.completedSongs.push(track.id)
      progress.songResults[track.id] = { audioUrl, duration, storagePath: '' }
      saveProgress(progress)

      console.log(`[Songs] ✅ Track ${track.id}: "${track.title}" (${duration}s)`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Songs] ❌ Track ${track.id}: ${message}`)
      progress.failedTrackIds.push(track.id)
      saveProgress(progress)
    }
  }

  return results
}
