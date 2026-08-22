'use client'

import { useEffect, useEffectEvent, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  )
}

/**
 * The four things every modal surface owes the user, in one place: Escape
 * closes it, Tab cannot leave it, the page behind it does not scroll, and the
 * control that opened it gets focus back on the way out.
 *
 * Implemented with a keydown trap rather than `<dialog showModal()>` because the
 * component tests run in jsdom, and a dialog whose accessibility only works in a
 * real browser is a dialog whose accessibility is never tested.
 */
export function useModalBehaviour(
  containerRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): void {
  // The listener is installed once per open; `useEffectEvent` lets it always
  // call the latest `onClose` without re-installing on every render.
  const close = useEffectEvent(() => onClose())

  useEffect(() => {
    const container = containerRef.current
    if (!open || container === null) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const root = document.documentElement
    const restoreOverflow = root.style.overflow
    root.style.overflow = 'hidden'

    const initial = focusableWithin(container)[0] ?? container
    initial.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = focusableWithin(container)
      if (focusable.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }

      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) return
      const active = document.activeElement

      if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      root.style.overflow = restoreOverflow
      // A sheet can outlive the control that opened it: completing a task moves
      // its row into the collapsed done group, so the checkbox that raised the
      // discovery sheet is already detached when the sheet closes. Calling
      // `focus()` on a detached node does nothing at all and quietly leaves the
      // caret on <body>, restarting a keyboard user at the top of the document.
      if (previouslyFocused !== null && previouslyFocused.isConnected) {
        previouslyFocused.focus()
        return
      }
      document.getElementById('main-content')?.focus()
    }
  }, [containerRef, open])
}
