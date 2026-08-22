'use client'

import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

import styles from './button.module.css'

/**
 * DESIGN.md §6.1 — Control.
 *
 * `solid` and `outline` are both Iron; `committed` is the one filled colour the
 * system allows, and only for a state that has actually committed (§1.1). There
 * is deliberately no "primary colour" variant: if a screen wants one, the screen
 * has a hierarchy problem, not a missing variant.
 */
export type ButtonTone = 'committed' | 'danger' | 'outline' | 'quiet' | 'solid'

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  readonly children: ReactNode
  /** Fills the inline axis of its container. */
  readonly block?: boolean
  readonly icon?: ReactNode
  readonly ref?: Ref<HTMLButtonElement>
  readonly tone?: ButtonTone
}

export function Button({
  block = false,
  children,
  icon,
  ref,
  tone = 'outline',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={styles.control}
      data-tone={tone}
      data-block={block ? '' : undefined}
    >
      {icon === undefined ? null : (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={styles.label}>{children}</span>
    </button>
  )
}
