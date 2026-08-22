'use client'

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import styles from './field.module.css'

interface FieldShellProps {
  readonly children: (ids: {
    readonly describedBy: string | undefined
    readonly id: string
    readonly invalid: boolean
  }) => ReactNode
  readonly error?: string | undefined
  readonly hint?: string | undefined
  readonly label: string
  /** Hides the label visually but keeps it for assistive technology. */
  readonly labelHidden?: boolean | undefined
}

/**
 * One label, one control, one message slot — wired together so the association
 * cannot be forgotten at a call site. An error replaces the hint rather than
 * stacking below it, keeping the row height stable while a form is corrected.
 */
function FieldShell({ children, error, hint, label, labelHidden = false }: FieldShellProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint
  const describedBy = message === undefined ? undefined : messageId

  return (
    <div className={styles.field}>
      <label className={styles.label} data-hidden={labelHidden ? '' : undefined} htmlFor={id}>
        {label}
      </label>
      {children({ describedBy, id, invalid: error !== undefined })}
      {message === undefined ? null : (
        <p
          className={styles.message}
          data-error={error === undefined ? undefined : ''}
          id={messageId}
        >
          {message}
        </p>
      )}
    </div>
  )
}

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'aria-describedby' | 'aria-invalid' | 'className' | 'id'
>

export interface TextInputProps extends NativeInputProps, Omit<FieldShellProps, 'children'> {
  readonly ref?: Ref<HTMLInputElement>
}

export function TextInput({
  error,
  hint,
  label,
  labelHidden,
  ref,
  ...rest
}: TextInputProps) {
  return (
    <FieldShell error={error} hint={hint} label={label} labelHidden={labelHidden}>
      {({ describedBy, id, invalid }) => (
        <input
          {...rest}
          ref={ref}
          id={id}
          className={styles.input}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </FieldShell>
  )
}

type NativeTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'aria-describedby' | 'aria-invalid' | 'className' | 'id'
>

export interface TextAreaProps extends NativeTextareaProps, Omit<FieldShellProps, 'children'> {
  readonly ref?: Ref<HTMLTextAreaElement>
}

export function TextArea({ error, hint, label, labelHidden, ref, ...rest }: TextAreaProps) {
  return (
    <FieldShell error={error} hint={hint} label={label} labelHidden={labelHidden}>
      {({ describedBy, id, invalid }) => (
        <textarea
          rows={3}
          {...rest}
          ref={ref}
          id={id}
          className={styles.textarea}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </FieldShell>
  )
}

type NativeSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'aria-describedby' | 'aria-invalid' | 'className' | 'id'
>

export interface SelectInputProps extends NativeSelectProps, Omit<FieldShellProps, 'children'> {
  readonly children: ReactNode
  readonly ref?: Ref<HTMLSelectElement>
}

export function SelectInput({
  children,
  error,
  hint,
  label,
  labelHidden,
  ref,
  ...rest
}: SelectInputProps) {
  return (
    <FieldShell error={error} hint={hint} label={label} labelHidden={labelHidden}>
      {({ describedBy, id, invalid }) => (
        <select
          {...rest}
          ref={ref}
          id={id}
          className={styles.select}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        >
          {children}
        </select>
      )}
    </FieldShell>
  )
}
