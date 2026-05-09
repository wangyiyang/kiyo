import { generateImage } from '../../../packages/ai/index.ts'
import { TrackPrompt, AlbumPrompt, GeneratedCover, SeedProgress } from '../types'
import { RateLimiter, withRetry } from '../utils/rate-limiter'
import { saveProgress } from '../utils/progress'

const limiter = new RateLimiter('covers')

function buildAlbumCoverPrompt(album: AlbumPrompt): string {
  return `Album cover art for "${album.title}". ${album.description}. Abstract, artistic, high quality, no text.`
}

function buildSongCoverPrompt(track: TrackPrompt): string {
  return `Music cover art for a ${track.mood} ${track.genre} track titled "${track.title}". Abstract, artistic, high quality, no text.`
}

export async function generateAlbumCovers(
  albums: AlbumPrompt[],
  dbAlbumIds: string[],
  progress: SeedProgress
): Promise<GeneratedCover[]> {
  const results: GeneratedCover[] = []

  for (let i = 0; i < albums.length; i++) {
    const album = albums[i]
    const dbId = dbAlbumIds[i]
    const coverId = `album-${dbId}`

    if (progress.completedCovers.includes(coverId)) {
      console.log(`[Covers] ⏭️ Album ${album.index} already generated`)
      continue
    }

    try {
      await limiter.acquire()

      const prompt = buildAlbumCoverPrompt(album)
      const { imageUrl } = await withRetry(
        () => generateImage({ prompt, width: 1024, height: 1024 }),
        `cover-album-${album.index}`
      )

      const cover: GeneratedCover = {
        targetId: dbId,
        targetType: 'album',
        imageUrl,
      }

      results.push(cover)
      progress.completedCovers.push(coverId)
      progress.coverResults[coverId] = { imageUrl, storagePath: '' }
      saveProgress(progress)

      console.log(`[Covers] ✅ Album ${album.index}: "${album.title}"`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Covers] ❌ Album ${album.index}: ${message}`)
      progress.failedCoverIds.push(coverId)
      saveProgress(progress)
    }
  }

  return results
}

export async function generateSongCovers(
  tracks: TrackPrompt[],
  dbSongIds: Record<number, string>,
  progress: SeedProgress
): Promise<GeneratedCover[]> {
  const results: GeneratedCover[] = []

  // 每张专辑选 4 首做封面（优先精选）
  const tracksByAlbum = new Map<number, TrackPrompt[]>()
  for (const track of tracks) {
    if (!tracksByAlbum.has(track.albumIndex)) {
      tracksByAlbum.set(track.albumIndex, [])
    }
    tracksByAlbum.get(track.albumIndex)!.push(track)
  }

  const selectedTracks: TrackPrompt[] = []
  for (const [, albumTracks] of tracksByAlbum) {
    // 先选精选，再补充到4首
    const featured = albumTracks.filter(t => t.isFeatured)
    const others = albumTracks.filter(t => !t.isFeatured)
    const selected = [...featured, ...others].slice(0, 4)
    selectedTracks.push(...selected)
  }

  console.log(`[Covers] Generating ${selectedTracks.length} song covers...`)

  for (const track of selectedTracks) {
    const dbId = dbSongIds[track.id]
    if (!dbId) {
      console.warn(`[Covers] ⚠️ Track ${track.id} has no db ID, skipping`)
      continue
    }

    const coverId = `song-${dbId}`
    if (progress.completedCovers.includes(coverId)) {
      console.log(`[Covers] ⏭️ Song ${track.id} already generated`)
      continue
    }

    try {
      await limiter.acquire()

      const prompt = buildSongCoverPrompt(track)
      const { imageUrl } = await withRetry(
        () => generateImage({ prompt, width: 1024, height: 1024 }),
        `cover-song-${track.id}`
      )

      const cover: GeneratedCover = {
        targetId: dbId,
        targetType: 'song',
        imageUrl,
      }

      results.push(cover)
      progress.completedCovers.push(coverId)
      progress.coverResults[coverId] = { imageUrl, storagePath: '' }
      saveProgress(progress)

      console.log(`[Covers] ✅ Song ${track.id}: "${track.title}"`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Covers] ❌ Song ${track.id}: ${message}`)
      progress.failedCoverIds.push(coverId)
      saveProgress(progress)
    }
  }

  return results
}
