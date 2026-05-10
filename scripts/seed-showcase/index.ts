import { config as dotenvConfig } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenvConfig({ path: resolve(__dirname, '.env') })

async function main() {
  const { generateAllPrompts } = await import('./prompts')
  const { generateAllLyrics } = await import('./generators/lyrics')
  const { generateAllSongs } = await import('./generators/songs')
  const { generateAlbumCovers, generateSongCovers } = await import('./generators/covers')
  const {
    ensureSeedUser,
    writeAlbums,
    writeLyrics,
    writeSongs,
    uploadAudioFiles,
    writeAlbumSongs,
    uploadCoverFiles,
  } = await import('./writers/database')
  const { loadProgress, saveProgress } = await import('./utils/progress')
  const { CONFIG } = await import('./config')

  console.log('🎵 Kiyo Showcase Seed Generator')
  console.log(`   Target: ${CONFIG.counts.totalSongs} songs, ${CONFIG.counts.totalAlbums} albums`)
  console.log('')

  const progress = loadProgress()

  // Phase 0: Ensure seed user
  const userId = await ensureSeedUser()
  console.log(`[System] Seed user ID: ${userId}`)

  // Generate prompts
  const { tracks, albums } = generateAllPrompts()
  console.log(`[System] Generated ${tracks.length} track prompts, ${albums.length} album prompts`)

  // Phase 1: Generate lyrics
  if (progress.phase === 'lyrics') {
    const lyrics = await generateAllLyrics(tracks, progress)
    console.log(`[Phase 1] Generated ${lyrics.length} lyrics`)
    progress.phase = 'songs'
    saveProgress(progress)
  }

  // Phase 2: Generate songs
  if (progress.phase === 'songs') {
    const lyricList = Object.entries(progress.lyricResults).map(([trackId, r]) => ({
      trackId: Number(trackId),
      title: tracks.find(t => t.id === Number(trackId))?.title ?? '',
      content: r.content,
    }))
    const songs = await generateAllSongs(tracks, lyricList, progress)
    console.log(`[Phase 2] Generated ${songs.length} songs`)
    progress.phase = 'covers'
    saveProgress(progress)
  }

  // Phase 3: Write albums + lyrics + songs to DB, upload audio
  if (progress.phase === 'covers') {
    // Write albums first
    if (progress.dbAlbumIds.length === 0) {
      progress.dbAlbumIds = await writeAlbums(albums, userId, progress)
    }

    // Write lyrics
    if (Object.keys(progress.dbLyricIds).length === 0) {
      const lyricList = Object.entries(progress.lyricResults).map(([trackId, r]) => ({
        trackId: Number(trackId),
        title: tracks.find(t => t.id === Number(trackId))?.title ?? '',
        content: r.content,
      }))
      progress.dbLyricIds = await writeLyrics(lyricList, userId, progress)
    }

    // Write songs
    if (Object.keys(progress.dbSongIds).length === 0) {
      const songList = Object.entries(progress.songResults).map(([trackId, r]) => ({
        trackId: Number(trackId),
        title: tracks.find(t => t.id === Number(trackId))?.title ?? '',
        audioUrl: r.audioUrl,
        duration: r.duration,
      }))
      progress.dbSongIds = await writeSongs(tracks, songList, progress.dbLyricIds, userId, progress)
    }

    // Upload audio files
    const songList = Object.entries(progress.songResults).map(([trackId, r]) => ({
      trackId: Number(trackId),
      title: tracks.find(t => t.id === Number(trackId))?.title ?? '',
      audioUrl: r.audioUrl,
      duration: r.duration,
    }))
    await uploadAudioFiles(songList, progress.dbSongIds, userId, progress)

    // Write album_songs relations
    await writeAlbumSongs(tracks, progress.dbAlbumIds, progress.dbSongIds, progress)

    progress.phase = 'database'
    saveProgress(progress)
  }

  // Phase 4: Generate and upload covers
  if (progress.phase === 'database') {
    // Album covers
    const albumCovers = await generateAlbumCovers(albums, progress.dbAlbumIds, progress)
    await uploadCoverFiles(albumCovers, userId, progress)

    // Song covers
    const songCovers = await generateSongCovers(tracks, progress.dbSongIds, progress)
    await uploadCoverFiles(songCovers, userId, progress)

    progress.phase = 'completed'
    saveProgress(progress)
  }

  console.log('')
  console.log('✅ Seed generation complete!')
  console.log(`   Albums: ${progress.dbAlbumIds.length}`)
  console.log(`   Songs: ${Object.keys(progress.dbSongIds).length}`)
  console.log(`   Lyrics: ${Object.keys(progress.dbLyricIds).length}`)
  console.log(`   Covers: ${progress.completedCovers.length}`)
  console.log(`   Failed tracks: ${progress.failedTrackIds.length}`)
  console.log(`   Failed covers: ${progress.failedCoverIds.length}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
