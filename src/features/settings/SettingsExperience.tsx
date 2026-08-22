'use client'

import {
  BellRing,
  CalendarSync,
  Download,
  HardDrive,
  Mail,
  Music2,
  ShieldCheck,
  Upload,
  Volume2,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

import { useAppPort, useAppReadModel } from '@/app/app-context'
import type {
  ExternalImportResultView,
  ImportPreviewView,
  NotificationView,
  PreferenceView,
} from '@/app/ui-port'
import { useSound } from '@/audio'
import { addLocalDays, todayLocalDate } from '@/features/tasks/local-date'
import { Button } from '@/ui/components/button'
import { Switch } from '@/ui/components/switch'

import styles from './settings-experience.module.css'

/**
 * 決定事項ログ F-3 — Settings collects everything low-frequency: display and
 * motion, sound, notifications, the Google link, data export/import, and app
 * information. Everyday actions (adding a task, picking an area, reading the
 * catalog) deliberately stay on their own screens, so this page never turns
 * into a general menu.
 */

const SPLASH_CHOICES = [
  { label: '毎回', value: 'always' },
  { label: '最初の1回', value: 'timed' },
  { label: '表示しない', value: 'off' },
] as const

const SCHEME_CHOICES = [
  { label: 'システム', value: 'system' },
  { label: '明るい', value: 'light' },
  { label: '暗い', value: 'dark' },
] as const

const MOTION_CHOICES = [
  { label: 'システム', value: 'system' },
  { label: '標準', value: 'full' },
  { label: '抑える', value: 'reduced' },
] as const

/** How far either side of today a calendar import reaches (決定事項ログ F-4). */
const IMPORT_PAST_DAYS = 7
const IMPORT_FUTURE_DAYS = 60

export function SettingsExperience() {
  const port = useAppPort()
  const { googleLink, migrationAvailable, notifications, preferences, storageHealth } =
    useAppReadModel()
  const [message, setMessage] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreviewView | null>(null)
  const [busy, setBusy] = useState(false)
  const filePicker = useRef<HTMLInputElement>(null)
  const play = useSound()

  function update(patch: Partial<PreferenceView>): void {
    setMessage(null)
    void port.updatePreferences(patch)
  }

  /**
   * Every action here is a promise that can reject, and a setting that fails
   * silently is worse than one that refuses out loud. A single guard reports
   * the outcome of all of them, so no branch can swallow a rejection.
   */
  async function run(action: () => Promise<string>): Promise<void> {
    setBusy(true)
    try {
      setMessage(await action())
    } catch {
      setMessage('操作を完了できませんでした。データは変更していません。')
      play('error')
    } finally {
      setBusy(false)
    }
  }

  async function toggleNotifications(enabled: boolean): Promise<void> {
    play(enabled ? 'toggleOn' : 'toggleOff')
    await run(async () => {
      if (!enabled) {
        await port.setNotificationsEnabled(false)
        return '通知を止めました。'
      }
      const permission =
        notifications.permission === 'granted'
          ? 'granted'
          : await port.requestNotificationPermission()
      if (permission !== 'granted') {
        return permission === 'denied'
          ? 'ブラウザ側で通知がブロックされています。サイトの設定から許可してください。'
          : 'この端末では通知を使えません。'
      }
      await port.setNotificationsEnabled(true)
      return '通知を有効にしました。'
    })
  }

  function describeImport(result: ExternalImportResultView, source: string): string {
    if (result.cancelled) return `${source}の取り込みを中止しました。`
    if (result.reason !== undefined) return result.reason
    const skipped = result.skipped > 0 ? `（重複 ${result.skipped}件は取り込みません）` : ''
    return `${source}から ${result.imported}件を取り込みました。${skipped}`
  }

  async function prepareImport(file: File | undefined): Promise<void> {
    if (file === undefined) return
    setImportPreview(null)
    await run(async () => {
      const preview = await port.prepareImport(await file.text())
      setImportPreview(preview)
      if (filePicker.current !== null) filePicker.current.value = ''
      return preview.available
        ? '検証に合格しました。件数を確認してから復元してください。'
        : (preview.issue ?? 'バックアップを検証できませんでした。')
    })
  }

  async function activateImport(): Promise<void> {
    const runId = importPreview?.runId
    if (importPreview?.available !== true || runId === undefined) return
    await run(async () => {
      const result = await port.activatePreparedImport(runId)
      setImportPreview(null)
      return result.activated
        ? `${result.importedTaskCount}件を復元しました。置き換え前のデータは自動バックアップに残しています。`
        : (result.reason ?? '復元を完了できませんでした。現在のデータは変更していません。')
    })
  }

  const today = todayLocalDate()

  return (
    <main id="main-content" className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>設定</h1>
      </header>

      <Section index="I" title="表示">
        <ChoiceGroup
          name="color-scheme"
          legend="配色"
          hint="端末のテーマに合わせるか、常に片方を使うかを選べます。"
          value={preferences.colorScheme}
          options={SCHEME_CHOICES}
          onChange={(colorScheme) => update({ colorScheme })}
        />
        <ChoiceGroup
          name="motion"
          legend="動き"
          hint="「抑える」を選ぶと、世界の映像と画面遷移が静止に近くなります。音は止まりません。"
          value={preferences.motion}
          options={MOTION_CHOICES}
          onChange={(motion) => update({ motion })}
        />
        <ChoiceGroup
          name="splash-mode"
          legend="起動時の紋章"
          hint="起動直後に短く出る、文字のない紋章です。"
          value={preferences.splashMode}
          options={SPLASH_CHOICES}
          onChange={(splashMode) => update({ splashMode })}
        />
      </Section>

      <Section index="II" title="音">
        <div className={styles.switches}>
          <Switch
            checked={preferences.bgmEnabled}
            label={
              <span className={styles.switchLabel}>
                <Music2 aria-hidden="true" size={18} strokeWidth={1.6} />
                BGMと環境音
              </span>
            }
            description="グリモの画面でのみ流れます。"
            onChange={(checked) => {
              play(checked ? 'toggleOn' : 'toggleOff')
              update({ bgmEnabled: checked })
            }}
          />
          <Switch
            checked={preferences.sfxEnabled}
            label={
              <span className={styles.switchLabel}>
                <Volume2 aria-hidden="true" size={18} strokeWidth={1.6} />
                効果音
              </span>
            }
            description="操作音と、図鑑・グリモの短い音。切っても操作の結果は画面だけで分かります。"
            onChange={(checked) => {
              // The "off" click would be the last thing heard before silence;
              // playing it after the switch has already muted is misleading.
              if (checked) play('toggleOn')
              update({ sfxEnabled: checked })
            }}
          />
        </div>
      </Section>

      <Section index="III" title="通知">
        <div className={styles.switches}>
          <Switch
            checked={notifications.enabled && notifications.permission === 'granted'}
            disabled={notifications.permission === 'unsupported' || busy}
            label={
              <span className={styles.switchLabel}>
                <BellRing aria-hidden="true" size={18} strokeWidth={1.6} />
                時刻付きタスクの通知
              </span>
            }
            description={notificationDescription(notifications.permission)}
            onChange={(checked) => void toggleNotifications(checked)}
          />
        </div>
        {notifications.enabled && notifications.scheduledCount > 0 ? (
          <p className={styles.note}>予約中の通知 {notifications.scheduledCount}件</p>
        ) : null}
      </Section>

      <Section index="IV" title="Google 連携">
        {googleLink.configured ? (
          <>
            <LinkRow
              icon={<CalendarSync aria-hidden="true" size={18} strokeWidth={1.6} />}
              title="Google カレンダー"
              detail={
                googleLink.calendarConnected
                  ? `最終取り込み ${formatInstant(googleLink.lastCalendarImportAt)}`
                  : '接続すると、予定を今日と今後のタスクとして取り込めます。'
              }
              connected={googleLink.calendarConnected}
              busy={busy}
              onConnect={() =>
                void run(async () => {
                  const result = await port.connectGoogle('calendar')
                  return result.connected
                    ? 'Google カレンダーに接続しました。'
                    : (result.reason ?? '接続を完了できませんでした。')
                })
              }
              onDisconnect={() =>
                void run(async () => {
                  await port.disconnectGoogle('calendar')
                  return '接続を解除しました。取り込み済みの予定は残ります。'
                })
              }
              onImport={() =>
                void run(async () =>
                  describeImport(
                    await port.importFromGoogleCalendar({
                      fromLocalDate: addLocalDays(today, -IMPORT_PAST_DAYS),
                      toLocalDate: addLocalDays(today, IMPORT_FUTURE_DAYS),
                    }),
                    'カレンダー',
                  ),
                )
              }
              importLabel={`前後 ${IMPORT_PAST_DAYS}／${IMPORT_FUTURE_DAYS}日を取り込む`}
            />
            <LinkRow
              icon={<Mail aria-hidden="true" size={18} strokeWidth={1.6} />}
              title="Gmail"
              detail={
                googleLink.gmailConnected
                  ? `最終取り込み ${formatInstant(googleLink.lastGmailImportAt)}`
                  : '接続すると、締切を含むメールからタスクの候補を作れます。'
              }
              connected={googleLink.gmailConnected}
              busy={busy}
              onConnect={() =>
                void run(async () => {
                  const result = await port.connectGoogle('gmail')
                  return result.connected
                    ? 'Gmail に接続しました。'
                    : (result.reason ?? '接続を完了できませんでした。')
                })
              }
              onDisconnect={() =>
                void run(async () => {
                  await port.disconnectGoogle('gmail')
                  return '接続を解除しました。取り込み済みのタスクは残ります。'
                })
              }
              onImport={() =>
                void run(async () => describeImport(await port.importFromGmail(), 'Gmail'))
              }
              importLabel="新しいメールを確認する"
            />
          </>
        ) : (
          <p className={styles.note}>
            この配信では Google 連携が構成されていません。使うには
            NEXT_PUBLIC_GOOGLE_CLIENT_ID を設定して再ビルドしてください。
          </p>
        )}
      </Section>

      <Section index="V" title="データ">
        <dl className={styles.health}>
          <div>
            <dt>保存形式</dt>
            <dd>{storageHealth.databaseVersion}</dd>
          </div>
          <div>
            <dt>使用量</dt>
            <dd>{formatBytes(storageHealth.usageBytes)}</dd>
          </div>
          <div>
            <dt>端末での保持</dt>
            <dd>
              {
                {
                  granted: '保護されています',
                  'not-granted': '未許可',
                  unknown: '未確認',
                }[storageHealth.persistence]
              }
            </dd>
          </div>
          <div>
            <dt>最後の書き出し</dt>
            <dd>{formatInstant(storageHealth.lastExportAt)}</dd>
          </div>
        </dl>

        <div className={styles.actions}>
          <Button
            icon={<ShieldCheck aria-hidden="true" size={17} strokeWidth={1.6} />}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const granted = await port.requestPersistentStorage()
                return granted
                  ? 'この端末でデータが保護されるようになりました。'
                  : 'ブラウザが保持を許可しませんでした。時々書き出しておくと安全です。'
              })
            }
          >
            端末での保持を確認
          </Button>
          <Button
            icon={<Download aria-hidden="true" size={17} strokeWidth={1.6} />}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const result = await port.exportData()
                return result.available
                  ? '書き出しました。'
                  : (result.reason ?? '現在は書き出せません。')
              })
            }
          >
            書き出す
          </Button>
          <Button
            icon={<Upload aria-hidden="true" size={17} strokeWidth={1.6} />}
            disabled={busy}
            onClick={() => filePicker.current?.click()}
          >
            読み込む
          </Button>
          <input
            ref={filePicker}
            className={styles.filePicker}
            type="file"
            accept="application/json,.json"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void prepareImport(event.target.files?.[0])}
          />
        </div>

        {importPreview?.available === true ? (
          <div className={styles.preview} role="group" aria-label="読み込み内容の確認">
            <p className={styles.previewCopy}>
              タスク {importPreview.taskCount}件・記録 {importPreview.rewardCount}件で
              置き換えます。今のデータは先に自動で控えを取ります。
            </p>
            <Button tone="danger" disabled={busy} onClick={() => void activateImport()}>
              置き換えて復元
            </Button>
          </div>
        ) : null}

        <div className={styles.legacy}>
          <p className={styles.note}>
            {migrationAvailable
              ? '以前のバージョンのデータが見つかりました。今のデータを変えずに移せます。'
              : '以前のバージョンから移せるデータはありません。'}
          </p>
          <Button
            icon={<HardDrive aria-hidden="true" size={17} strokeWidth={1.6} />}
            disabled={!migrationAvailable || busy}
            onClick={() =>
              void run(async () => {
                const result = await port.migrateLegacyData()
                return result.migrated
                  ? `${result.migratedTaskCount}件を移行しました。移行前のデータも残しています。`
                  : (result.reason ?? '移行対象がありませんでした。')
              })
            }
          >
            移行する
          </Button>
        </div>
      </Section>

      <Section index="VI" title="このアプリについて">
        <p className={styles.about}>
          Grimoire の記録はこの端末のブラウザ内にだけ保存されます。外へ出るのは、
          あなたが Google 連携を自分で接続したときの、その取り込みだけです。
          ブラウザの保存領域は永久ではないので、大切な記録は時々書き出してください。
        </p>
      </Section>

      <p className={styles.status} role="status" aria-live="polite">
        {message ?? ''}
      </p>
    </main>
  )
}

