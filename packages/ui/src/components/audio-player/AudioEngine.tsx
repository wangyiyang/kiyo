'use client'

import { useEffect, useRef } from 'react'
import { Howl, Howler } from 'howler'
import { usePlayerStore } from '../../store/usePlayerStore'

const SEEK_DEBOUNCE_MS = 150
const SIGN_URL_TTL_MS = 55 * 60 * 1000 // Refresh if older than 55 minutes
const REFRESH_INTERVAL_MS = 50 * 60 * 1000 // Background refresh every 50 minutes

async function fetchSignedUrl(filePath: string): Promise<string> {
  const res = await fetch('/api/storage/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket: 'audio', path: filePath }),
  })
  if (!res.ok) throw new Error('Failed to sign audio URL')
  const data = await res.json()
  return data.signedUrl as string
}

export function AudioEngine() {
  const howlRef = useRef<Howl | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number>(0)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSeekTime = useRef<number>(0)

  // Signed URL tracking
  const signedUrlRef = useRef<string>('')
  const signedAtRef = useRef<number>(0)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const volume = usePlayerStore((s) => s.isMuted ? 0 : s.volume)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime)
  const setDuration = usePlayerStore((s) => s.setDuration)
  const setAnalyserData = usePlayerStore((s) => s.setAnalyserData)
  const next = usePlayerStore((s) => s.next)

  // Create / switch Howl when currentTrack changes
  useEffect(() => {
    if (!currentTrack?.audio_url && !currentTrack?.file_path) {
      howlRef.current?.unload()
      howlRef.current = null
      analyserRef.current = null
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      cancelAnimationFrame(rafRef.current)
      setAnalyserData(null)
      signedUrlRef.current = ''
      signedAtRef.current = 0
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      return
    }

    let cancelled = false

    async function initHowl() {
      let src = currentTrack!.audio_url

      if (!src && currentTrack!.file_path) {
        try {
          src = await fetchSignedUrl(currentTrack!.file_path)
          signedUrlRef.current = src
          signedAtRef.current = Date.now()

          // Schedule background refresh
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
          refreshTimerRef.current = setTimeout(async () => {
            try {
              const url = await fetchSignedUrl(currentTrack!.file_path!)
              signedUrlRef.current = url
              signedAtRef.current = Date.now()
            } catch {
              // Ignore background refresh failure
            }
          }, REFRESH_INTERVAL_MS)
        } catch (err) {
          console.error('Failed to sign audio URL:', err)
          return
        }
      }

      if (!src) {
        console.error('No audio source available')
        return
      }

      if (cancelled) return

      howlRef.current?.unload()
      cancelAnimationFrame(rafRef.current)

      const howl = new Howl({
        src: [src],
        html5: true,
        volume,
        onload: () => {
          if (!cancelled) setDuration(howl.duration())
        },
        onend: () => {
          if (!cancelled) next()
        },
        onloaderror: (_id, err) => {
          console.error('Howl load error:', err)
        },
      })

      howlRef.current = howl

      if (isPlaying && !cancelled) {
        howl.play()
        startProgressLoop()
        startVisualizer()
      }
    }

    initHowl()

    return () => {
      cancelled = true
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      howlRef.current?.unload()
      cancelAnimationFrame(rafRef.current)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [currentTrack?.audio_url, currentTrack?.file_path])

  // Sync play / pause
  useEffect(() => {
    const howl = howlRef.current
    if (!howl || !currentTrack) return

    if (isPlaying) {
      if (!howl.playing()) {
        // If file_path exists and URL is stale, refresh before playing
        if (
          currentTrack.file_path &&
          Date.now() - signedAtRef.current > SIGN_URL_TTL_MS
        ) {
          fetchSignedUrl(currentTrack.file_path)
            .then((url) => {
              signedUrlRef.current = url
              signedAtRef.current = Date.now()
              howl.unload()
              const newHowl = new Howl({
                src: [url],
                html5: true,
                volume,
                onload: () => {
                  setDuration(newHowl.duration())
                  newHowl.play()
                  startProgressLoop()
                  startVisualizer()
                },
              })
              howlRef.current = newHowl
            })
            .catch((err) => {
              console.error('Failed to refresh signed URL on resume:', err)
            })
          return
        }

        howl.play()
        startProgressLoop()
        startVisualizer()
      }
    } else {
      if (howl.playing()) {
        howl.pause()
        stopProgressLoop()
        stopVisualizer()
      }
    }
  }, [isPlaying])

  // Sync volume
  useEffect(() => {
    howlRef.current?.volume(volume)
  }, [volume])

  // Sync seek from store -> Howl
  useEffect(() => {
    const howl = howlRef.current
    if (!howl || !currentTrack) return

    const now = Date.now()
    if (now - lastSeekTime.current < SEEK_DEBOUNCE_MS) return
    lastSeekTime.current = now

    const currentHowlTime = howl.seek() as number
    if (Math.abs(currentHowlTime - currentTime) > 1) {
      howl.seek(currentTime)
    }
  }, [currentTime])

  function startProgressLoop() {
    stopProgressLoop()
    progressIntervalRef.current = setInterval(() => {
      const howl = howlRef.current
      if (!howl || !howl.playing()) return
      const seek = howl.seek() as number
      setCurrentTime(seek)
    }, 250)
  }

  function stopProgressLoop() {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }

  function startVisualizer() {
    const ctx = Howler.ctx
    if (!ctx) return

    try {
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      Howler.masterGain.connect(analyser)
      analyserRef.current = analyser

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const draw = () => {
        rafRef.current = requestAnimationFrame(draw)
        analyser.getByteFrequencyData(dataArray)
        setAnalyserData(new Uint8Array(dataArray))
      }

      draw()
    } catch (e) {
      console.warn('Web Audio visualizer init failed:', e)
    }
  }

  function stopVisualizer() {
    cancelAnimationFrame(rafRef.current)
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect()
      } catch {
        // ignore
      }
      analyserRef.current = null
    }
    setAnalyserData(null)
  }

  return null
}
