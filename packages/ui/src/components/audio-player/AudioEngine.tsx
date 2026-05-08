'use client'

import { useEffect, useRef } from 'react'
import { Howl, Howler } from 'howler'
import { usePlayerStore } from '../../store/usePlayerStore'

const SEEK_DEBOUNCE_MS = 150

export function AudioEngine() {
  const howlRef = useRef<Howl | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number>(0)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSeekTime = useRef<number>(0)

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
    if (!currentTrack?.audio_url) {
      howlRef.current?.unload()
      howlRef.current = null
      analyserRef.current = null
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      cancelAnimationFrame(rafRef.current)
      setAnalyserData(null)
      return
    }

    howlRef.current?.unload()
    cancelAnimationFrame(rafRef.current)

    const howl = new Howl({
      src: [currentTrack.audio_url],
      html5: true,
      volume,
      onload: () => {
        setDuration(howl.duration())
      },
      onend: () => {
        next()
      },
      onloaderror: (_id, err) => {
        console.error('Howl load error:', err)
      },
    })

    howlRef.current = howl

    if (isPlaying) {
      howl.play()
      startProgressLoop()
      startVisualizer()
    }

    return () => {
      howl.unload()
      cancelAnimationFrame(rafRef.current)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.audio_url])

  // Sync play / pause
  useEffect(() => {
    const howl = howlRef.current
    if (!howl || !currentTrack) return

    if (isPlaying) {
      if (!howl.playing()) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
