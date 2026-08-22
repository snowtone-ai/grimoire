'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useEffectEvent, useState } from 'react'

import { SoundProvider, useSound } from '@/audio'
import { BottomNavigation, screenNameFor } from '@/ui/components/bottom-navigation'
import { Button } from '@/ui/components/button'
import { Sheet } from '@/ui/components/sheet'
import { useReducedMotion } from '@/ui/hooks/use-reduced-motion'
import type { SplashDisplayMode } from '@/ui/tokens'
import { loadWorldMediaManifest, type WorldMediaEntry } from '@/world/media-manifest'

import { AppPortProvider, useAppPort, useAppReadModel } from './app-context'
import { SPLASH_PREFERENCE_CACHE_KEY } from './durable-ui-port'
import styles from './runtime.module.css'
import type { RewardNoticeView } from './ui-port'
import { getSplashDuration, shouldDisplaySplash, SPLASH_SESSION_KEY } from './splash-state'

type StartupState = 'checking' | 'content' | 'loading' | 'splash'

/**
 * The opening footage (D-013) is owner-supplied and may not exist yet, so the
 * splash has two bodies: the video when one has been delivered, and the
 * wordless emblem otherwise. Neither one is allowed to extend startup — the
 * window is still the 900 ms / 1200 ms hard cap in `splash-state.ts`, and a
 * longer clip is simply cut off at that point rather than waited on.
 */
function SplashBody({ footage }: { readonly footage: WorldMediaEntry | null }) {
  const reducedMotion = useReducedMotion()

  if (footage !== null && !reducedMotion) {
    return (
      <video
        className={styles.splashFootage}
        poster={footage.poster ?? undefined}
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      >
        {footage.sources.map((source) => (
          <source key={source.src} src={source.src} type={source.type} />
        ))}
      </video>
    )
  }

  return (
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
  )
}

export function StartupLayer({ onContentReady }: { readonly onContentReady: () => void }) {
  const port = useAppPort()
  const screen = screenNameFor(usePathname())
  const { bootstrap, preferences } = useAppReadModel()
  const [state, setState] = useState<StartupState>('checking')
  const [footage, setFootage] = useState<WorldMediaEntry | null>(null)
  const readLaunchPreferences = useEffectEvent(() => preferences)
  const notifyContentReady = useEffectEvent(onContentReady)

  // Fetched, not awaited: if the manifest arrives after the splash has closed,
  // the emblem was the right thing to show and nothing was delayed for it.
  useEffect(() => {
    const controller = new AbortController()
    void loadWorldMediaManifest(controller.signal).then((manifest) =>
      setFootage(manifest.splash),
    )
    return () => controller.abort()
  }, [])

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
        {/* Not a heading: this layer sits over a screen that has its own <h1>,
            and two of them in one document is a document with no main heading.
            `role="status"` is what carries the text to a screen reader; the
            visual weight comes from the class either way. It also names the
            screen being prepared rather than always claiming to be Home. */}
        <p className={styles.loadingTitle}>
          {failed ? `${screen}を開けませんでした` : `${screen}を準備しています`}
        </p>
        <p className={styles.loadingCopy}>
          {failed
            ? bootstrap.message
            : bootstrap.status === 'loading'
              ? `${bootstrap.phase}を確認中です。`
              : '起動状態をもう一度確認します。'}
        </p>
        {failed ? (
          <Button onClick={() => void port.retryBootstrap()}>再試行</Button>
        ) : null}
      </section>
    )
  }

  return (
    <div className={styles.splash} role="status" aria-live="polite">
      <span className="sr-only">ホームを開いています</span>
      {state === 'splash' ? <SplashBody footage={footage} /> : null}
    </div>
  )
}

const MINI_NOTICE_MS = 3_600

/**
 * 決定事項ログ M-4 — a first discovery earns the sheet with the full plate and
 * the whole description; everything already collected, and every reward from
 * simply writing a task, stays a small notice near the list. The daily loop is
 * never interrupted by a celebration it has already seen.
 */
