import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, ...props }: { alt: string }) => <img alt={alt} {...props} />,
}))

import { AudioPlayer, usePlayerStore } from '@kiyo/ui'

beforeEach(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      fillStyle: '',
    })),
  })
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: vi.fn(() => 0),
  })
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    value: vi.fn(),
  })

  usePlayerStore.setState({
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
  })
})

describe('AudioPlayer main control', () => {
  it('loads and plays the current song when the large play button is clicked first', () => {
    render(
      <AudioPlayer
        src=""
        filePath="user-1/song-1/audio.mp3"
        songId="song-1"
        title="测试歌曲"
        duration={180}
      />
    )

    const playButtons = screen.getAllByRole('button', { name: 'Play' })
    fireEvent.click(playButtons[playButtons.length - 1])

    const state = usePlayerStore.getState()
    expect(state.isPlaying).toBe(true)
    expect(state.currentTrack).toMatchObject({
      id: 'song-1',
      title: '测试歌曲',
      audio_url: '',
      file_path: 'user-1/song-1/audio.mp3',
      duration: 180,
    })
    expect(state.playlist).toHaveLength(1)
  })

  it('switches to another file-path-only song instead of treating empty src values as the same track', () => {
    usePlayerStore.setState({
      currentTrack: {
        id: 'song-1',
        title: '第一首',
        audio_url: '',
        file_path: 'user-1/song-1/audio.mp3',
      },
      playlist: [
        {
          id: 'song-1',
          title: '第一首',
          audio_url: '',
          file_path: 'user-1/song-1/audio.mp3',
        },
      ],
      currentIndex: 0,
      isPlaying: true,
    })

    render(
      <AudioPlayer
        src=""
        filePath="user-1/song-2/audio.mp3"
        songId="song-2"
        title="第二首"
        duration={210}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))

    const state = usePlayerStore.getState()
    expect(state.isPlaying).toBe(true)
    expect(state.currentTrack).toMatchObject({
      id: 'song-2',
      title: '第二首',
      audio_url: '',
      file_path: 'user-1/song-2/audio.mp3',
      duration: 210,
    })
  })
})
