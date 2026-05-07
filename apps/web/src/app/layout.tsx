import type { Metadata, Viewport } from 'next'
import { Noto_Sans_SC } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Toaster } from '@kiyo/ui'

import { Providers } from './providers'
import { WaitlistDialog } from '@/components/waitlist-dialog'

import './globals.css'

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sc',
  display: 'swap',
  preload: false,
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kiyo.ai'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Kiyo · 让旋律自由生长',
    template: '%s · Kiyo',
  },
  description: '基于多模型协同的 AI 音乐创作平台,为创作者提供从灵感到成品的一站式工作流。',
  applicationName: 'Kiyo',
  keywords: ['AI 音乐', '音乐创作', 'AI 作曲', 'AI Music', 'Kiyo'],
  openGraph: {
    title: 'Kiyo · 让旋律自由生长',
    description: '基于多模型协同的 AI 音乐创作平台。',
    url: siteUrl,
    siteName: 'Kiyo',
    locale: 'zh_CN',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Kiyo · AI 音乐创作平台',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kiyo · 让旋律自由生长',
    description: '基于多模型协同的 AI 音乐创作平台。',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${notoSansSC.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>
          {children}
          <WaitlistDialog />
          <Toaster richColors closeButton position="top-center" />
        </Providers>
      </body>
    </html>
  )
}
