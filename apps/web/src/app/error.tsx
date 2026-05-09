'use client'

import { useEffect } from 'react'
import { Button } from '@kiyo/ui'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error boundary caught:', error)
    }
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        
        <h1 className="text-2xl font-bold">出错了</h1>
        <p className="mt-2 text-muted-foreground">
          抱歉，发生了意外错误。
        </p>
        
        <div className="mt-8 flex justify-center gap-4">
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            <Home className="mr-2 h-4 w-4" />
            返回首页
          </Button>
          <Button onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      </div>
    </div>
  )
}
