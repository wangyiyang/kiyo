import './globals.css'

import type { Metadata, Viewport } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kiyo.ai'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'Kiyo',
  // 站点级 metadata 的本地化版本由 [locale]/layout.tsx 中的 generateMetadata 接管
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
  ],
  width: 'device-width',
  initialScale: 1,
}

// 根 layout 故意保持为透明壳：实际的 <html> / <body> 由 [locale]/layout 拥有。
// 这是 next-intl App Router + 动态 locale 路由的官方推荐结构。
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
