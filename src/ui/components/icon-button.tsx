'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useCallback, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react'

import { useReducedMotion } from '../hooks/use-reduced-motion'
import styles from './icon-button.module.css'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  /** Required: the control has no visible text. */
  readonly label: string
  readonly icon: ReactNode
  readonly ref?: Ref<HTMLButtonElement>
  /**
   * `chrome` floats over the world with a translucent ground (決定事項ログ F-2);
   * `plain` sits on a normal page surface.
   */
  readonly surface?: 'chrome' | 'plain'
  /** Larger hit area and glyph, for the primary world control. */
  readonly size?: 'md' | 'lg'
}

/**
 * A wordless control. On press it brightens once and then fades, leaving an
 * afterglow rather than lighting up for as long as the finger is down — the same
 * "touch breath" the creature uses (決定事項ログ F-2). Under reduced motion the
 * afterglow is skipped and only the resting/hover states remain.
 */
export function IconButton({
  icon,
  label,
  onPointerDown,
  ref,
  size = 'md',
  surface = 'plain',
  type = 'button',
  ...rest
}: IconButtonProps) {
  const reducedMotion = useReducedMotion()
  const [pulseKey, setPulseKey] = useState(0)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!reducedMotion) setPulseKey((value) => value + 1)
      onPointerDown?.(event)
    },
    [onPointerDown, reducedMotion],
  )

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={styles.control}
      data-surface={surface}
      data-size={size}
      aria-label={label}
      title={label}
      onPointerDown={handlePointerDown}
    >
      {pulseKey === 0 ? null : (
        <span key={pulseKey} className={styles.afterglow} aria-hidden="true" />
      )}
      <span className={styles.glyph} aria-hidden="true">
        {icon}
      </span>
    </button>
  )
}

export interface IconLinkProps {
  readonly href: Route
  readonly icon: ReactNode
  readonly label: string
  readonly size?: 'md' | 'lg'
  readonly surface?: 'chrome' | 'plain'
}

/**
 * The same control as `IconButton`, but for navigation. It exists because an
 * `<a>` may not contain a `<button>`: wrapping one in the other produces markup
 * that assistive technology reports as two nested controls.
 */
export function IconLink({
  href,
  icon,
  label,
  size = 'md',
  surface = 'plain',
}: IconLinkProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={styles.control}
      data-surface={surface}
      data-size={size}
      aria-label={label}
      title={label}
    >
      <span className={styles.glyph} aria-hidden="true">
        {icon}
      </span>
    </Link>
  )
}
