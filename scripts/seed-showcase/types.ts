export interface TrackPrompt {
  id: number
  albumIndex: number
  title: string
  prompt: string
  genre: string
  mood: string
  hasLyrics: boolean
  isFeatured: boolean
  bpm?: number
}

export interface AlbumPrompt {
  index: number
  title: string
  genre: string
  description: string
}

export interface GeneratedLyric {
  trackId: number
  title: string
  content: string
}

export interface GeneratedSong {
  trackId: number
  title: string
  audioUrl: string
  duration: number
  lyricId?: string
}

export interface GeneratedCover {
  targetId: string   // song_id or album_id
  targetType: 'song' | 'album'
  imageUrl: string
}

export interface SeedProgress {
  phase: 'lyrics' | 'songs' | 'covers' | 'database' | 'completed'
  completedLyrics: number[]
  completedSongs: number[]
  completedCovers: string[]
  failedTrackIds: number[]
  failedCoverIds: string[]
  songResults: Record<number, { audioUrl: string; duration: number; storagePath: string }>
  lyricResults: Record<number, { content: string; dbId: string }>
  coverResults: Record<string, { imageUrl: string; storagePath: string }>
  dbAlbumIds: string[]
  dbSongIds: Record<number, string>
  dbLyricIds: Record<number, string>
}
