'use client'

import type { ReactNode } from 'react'

import styles from './chip.module.css'

export interface ChipProps {
  readonly children: ReactNode
  readonly onClick: () => void
  readonly pressed: boolean
  /** A small leading dot, used where a chip stands for a task category. */
  readonly swatch?: string
}

/**
 * A filter chip. Selected is an Iron fill, unselected an Iron hairline — the
 * category's own colour only ever appears as the small swatch, never as the
 * chip's ground, so a row of chips cannot turn into a row of coloured pills.
 */
export function Chip({ children, onClick, pressed, swatch }: ChipProps) {
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {swatch === undefined ? null : (
        <span
          className={styles.swatch}
          style={{ background: swatch }}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}
