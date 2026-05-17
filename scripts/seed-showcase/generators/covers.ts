import { generateImage } from '../../../packages/ai/index.ts'
import { TrackPrompt, AlbumPrompt, GeneratedCover, SeedProgress } from '../types'
import { withRetry } from '../utils/rate-limiter'
import { saveProgress } from '../utils/progress'
import { CONFIG } from '../config'
import { pLimit } from '../utils/p-limit'

function buildAlbumCoverPrompt(album: AlbumPrompt): string {
  return `Album cover art for "${album.title}". ${album.description}. Abstract, artistic, high quality, no text.`
}

function buildSongCoverPrompt(track: TrackPrompt): string {
  return `Music cover art for a ${track.mood} ${track.genre} track. Abstract, artistic, high quality, no text, no letters, no words, no typography, no symbols.`
}

export async function generateAlbumCovers(
  albums: AlbumPrompt[],
  dbAlbumIds: string[],
  progress: SeedProgress
): Promise<GeneratedCover[]> {
  const results: GeneratedCover[] = []

  const pending = albums
    .map((album, i) => ({ album, dbId: dbAlbumIds[i] }))
    .filter(({ album, dbId }) => {
      const coverId = `album-${dbId}`
      return !progress.completedCovers.includes(coverId)
    })

  console.log(`[Covers] Generating ${pending.length} remaining album covers...`)

  const limit = pLimit(CONFIG.batchSize.covers)

  for (let i = 0; i < pending.length; i += CONFIG.batchSize.covers) {
    const batch = pending.slice(i, i + CONFIG.batchSize.covers)

    const batchResults = await Promise.all(
      batch.map(({ album, dbId }) =>
        limit(() => generateSingleAlbumCover(album, dbId, progress))
      )
    )

    results.push(...batchResults.filter((r): r is GeneratedCover => r !== null))

    if (i + CONFIG.batchSize.covers < pending.length) {
      await new Promise(r => setTimeout(r, CONFIG.rateLimits.covers.delayMs))
    }
  }

  return results
}

async function generateSingleAlbumCover(
  album: AlbumPrompt,
  dbId: string,
  progress: SeedProgress
): Promise<GeneratedCover | null> {
  const coverId = `album-${dbId}`

  try {
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

    progress.completedCovers.push(coverId)
    progress.coverResults[coverId] = { imageUrl, storagePath: '' }
    saveProgress(progress)

    console.log(`[Covers] ✅ Album ${album.index}: "${album.title}"`)
    return cover
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Covers] ❌ Album ${album.index}: ${message}`)
    progress.failedCoverIds.push(coverId)
    saveProgress(progress)
    return null
  }
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
    const featured = albumTracks.filter(t => t.isFeatured)
    const others = albumTracks.filter(t => !t.isFeatured)
    const selected = [...featured, ...others].slice(0, 4)
    selectedTracks.push(...selected)
  }

  const pending = selectedTracks.filter(t => {
    const dbId = dbSongIds[t.id]
    if (!dbId) return false
    const coverId = `song-${dbId}`
    return !progress.completedCovers.includes(coverId)
  })

  console.log(`[Covers] Generating ${pending.length} remaining song covers...`)

  const limit = pLimit(CONFIG.batchSize.covers)

  for (let i = 0; i < pending.length; i += CONFIG.batchSize.covers) {
    const batch = pending.slice(i, i + CONFIG.batchSize.covers)

    const batchResults = await Promise.all(
      batch.map(track =>
        limit(() => generateSingleSongCover(track, dbSongIds, progress))
      )
    )

    results.push(...batchResults.filter((r): r is GeneratedCover => r !== null))

    if (i + CONFIG.batchSize.covers < pending.length) {
      await new Promise(r => setTimeout(r, CONFIG.rateLimits.covers.delayMs))
    }
  }

  return results
}

async function generateSingleSongCover(
  track: TrackPrompt,
  dbSongIds: Record<number, string>,
  progress: SeedProgress
): Promise<GeneratedCover | null> {
  const dbId = dbSongIds[track.id]
  if (!dbId) {
    console.warn(`[Covers] ⚠️ Track ${track.id} has no db ID, skipping`)
    return null
  }

  const coverId = `song-${dbId}`

  try {
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

    progress.completedCovers.push(coverId)
    progress.coverResults[coverId] = { imageUrl, storagePath: '' }
    saveProgress(progress)

    console.log(`[Covers] ✅ Song ${track.id}: "${track.title}"`)
    return cover
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Covers] ❌ Song ${track.id}: ${message}`)
    progress.failedCoverIds.push(coverId)
    saveProgress(progress)
    return null
  }
}