function RewardPresentation({ notice }: { readonly notice: RewardNoticeView }) {
  const port = useAppPort()
  const play = useSound()

  useEffect(() => {
    play('discovery')
  }, [notice.id, play])

  useEffect(() => {
    if (notice.presentation !== 'mini') return
    const timer = window.setTimeout(() => void port.dismissRewardNotice(), MINI_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice.id, notice.presentation, port])

  if (notice.presentation === 'mini') {
    return (
      <aside className={styles.miniNotice} aria-live="polite">
        <Image
          className={styles.miniArt}
          src={notice.artSrc}
          alt=""
          width={40}
          height={40}
        />
        <span className={styles.miniText}>
          <span className={styles.miniName}>{notice.name}</span>
          <span className={styles.miniLine}>
            {notice.collapsedCount > 0
              ? `ほか ${notice.collapsedCount}件と一緒に図鑑へ`
              : '図鑑に加わりました'}
          </span>
        </span>
      </aside>
    )
  }

  return (
    <Sheet
      open
      title={notice.name}
      description="はじめて見つけました。"
      onClose={() => void port.dismissRewardNotice()}
    >
      <div className={styles.rewardBody}>
        <Image
          className={styles.rewardPlate}
          src={notice.artSrc}
          alt={notice.artAlt}
          width={220}
          height={220}
          priority
        />
        <p className={styles.rewardDescription}>{notice.description}</p>
        {notice.collapsedCount > 0 ? (
          <p className={styles.rewardMeta}>
            ほか {notice.collapsedCount}件も図鑑へ記録しました。
          </p>
        ) : null}
      </div>
    </Sheet>
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
    root.dataset.theme =
      pathname.startsWith('/grimo') || pathname.startsWith('/catalog')
        ? 'natural-history'
        : 'order'
    if (preferences.colorScheme === 'system') delete root.dataset.colorScheme
    else root.dataset.colorScheme = preferences.colorScheme
    if (preferences.motion === 'system') delete root.dataset.motion
    else root.dataset.motion = preferences.motion
  }, [pathname, preferences.colorScheme, preferences.motion])

  return (
    <SoundProvider sfxEnabled={preferences.sfxEnabled}>
      <div className={styles.appSurface}>{children}</div>
      <BottomNavigation pathname={pathname} />
      <StartupLayer onContentReady={handleContentReady} />
      {contentReady && rewardNotice !== null ? (
        <RewardPresentation key={rewardNotice.id} notice={rewardNotice} />
      ) : null}
      {contentReady && pathname === '/' && migrationNoticeVisible ? (
        <MigrationNotice onDismiss={() => void port.acknowledgeMigrationNotice()} />
      ) : null}
      {/* Names the screen that actually opened. A fixed string here announced
          "ホームを開きました" on the settings screen — the one message a screen
          reader user has no way to check against what is on the display. */}
      <span className="sr-only" aria-live="polite">
        {contentReady ? `${screenNameFor(pathname)}を開きました` : ''}
      </span>
    </SoundProvider>
  )
}

function MigrationNotice({ onDismiss }: { readonly onDismiss: () => void }) {
  return (
    <aside className={styles.migrationNotice} aria-labelledby="migration-title">
      <div>
        <h2 id="migration-title" className={styles.migrationTitle}>
          以前のタスクが見つかりました
        </h2>
        <p className={styles.migrationCopy}>
          今のデータは変えずに、内容と控えの取り方を先に確認できます。
        </p>
      </div>
      <div className={styles.migrationActions}>
        <Button tone="quiet" onClick={onDismiss}>
          後で
        </Button>
        <Link className={styles.migrationLink} href="/settings" prefetch={false}>
          移行を確認
        </Link>
      </div>
    </aside>
  )
}

export function AppRuntime({ children }: { readonly children: ReactNode }) {
  return (
    <AppPortProvider>
      <RuntimeContent>{children}</RuntimeContent>
    </AppPortProvider>
  )
}
