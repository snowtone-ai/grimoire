'use client'

import {
  BookOpen,
  CalendarDays,
  Home,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import type { Route } from 'next'

import styles from './bottom-navigation.module.css'

interface Destination {
  readonly href: Route
  readonly icon: LucideIcon
  readonly label: string
}

const destinations: readonly Destination[] = [
  { href: '/', icon: Home, label: 'ホーム' },
  { href: '/calendar', icon: CalendarDays, label: 'カレンダー' },
  { href: '/grimo', icon: Sparkles, label: 'グリモ' },
  { href: '/catalog', icon: BookOpen, label: '図鑑' },
  { href: '/settings', icon: Settings, label: '設定' },
]

function isCurrent(pathname: string, href: string): boolean {
  return href === '/' ? pathname === href : pathname.startsWith(href)
}

export function BottomNavigation({ pathname }: { readonly pathname: string }) {
  return (
    <nav className={styles.navigation} aria-label="メインナビゲーション">
      <ul role="list" className={styles.list}>
        {destinations.map(({ href, icon: Icon, label }) => {
          const current = isCurrent(pathname, href)
          return (
            <li key={href}>
              <Link
                className={styles.destination}
                data-current={current ? '' : undefined}
                href={href}
                prefetch={false}
                aria-current={current ? 'page' : undefined}
                aria-label={label}
                title={label}
              >
                <Icon aria-hidden="true" size={21} strokeWidth={1.65} />
                <span className={styles.currentMark} aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
