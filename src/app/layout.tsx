import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import '@/styles/globals.css'

import { AppRuntime } from './runtime'
import { ServiceWorkerRegistration } from './service-worker-registration'

export const metadata: Metadata = {
  title: {
    default: 'Grimoire',
    template: '%s | Grimoire',
  },
  description: '今日の行動が、静かな世界の発見につながるタスク管理。',
  applicationName: 'Grimoire',
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: [
      { sizes: '32x32', type: 'image/png', url: '/icons/icon-32.png' },
      { type: 'image/svg+xml', url: '/brand/grimoire-seal.svg' },
    ],
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: '#0d1311',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja" data-theme="order" suppressHydrationWarning>
      <body>
        <a className="sr-only" href="#main-content">
          本文へ移動
        </a>
        <ServiceWorkerRegistration />
        <AppRuntime>{children}</AppRuntime>
      </body>
    </html>
  )
}
