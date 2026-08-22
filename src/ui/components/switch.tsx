'use client'

import { useId, type ReactNode } from 'react'

import styles from './switch.module.css'

export interface SwitchProps {
  readonly checked: boolean
  readonly description?: ReactNode
  readonly disabled?: boolean
  readonly label: ReactNode
  readonly onChange: (checked: boolean) => void
}

/**
 * A settings toggle. The on-state is an Iron fill, not a colour fill — Mist is
 * reserved for events that committed, and a preference simply being on is not
 * one of those (DESIGN.md §1.1).
 */
export function Switch({
  checked,
  description,
  disabled = false,
  label,
  onChange,
}: SwitchProps) {
  const labelId = useId()
  const descriptionId = `${labelId}-description`

  return (
    <div className={styles.row}>
      <span className={styles.text}>
        <span className={styles.label} id={labelId}>
          {label}
        </span>
        {description === undefined ? null : (
          <span className={styles.description} id={descriptionId}>
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        className={styles.track}
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} aria-hidden="true" />
      </button>
    </div>
  )
}
