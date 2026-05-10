import { generateLyrics } from '../../../packages/ai/index.ts'
import { TrackPrompt, GeneratedLyric, SeedProgress } from '../types'
import { RateLimiter, withRetry } from '../utils/rate-limiter'
import { saveProgress } from '../utils/progress'

const limiter = new RateLimiter('lyrics')

export async function generateAllLyrics(
  tracks: TrackPrompt[],
  progress: SeedProgress
): Promise<GeneratedLyric[]> {
  const results: GeneratedLyric[] = []
  const lyricTracks = tracks.filter(t => t.hasLyrics)

  console.log(`[Lyrics] Generating ${lyricTracks.length} lyrics...`)

  for (const track of lyricTracks) {
    if (progress.completedLyrics.includes(track.id)) {
      console.log(`[Lyrics] ⏭️ Track ${track.id} already generated`)
      continue
    }

    try {
      await limiter.acquire()

      const { text } = await withRetry(
        () => generateLyrics({ prompt: track.prompt }),
        `lyric-${track.id}`
      )

      const lyric: GeneratedLyric = {
        trackId: track.id,
        title: track.title,
        content: text,
      }

      results.push(lyric)
      progress.completedLyrics.push(track.id)
      progress.lyricResults[track.id] = { content: text, dbId: '' }
      saveProgress(progress)

      console.log(`[Lyrics] ✅ Track ${track.id}: "${track.title}"`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Lyrics] ❌ Track ${track.id}: ${message}`)
      progress.failedTrackIds.push(track.id)
      saveProgress(progress)
    }
  }

  return results
}
