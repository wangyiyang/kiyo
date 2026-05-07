import { Disc3 } from 'lucide-react'

interface AlbumCardProps {
  title: string
  description?: string | null
  songCount: number
  coverUrl?: string | null
  onClick?: () => void
}

export function AlbumCard({ title, description, songCount, coverUrl, onClick }: AlbumCardProps) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-3 aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <Disc3 className="h-12 w-12 text-muted-foreground" />
        )}
      </div>
      <h3 className="font-semibold leading-tight">{title}</h3>
      {description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{description}</p>}
      <p className="mt-2 text-xs text-muted-foreground">{songCount} 首歌曲</p>
    </div>
  )
}
