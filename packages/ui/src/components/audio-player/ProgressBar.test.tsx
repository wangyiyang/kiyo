import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ProgressBar } from './ProgressBar'
import { usePlayerStore } from '../../store/usePlayerStore'

beforeEach(() => {
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
    isSeeking: false,
  })
})

describe('ProgressBar', () => {
  it('renders progress slider with aria attributes', () => {
    usePlayerStore.setState({ currentTime: 30, duration: 120 })
    render(<ProgressBar />)

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-label', 'Progress')
    expect(slider).toHaveAttribute('aria-valuenow', '30')
    expect(slider).toHaveAttribute('aria-valuemax', '120')
  })

  it('seeks on click within the hot zone', () => {
    usePlayerStore.setState({ currentTime: 0, duration: 100 })
    render(<ProgressBar />)

    const slider = screen.getByRole('slider')
    // Simulate clicking at 50% of the slider width
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 20,
      right: 200,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect)

    fireEvent.mouseDown(slider, { clientX: 100 })

    const state = usePlayerStore.getState()
    expect(state.currentTime).toBe(50)
    expect(state.isSeeking).toBe(true)
  })

  it('updates time display while dragging', () => {
    usePlayerStore.setState({ currentTime: 10, duration: 100 })
    render(<ProgressBar />)

    const slider = screen.getByRole('slider')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 20,
      right: 200,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect)

    // Initial time shows 0:10
    expect(screen.getByText('0:10')).toBeInTheDocument()

    // Start drag to 75%
    fireEvent.mouseDown(slider, { clientX: 150 })
    expect(screen.getByText('1:15')).toBeInTheDocument()

    // Drag to 25%
    fireEvent.mouseMove(window, { clientX: 50 })
    expect(screen.getByText('0:25')).toBeInTheDocument()

    // Release ends seeking
    fireEvent.mouseUp(window)
    expect(usePlayerStore.getState().isSeeking).toBe(false)
  })

  it('handles touch drag', () => {
    usePlayerStore.setState({ currentTime: 0, duration: 100 })
    render(<ProgressBar />)

    const slider = screen.getByRole('slider')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 20,
      right: 200,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect)

    fireEvent.touchStart(slider, {
      touches: [{ clientX: 80 }],
    })

    expect(usePlayerStore.getState().currentTime).toBe(40)
    expect(usePlayerStore.getState().isSeeking).toBe(true)

    fireEvent.touchMove(window, {
      touches: [{ clientX: 120 }],
    })
    expect(usePlayerStore.getState().currentTime).toBe(60)

    fireEvent.touchEnd(window)
    expect(usePlayerStore.getState().isSeeking).toBe(false)
  })

  it('clamps seek to duration bounds', () => {
    usePlayerStore.setState({ currentTime: 50, duration: 100 })
    render(<ProgressBar />)

    const slider = screen.getByRole('slider')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 0,
      width: 200,
      height: 20,
      right: 300,
      bottom: 20,
      x: 100,
      y: 0,
      toJSON: () => {},
    } as DOMRect)

    // Click before the bar (clientX < left)
    fireEvent.mouseDown(slider, { clientX: 0 })
    expect(usePlayerStore.getState().currentTime).toBe(0)

    // Click after the bar (clientX > right)
    fireEvent.mouseDown(slider, { clientX: 500 })
    expect(usePlayerStore.getState().currentTime).toBe(100)
  })
})
