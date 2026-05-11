'use client'

import { create } from 'zustand'

export interface PlayerSong {
  id: string
  title: string
  audio_url: string
  cover_url?: string | null
  file_path?: string | null
  duration?: number | null
  album?: string | null
}

export type RepeatMode = 'off' | 'one' | 'all'

interface PlayerState {
  isPlaying: boolean
  currentTrack: PlayerSong | null
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  playlist: PlayerSong[]
  currentIndex: number
  repeatMode: RepeatMode
  isShuffle: boolean
  isMiniPlayerVisible: boolean
  isMiniPlayerExpanded: boolean
  analyserData: Uint8Array | null

  play: (song: PlayerSong, playlist?: PlayerSong[]) => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  next: () => void
  prev: () => void
  setVolume: (vol: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeatMode: () => void
  setMiniPlayerExpanded: (expanded: boolean) => void
  updatePlaylistOrder: (songs: PlayerSong[]) => void
  setAnalyserData: (data: Uint8Array | null) => void
  stopAndHide: () => void
}

function getShuffledIndex(currentIndex: number, length: number): number {
  if (length <= 1) return 0
  let nextIndex = Math.floor(Math.random() * length)
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * length)
  }
  return nextIndex
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  isPlaying: false,
  currentTrack: null,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  playlist: [],
  currentIndex: -1,
  repeatMode: 'off',
  isShuffle: false,
  isMiniPlayerVisible: false,
  isMiniPlayerExpanded: false,
  analyserData: null,

  play: (song, playlist) => {
    const pl = playlist ?? get().playlist
    const index = pl.findIndex((s) => s.id === song.id)
    set({
      currentTrack: song,
      playlist: pl,
      currentIndex: index >= 0 ? index : -1,
      isPlaying: true,
      isMiniPlayerVisible: true,
      currentTime: 0,
      duration: song.duration ?? 0,
    })
  },

  pause: () => set({ isPlaying: false }),

  togglePlay: () => {
    const { currentTrack, isPlaying } = get()
    if (!currentTrack) return
    set({ isPlaying: !isPlaying })
  },

  seek: (time) => {
    const { duration } = get()
    const clamped = Math.max(0, Math.min(time, duration))
    set({ currentTime: clamped })
  },

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  next: () => {
    const { playlist, currentIndex, repeatMode, isShuffle } = get()
    if (playlist.length === 0) return

    if (repeatMode === 'one') {
      set({ currentTime: 0, isPlaying: true })
      return
    }

    let nextIndex: number
    if (isShuffle) {
      nextIndex = getShuffledIndex(currentIndex, playlist.length)
    } else {
      nextIndex = currentIndex + 1
      if (nextIndex >= playlist.length) {
        nextIndex = repeatMode === 'all' ? 0 : currentIndex
      }
    }

    const nextTrack = playlist[nextIndex]
    if (nextTrack) {
      set({
        currentTrack: nextTrack,
        currentIndex: nextIndex,
        currentTime: 0,
        isPlaying: true,
      })
    }
  },

  prev: () => {
    const { playlist, currentIndex, isShuffle } = get()
    if (playlist.length === 0) return

    let prevIndex: number
    if (isShuffle) {
      prevIndex = getShuffledIndex(currentIndex, playlist.length)
    } else {
      prevIndex = currentIndex - 1
      if (prevIndex < 0) prevIndex = 0
    }

    const prevTrack = playlist[prevIndex]
    if (prevTrack) {
      set({
        currentTrack: prevTrack,
        currentIndex: prevIndex,
        currentTime: 0,
        isPlaying: true,
      })
    }
  },

  setVolume: (vol) => {
    const clamped = Math.max(0, Math.min(1, vol))
    set({ volume: clamped, isMuted: clamped === 0 })
  },

  toggleMute: () => {
    const { isMuted, volume } = get()
    if (isMuted) {
      set({ isMuted: false, volume: volume > 0 ? volume : 0.8 })
    } else {
      set({ isMuted: true })
    }
  },

  toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),

  cycleRepeatMode: () =>
    set((state) => ({
      repeatMode: state.repeatMode === 'off' ? 'all' : state.repeatMode === 'all' ? 'one' : 'off',
    })),

  setMiniPlayerExpanded: (expanded) => set({ isMiniPlayerExpanded: expanded }),

  updatePlaylistOrder: (songs) => {
    const { currentTrack } = get()
    const newIndex = currentTrack ? songs.findIndex((s) => s.id === currentTrack.id) : -1
    set({ playlist: songs, currentIndex: newIndex })
  },

  setAnalyserData: (data) => set({ analyserData: data }),

  stopAndHide: () =>
    set({
      isPlaying: false,
      currentTrack: null,
      currentTime: 0,
      duration: 0,
      isMiniPlayerVisible: false,
      isMiniPlayerExpanded: false,
      analyserData: null,
    }),
}))