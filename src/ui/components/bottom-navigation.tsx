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
import { useCallback, useEffect, useRef, useState } from 'react'

import { useSound } from '@/audio'

import { useReducedMotion } from '../hooks/use-reduced-motion'
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

const LONG_PRESS_MS = 500

function isCurrent(pathname: string, href: string): boolean {
  return href === '/' ? pathname === href : pathname.startsWith(href)
}

interface Ripple {
  readonly href: string
  readonly id: number
  readonly x: number
  readonly y: number
}

/**
 * 決定事項ログ F-11 / F-12 — a transparent operating layer, never an opaque bar.
 * Icons only; the current destination is a soft glow plus a hairline mark, not a
 * colour fill (DESIGN.md §6.4). Press spreads a faint ripple from the point that
 * was touched; names appear on long press, so a first-time user can identify a
 * target without labels living on screen forever.
 */
export function BottomNavigation({ pathname }: { readonly pathname: string }) {
  const reducedMotion = useReducedMotion()
  const play = useSound()
  const [ripples, setRipples] = useState<readonly Ripple[]>([])
  const [hinted, setHinted] = useState<string | null>(null)
  const longPress = useRef<number | undefined>(undefined)
  const rippleId = useRef(0)

  useEffect(
    () => () => {
      if (longPress.current !== undefined) window.clearTimeout(longPress.current)
    },
    [],
  )

  const endLongPress = useCallback(() => {
    if (longPress.current !== undefined) {
      window.clearTimeout(longPress.current)
      longPress.current = undefined
    }
    setHinted(null)
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLAnchorElement>, href: string) => {
      play('navigate')
      const bounds = event.currentTarget.getBoundingClientRect()
      if (!reducedMotion) {
        rippleId.current += 1
        const ripple = {
          href,
          id: rippleId.current,
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        }
        setRipples((current) => [...current, ripple])
      }
      longPress.current = window.setTimeout(() => setHinted(href), LONG_PRESS_MS)
    },
    [play, reducedMotion],
  )

  return (
    <nav className={styles.navigation} aria-label="メインナビゲーション">
      <ul role="list" className={styles.list}>
        {destinations.map(({ href, icon: Icon, label }) => {
          const current = isCurrent(pathname, href)
          return (
            <li key={href} className={styles.item}>
              <Link
                className={styles.destination}
                data-current={current ? '' : undefined}
                href={href}
                prefetch={false}
                aria-current={current ? 'page' : undefined}
                aria-label={label}
                onPointerDown={(event) => handlePointerDown(event, href)}
                onPointerUp={endLongPress}
                onPointerLeave={endLongPress}
                onPointerCancel={endLongPress}
                onBlur={endLongPress}
                onContextMenu={(event) => event.preventDefault()}
              >
                {ripples
                  .filter((ripple) => ripple.href === href)
                  .map((ripple) => (
                    <span
                      key={ripple.id}
                      className={styles.ripple}
                      style={{ left: `${ripple.x}px`, top: `${ripple.y}px` }}
                      aria-hidden="true"
                      onAnimationEnd={() =>
                        setRipples((current) =>
                          current.filter((entry) => entry.id !== ripple.id),
                        )
                      }
                    />
                  ))}
                <Icon aria-hidden="true" size={21} strokeWidth={1.65} />
                <span className={styles.currentMark} aria-hidden="true" />
              </Link>
              {hinted === href ? (
                <span role="tooltip" className={styles.hint}>
                  {label}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
