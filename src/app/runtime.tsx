'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'

import { BottomNavigation } from '@/ui/components/bottom-navigation'
import type { SplashDisplayMode } from '@/ui/tokens'

import { AppPortProvider, useAppPort, useAppReadModel } from './app-context'
import { SPLASH_PREFERENCE_CACHE_KEY } from './durable-ui-port'
import styles from './runtime.module.css'
import type { RewardNoticeView } from './ui-port'
import {
  getSplashDuration,
  shouldDisplaySplash,
  SPLASH_SESSION_KEY,
} from './splash-state'

type StartupState = 'checking' | 'content' | 'loading' | 'splash'

export function StartupLayer({ onContentReady }: { readonly onContentReady: () => void }) {
  const port = useAppPort()
  const { bootstrap, preferences } = useAppReadModel()
  const [state, setState] = useState<StartupState>('checking')
  const readLaunchPreferences = useEffectEvent(() => preferences)
  const notifyContentReady = useEffectEvent(onContentReady)

  useEffect(() => {
    const storedSplashMode = window.localStorage.getItem(SPLASH_PREFERENCE_CACHE_KEY)
    const cachedSplashMode: SplashDisplayMode | undefined =
      storedSplashMode === 'off' || storedSplashMode === 'timed' || storedSplashMode === 'always'
        ? storedSplashMode
        : undefined
    const launchPreferences = {
      ...readLaunchPreferences(),
      ...(cachedSplashMode === undefined ? {} : { splashMode: cachedSplashMode }),
    }
    const reducedByOs = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const reduced =
      launchPreferences.motion === 'reduced' ||
      (launchPreferences.motion === 'system' && reducedByOs)
    const timedWasShown = window.sessionStorage.getItem(SPLASH_SESSION_KEY) === 'true'
    const showSplash = shouldDisplaySplash(launchPreferences.splashMode, timedWasShown)
    const duration = showSplash
      ? getSplashDuration(launchPreferences.splashMode, reduced)
      : 0

    const revealTimer = window.setTimeout(() => {
      if (duration > 0) setState('splash')
    }, 0)
    const displayTimer = window.setTimeout(() => {
      const currentBootstrap = port.getSnapshot().bootstrap
      setState(currentBootstrap.status === 'ready' ? 'content' : 'loading')
      if (showSplash && launchPreferences.splashMode === 'timed') {
        window.sessionStorage.setItem(SPLASH_SESSION_KEY, 'true')
      }
      if (currentBootstrap.status === 'ready') notifyContentReady()
    }, duration)

    return () => {
      window.clearTimeout(revealTimer)
      window.clearTimeout(displayTimer)
    }
  }, [port])

  useEffect(() => {
    if (state !== 'loading' || bootstrap.status !== 'ready') return
    const readyTimer = window.setTimeout(() => {
      setState('content')
      notifyContentReady()
    }, 0)
    return () => window.clearTimeout(readyTimer)
  }, [bootstrap.status, state])

  if (state === 'content') return null

  if (state === 'loading') {
    const failed = bootstrap.status === 'failed'
    return (
      <section className={styles.loading} role="status" aria-live="polite">
        <p className={styles.eyebrow}>{failed ? '起動の確認' : '起動準備'}</p>
        <h1>{failed ? 'ホームを開けませんでした' : 'ホームを準備しています'}</h1>
        <p>
          {failed
            ? bootstrap.message
            : bootstrap.status === 'loading'
              ? `${bootstrap.phase}を確認中です。`
              : '起動状態をもう一度確認します。'}
        </p>
        {failed ? (
          <button type="button" className={styles.retryButton} onClick={() => void port.retryBootstrap()}>
            再試行
          </button>
        ) : null}
      </section>
    )
  }

  return (
    <div className={styles.splash} role="status" aria-live="polite">
      <span className="sr-only">ホームを開いています</span>
      {state === 'splash' ? (
        <div className={styles.sealStage} aria-hidden="true">
          <span className={styles.orbit} />
          <Image
            className={styles.seal}
            src="/brand/grimoire-seal-inverse.svg"
            alt=""
            width={160}
            height={160}
            priority
          />
        </div>
      ) : null}
    </div>
  )
}

