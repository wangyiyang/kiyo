import { Skeleton } from '@kiyo/ui'

export function GlobalPageSkeleton() {
  return (
    <main
      role="status"
      aria-label="页面加载中"
      className="container mx-auto flex min-h-screen items-center justify-center px-4"
    >
      <section className="w-full max-w-3xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-lg" />
          ))}
        </div>
      </section>
    </main>
  )
}

export function SongsListSkeleton() {
  return (
    <main className="container mx-auto py-8">
      <section role="status" aria-label="歌曲列表加载中">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              data-testid="song-card-skeleton"
              className="rounded-lg border bg-card p-4 shadow-sm"
            >
              <Skeleton className="mb-3 aspect-video w-full rounded-md" />
              <div className="mb-2 flex items-center gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="ml-auto h-3 w-14" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export function AlbumsListSkeleton() {
  return (
    <main className="container mx-auto py-8">
      <section role="status" aria-label="专辑列表加载中">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              data-testid="album-card-skeleton"
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <Skeleton className="mb-3 aspect-square w-full rounded-lg" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}