function Section({
  children,
  index,
  title,
}: {
  readonly children: ReactNode
  readonly index: string
  readonly title: string
}) {
  return (
    <section className={styles.section} aria-labelledby={`section-${index}`}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIndex} aria-hidden="true">
          {index}
        </span>
        <h2 id={`section-${index}`} className={styles.sectionTitle}>
          {title}
        </h2>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

/**
 * A segmented preference built on native radios: arrow-key navigation, roving
 * focus and group semantics all come from the browser. Styling a real radio is
 * a smaller cost than re-implementing a radiogroup by hand.
 */
function ChoiceGroup<Value extends string>({
  hint,
  legend,
  name,
  onChange,
  options,
  value,
}: {
  readonly hint?: string
  readonly legend: string
  readonly name: string
  readonly onChange: (value: Value) => void
  readonly options: readonly { readonly label: string; readonly value: Value }[]
  readonly value: Value
}) {
  return (
    <fieldset className={styles.choice}>
      <legend className={styles.choiceLegend}>{legend}</legend>
      <div className={styles.choiceOptions}>
        {options.map((option) => (
          <label key={option.value} className={styles.choiceOption}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {hint === undefined ? null : <p className={styles.choiceHint}>{hint}</p>}
    </fieldset>
  )
}

function LinkRow({
  busy,
  connected,
  detail,
  icon,
  importLabel,
  onConnect,
  onDisconnect,
  onImport,
  title,
}: {
  readonly busy: boolean
  readonly connected: boolean
  readonly detail: string
  readonly icon: ReactNode
  readonly importLabel: string
  readonly onConnect: () => void
  readonly onDisconnect: () => void
  readonly onImport: () => void
  readonly title: string
}) {
  return (
    <div className={styles.link}>
      <div className={styles.linkText}>
        <p className={styles.linkTitle}>
          <span className={styles.linkIcon} aria-hidden="true">
            {icon}
          </span>
          {title}
        </p>
        <p className={styles.linkDetail}>{detail}</p>
      </div>
      <div className={styles.linkActions}>
        {connected ? (
          <>
            <Button disabled={busy} onClick={onImport}>
              {importLabel}
            </Button>
            <Button tone="quiet" disabled={busy} onClick={onDisconnect}>
              解除
            </Button>
          </>
        ) : (
          <Button disabled={busy} onClick={onConnect}>
            接続する
          </Button>
        )}
      </div>
    </div>
  )
}

function notificationDescription(permission: NotificationView['permission']): string {
  if (permission === 'unsupported') return 'この端末のブラウザは通知に対応していません。'
  if (permission === 'denied')
    return 'ブラウザ側でブロックされています。サイトの設定から許可してください。'
  if (permission === 'default') return '有効にすると、ブラウザの許可を一度だけ求めます。'
  return '時刻を決めたタスクだけ、その時刻に一度知らせます。'
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '未計測'
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

function formatInstant(instant: string | null): string {
  if (instant === null) return 'まだありません'
  const date = new Date(instant)
  if (Number.isNaN(date.getTime())) return 'まだありません'
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`
}