function RewardPresentation({ notice }: { readonly notice: RewardNoticeView }) {
  const port = useAppPort()
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (notice.presentation !== 'mini') return
    const timer = window.setTimeout(() => void port.dismissRewardNotice(), 3_600)
    return () => window.clearTimeout(timer)
  }, [notice.id, notice.presentation, port])

  useEffect(() => {
    if (notice.presentation !== 'sheet') return
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    closeButton.current?.focus()
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void port.dismissRewardNotice()
    }
    window.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.documentElement.style.overflow = previousOverflow
      window.removeEventListener('keydown', dismissOnEscape)
    }
  }, [notice.id, notice.presentation, port])

  if (notice.presentation === 'mini') {
    return (
      <aside className={styles.rewardToast} aria-label="獲得した標本" aria-live="polite">
        <Image src={notice.artSrc} alt="" width={44} height={44} />
        <div>
          <p>{notice.kind === 'created' ? '記した報酬' : '完了の報酬'}</p>
          <strong>{notice.name}</strong>
          <small>{notice.description}</small>
          {notice.collapsedCount > 0 ? <span>ほか {notice.collapsedCount}件</span> : null}
        </div>
        <button type="button" onClick={() => void port.dismissRewardNotice()} aria-label="獲得表示を閉じる">×</button>
      </aside>
    )
  }

  return (
    <div
      className={styles.rewardBackdrop}
      role="presentation"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) void port.dismissRewardNotice()
      }}
    >
      <section className={styles.rewardSheet} role="dialog" aria-modal="true" aria-labelledby="reward-title">
        <button
          ref={closeButton}
          className={styles.rewardClose}
          type="button"
          onClick={() => void port.dismissRewardNotice()}
          aria-label="初発見を閉じる"
        >
          ×
        </button>
        <div className={styles.rewardPlate}>
          <Image src={notice.artSrc} alt={notice.artAlt} width={180} height={180} />
        </div>
        <div className={styles.rewardCopy}>
          <p className={styles.eyebrow}>FIRST OBSERVATION</p>
          <h2 id="reward-title">{notice.name}</h2>
          <p>{notice.description}</p>
          {notice.collapsedCount > 0 ? <small>ほか {notice.collapsedCount}件も図鑑へ記録しました。</small> : null}
        </div>
      </section>
    </div>
  )
}

function RuntimeContent({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname()
  const port = useAppPort()
  const { migrationNoticeVisible, preferences, rewardNotice } = useAppReadModel()
  const [contentReady, setContentReady] = useState(false)
  const handleContentReady = useCallback(() => setContentReady(true), [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = pathname.startsWith('/grimo') || pathname.startsWith('/catalog')
      ? 'natural-history'
      : 'order'
    if (preferences.colorScheme === 'system') delete root.dataset.colorScheme
    else root.dataset.colorScheme = preferences.colorScheme
    if (preferences.motion === 'system') delete root.dataset.motion
    else root.dataset.motion = preferences.motion
  }, [pathname, preferences.colorScheme, preferences.motion])

  return (
    <>
      <div className={styles.mistBeam} aria-hidden="true" />
      <div className={styles.appSurface}>{children}</div>
      <BottomNavigation pathname={pathname} />
      <StartupLayer onContentReady={handleContentReady} />
      {contentReady && rewardNotice ? <RewardPresentation notice={rewardNotice} /> : null}
      {contentReady && pathname === '/' && migrationNoticeVisible ? (
        <section className={styles.migrationSheet} aria-labelledby="migration-title">
          <div>
            <p className={styles.eyebrow}>OLD RECORDS</p>
            <h2 id="migration-title">以前のタスクが見つかりました</h2>
            <p>
              今のデータを変更せず、内容とバックアップ手順を先に確認できます。
            </p>
          </div>
          <div className={styles.migrationActions}>
            <button type="button" onClick={() => void port.acknowledgeMigrationNotice()}>
              後で
            </button>
            <Link href="/settings#data" prefetch={false}>移行を確認</Link>
          </div>
        </section>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {contentReady ? 'ホームを開きました' : ''}
      </span>
    </>
  )
}

export function AppRuntime({ children }: { readonly children: ReactNode }) {
  return (
    <AppPortProvider>
      <RuntimeContent>{children}</RuntimeContent>
    </AppPortProvider>
  )
}
