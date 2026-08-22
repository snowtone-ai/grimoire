'use client'

import { useId, useRef, type ReactNode } from 'react'

import { useModalBehaviour } from '../hooks/use-modal-behaviour'
import styles from './sheet.module.css'

export interface SheetProps {
  readonly children: ReactNode
  /** Rendered as the sheet's accessible name and its visible heading. */
  readonly title: string
  /** Optional supporting line under the title. */
  readonly description?: string | undefined
  readonly onClose: () => void
  readonly open: boolean
  /**
   * `bottom` rises from the lower edge (the mobile default, F-9/M-4);
   * `center` is a centred modal for destructive confirmations.
   */
  readonly placement?: 'bottom' | 'center'
  /** Actions pinned below the scrolling body. */
  readonly footer?: ReactNode
}

/**
 * DESIGN.md §6.3 — Sheet: `--radius-sheet`, a mineral top edge, `--ease-settle`
 * entry, Scrim backdrop. The rule "never stacks two sheets" is a caller
 * obligation: a sheet's own content must not open another one.
 */
export function Sheet({
  children,
  description,
  footer,
  onClose,
  open,
  placement = 'bottom',
  title,
}: SheetProps) {
  const surface = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useModalBehaviour(surface, open, onClose)

  if (!open) return null

  return (
    <div
      className={styles.scrim}
      data-placement={placement}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={surface}
        className={styles.surface}
        data-placement={placement}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div className={styles.headings}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description === undefined ? null : (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={`${title}を閉じる`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer === null || footer === undefined ? null : (
          <footer className={styles.footer}>{footer}</footer>
        )}
      </div>
    </div>
  )
}
