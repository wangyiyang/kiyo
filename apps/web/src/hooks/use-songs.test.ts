import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSongs } from './use-songs'

describe('useSongs', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns loading=true initially', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useSongs())
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.songs).toEqual([])
  })

  it('returns songs on success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ songs: [{ id: '1', title: 'Song A' }] }), { status: 200 })
    )
    const { result } = renderHook(() => useSongs())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.songs).toEqual([{ id: '1', title: 'Song A' }])
    expect(result.current.error).toBeNull()
  })

  it('returns error on fetch failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Authentication required' } }), { status: 401 })
    )
    const { result } = renderHook(() => useSongs())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).not.toBeNull()
    expect(result.current.error?.message).toContain('Authentication required')
    expect(result.current.songs).toEqual([])
  })

  it('returns error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useSongs())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toBe('Network error')
  })
})
