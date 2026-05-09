import { Button } from '@kiyo/ui'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

type ErrorBoundaryPageProps = {
  error: Error & { digest?: string }
  reset: () => void
  homeHref: string
}

export function ErrorBoundaryPage({
  error,
  reset,
  homeHref,
}: ErrorBoundaryPageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <section className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold">出错了</h1>
        <p className="mt-2 text-muted-foreground">
          抱歉，页面发生了意外错误。你可以重试或返回首页。
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-muted-foreground">
            错误 ID: {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            重试
          </Button>
          <Button variant="outline" asChild>
            <a href={homeHref}>
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              返回首页
            </a>
          </Button>
        </div>
      </section>
    </main>
  )
}