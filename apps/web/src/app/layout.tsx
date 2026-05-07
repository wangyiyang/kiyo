import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kiyo',
  description: 'AI音乐创作平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
