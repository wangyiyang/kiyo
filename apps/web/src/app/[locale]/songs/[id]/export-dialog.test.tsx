import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportDialog } from './export-dialog'

const mockT = (key: string) => {
  const map: Record<string, string> = {
    title: 'Export Audio',
    song: 'Song',
    format: 'Format',
    formatValue: 'MP3',
    confirm: 'Confirm Export',
    success: 'Export successful',
    'actions.export': 'Export',
    'actions.cancel': 'Cancel',
    'states.exporting': 'Exporting…',
    'errors.exportFailed': 'Export failed',
  }
  return map[key] ?? key
}

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

vi.mock('@kiyo/ui', async () => {
  const actual = await vi.importActual('@kiyo/ui')
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
  }
})

describe('ExportDialog', () => {
  let fetchSpy: MockInstance
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    vi.resetAllMocks()
    fetchSpy = vi.spyOn(global, 'fetch')
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('renders export button and opens dialog with song info', () => {
    render(<ExportDialog songId="s1" songTitle="Test Song" />)

    fireEvent.click(screen.getByRole('button', { name: /Export/i }))

    expect(screen.getByText('Export Audio')).toBeInTheDocument()
    expect(screen.getByText('Test Song')).toBeInTheDocument()
    expect(screen.getByText('MP3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirm Export/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
  })

  it('downloads audio blob and triggers file save on success', async () => {
    const { toast } = await import('@kiyo/ui')

    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          downloadUrl: 'https://signed.example.com/audio.mp3',
          filename: 'Test Song.mp3',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['audio-data'], { type: 'audio/mpeg' }),
      } as Response)

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<ExportDialog songId="s1" songTitle="Test Song" />)
    fireEvent.click(screen.getByRole('button', { name: /Export/i }))
    fireEvent.click(screen.getByRole('button', { name: /Confirm Export/i }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/songs/s1/export')
      expect(fetchSpy).toHaveBeenNthCalledWith(2, 'https://signed.example.com/audio.mp3')
      expect(URL.createObjectURL).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
      expect(toast.success).toHaveBeenCalledWith('Export successful')
    })

    clickSpy.mockRestore()
  })

  it('shows error toast when API returns non-ok', async () => {
    const { toast } = await import('@kiyo/ui')

    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Server error' } }),
    } as Response)

    render(<ExportDialog songId="s1" songTitle="Test Song" />)
    fireEvent.click(screen.getByRole('button', { name: /Export/i }))
    fireEvent.click(screen.getByRole('button', { name: /Confirm Export/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error')
    })
  })

  it('shows error toast when audio fetch fails', async () => {
    const { toast } = await import('@kiyo/ui')

    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          downloadUrl: 'https://signed.example.com/audio.mp3',
          filename: 'Test Song.mp3',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response)

    render(<ExportDialog songId="s1" songTitle="Test Song" />)
    fireEvent.click(screen.getByRole('button', { name: /Export/i }))
    fireEvent.click(screen.getByRole('button', { name: /Confirm Export/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Export failed')
    })
  })

  it('closes dialog when cancel is clicked', async () => {
    render(<ExportDialog songId="s1" songTitle="Test Song" />)

    fireEvent.click(screen.getByRole('button', { name: /Export/i }))
    expect(screen.getByText('Export Audio')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))

    await waitFor(() => {
      expect(screen.queryByText('Export Audio')).not.toBeInTheDocument()
    })
  })
})
