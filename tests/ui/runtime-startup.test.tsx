import { act, cleanup, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppPortProvider } from '@/app/app-context'
import { StartupLayer } from '@/app/runtime'
import { SPLASH_SESSION_KEY } from '@/app/splash-state'

import { TestUiPort } from './test-port'

function renderStartup(port: TestUiPort, onContentReady = vi.fn()) {
  const view = render(
    <StrictMode>
      <AppPortProvider port={port}>
        <StartupLayer onContentReady={onContentReady} />
      </AppPortProvider>
    </StrictMode>,
  )
  return { onContentReady, view }
}

describe('StartupLayer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.sessionStorage.clear()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reveals a timed seal, announces ready once, and records the session', async () => {
    const { onContentReady } = renderStartup(new TestUiPort())

    await act(async () => vi.advanceTimersByTime(0))
    expect(screen.getByText('ホームを開いています')).toBeTruthy()
    expect(onContentReady).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTime(900))
    expect(screen.queryByText('ホームを開いています')).toBeNull()
    expect(onContentReady).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(SPLASH_SESSION_KEY)).toBe('true')

    await act(async () => vi.advanceTimersByTime(300))
    expect(onContentReady).toHaveBeenCalledTimes(1)
  })

  it('does not restart its clock when the readiness callback changes', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const port = new TestUiPort()
    const { view } = renderStartup(port, first)

    await act(async () => vi.advanceTimersByTime(400))
    view.rerender(
      <StrictMode>
        <AppPortProvider port={port}>
          <StartupLayer onContentReady={second} />
        </AppPortProvider>
      </StrictMode>,
    )
    await act(async () => vi.advanceTimersByTime(500))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('waits honestly for a slow bootstrap and completes when it becomes ready', async () => {
    const port = new TestUiPort({
      bootstrap: { phase: '端末内データ', status: 'loading' },
      preferences: {
        ...new TestUiPort().getSnapshot().preferences,
        splashMode: 'off',
      },
    })
    const { onContentReady } = renderStartup(port)

    await act(async () => vi.advanceTimersByTime(0))
    expect(screen.getByRole('heading', { name: 'ホームを準備しています' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '再試行' })).toBeNull()
    expect(onContentReady).not.toHaveBeenCalled()

    await act(async () => port.setBootstrap({ status: 'ready' }))
    await act(async () => vi.advanceTimersByTime(0))
    expect(screen.queryByRole('heading', { name: 'ホームを準備しています' })).toBeNull()
    expect(onContentReady).toHaveBeenCalledTimes(1)
  })

  it('shows failure recovery without reporting content ready', async () => {
    const port = new TestUiPort({
      bootstrap: { message: 'データを確認できません。', status: 'failed' },
      preferences: {
        ...new TestUiPort().getSnapshot().preferences,
        splashMode: 'off',
      },
    })
    const { onContentReady } = renderStartup(port)

    await act(async () => vi.advanceTimersByTime(0))
    expect(screen.getByRole('heading', { name: 'ホームを開けませんでした' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '再試行' })).toBeTruthy()
    expect(onContentReady).not.toHaveBeenCalled()
  })
})
