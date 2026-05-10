import { readFileSync, writeFileSync, existsSync } from 'fs'
import { SeedProgress } from '../types'
import { CONFIG } from '../config'

const DEFAULT_PROGRESS: SeedProgress = {
  phase: 'lyrics',
  completedLyrics: [],
  completedSongs: [],
  completedCovers: [],
  failedTrackIds: [],
  failedCoverIds: [],
  songResults: {},
  lyricResults: {},
  coverResults: {},
  dbAlbumIds: [],
  dbSongIds: {},
  dbLyricIds: {},
}

export function loadProgress(): SeedProgress {
  if (existsSync(CONFIG.progressFile)) {
    const raw = readFileSync(CONFIG.progressFile, 'utf-8')
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) }
  }
  return { ...DEFAULT_PROGRESS }
}

export function saveProgress(progress: SeedProgress): void {
  writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2))
}
