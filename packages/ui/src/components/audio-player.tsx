'use client'

interface AudioPlayerProps {
  src: string
  className?: string
}

export function AudioPlayer({ src, className }: AudioPlayerProps) {
  return (
    <audio controls className={className} src={src}>
      您的浏览器不支持音频播放。
    </audio>
  )
}
