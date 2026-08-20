'use client'

import { Database, Download, FileUp, HardDrive, Music2, ShieldCheck, Volume2 } from 'lucide-react'
import { useState } from 'react'

import { useAppPort, useAppReadModel } from '@/app/app-context'
import type { ImportPreviewView, PreferenceView } from '@/app/ui-port'

import styles from './settings-experience.module.css'

const splashOptions = [
  { description: '起動後すぐにホームを開きます。', label: '完全OFF', value: 'off' },
  { description: 'このタブを開いた最初の1回だけ900ms表示します。', label: '一定時間', value: 'timed' },
  { description: '新しく起動するたびに表示します。', label: '毎回', value: 'always' },
] as const

function bytesLabel(bytes: number | null): string {
  if (bytes === null) return '未計測'
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

export function SettingsExperience() {
  const port = useAppPort()
  const { migrationAvailable, preferences, storageHealth } = useAppReadModel()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreviewView | null>(null)

  function update(patch: Partial<PreferenceView>): void {
    setFeedback(null)
    void port.updatePreferences(patch)
  }

  async function requestPersistence(): Promise<void> {
    const granted = await port.requestPersistentStorage()
    setFeedback(granted ? 'この端末で永続ストレージが有効になりました。' : 'データストアの接続後に設定できます。')
  }

  async function exportData(): Promise<void> {
    const result = await port.exportData()
    setFeedback(result.available ? '書き出しが完了しました。' : (result.reason ?? '現在は書き出せません。'))
  }

  async function migrateLegacyData(): Promise<void> {
    setFeedback('以前のデータを検証しています。旧データは削除しません。')
    const result = await port.migrateLegacyData()
    setFeedback(
      result.migrated
        ? `${result.migratedTaskCount}件を移行しました。移行前スナップショットと旧データは残しています。`
        : (result.reason ?? '移行済み、または移行対象がありません。'),
    )
  }

  async function prepareImport(file: File | undefined): Promise<void> {
    if (!file) return
    setImportPreview(null)
    setFeedback('バックアップの形式・ハッシュ・参照関係を検証しています。')
    const preview = await port.prepareImport(await file.text())
    setImportPreview(preview)
    setFeedback(
      preview.available
        ? '検証に合格しました。件数を確認してから復元してください。'
        : (preview.issue ?? 'バックアップを検証できませんでした。'),
    )
  }

  async function activateImport(): Promise<void> {
    if (!importPreview?.available || !importPreview.runId) return
    setFeedback('復元前の自動バックアップを作成し、端末内データを置き換えています。')
    const result = await port.activatePreparedImport(importPreview.runId)
    setImportPreview(null)
    setFeedback(
      result.activated
        ? `${result.importedTaskCount}件を復元しました。置き換え前の自動バックアップを保存しています。`
        : (result.reason ?? '復元を完了できませんでした。現在のデータは変更していません。'),
    )
  }

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>SETTINGS</p>
        <h1>設定</h1>
        <p>日々の静けさと、データの安心をここで整えます。</p>
      </header>

      <div className={styles.settingsBody}>
        <section className={styles.section} aria-labelledby="appearance-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.index}>I</p>
            <div>
              <h2 id="appearance-heading">表示と起動</h2>
              <p>ロゴではなく、文字のない魔導書の紋章を表示します。</p>
            </div>
          </div>

          <fieldset className={styles.choiceGroup}>
            <legend>起動紋章</legend>
            {splashOptions.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="splash-mode"
                  value={option.value}
                  checked={preferences.splashMode === option.value}
                  onChange={() => update({ splashMode: option.value })}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className={styles.segmented}>
            <legend>配色</legend>
            {(['system', 'light', 'dark'] as const).map((scheme) => (
              <label key={scheme}>
                <input
                  type="radio"
                  name="color-scheme"
                  checked={preferences.colorScheme === scheme}
                  onChange={() => update({ colorScheme: scheme })}
                />
                <span>{{ system: 'システム', light: '明るい', dark: '暗い' }[scheme]}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className={styles.segmented}>
            <legend>動き</legend>
            {(['system', 'full', 'reduced'] as const).map((motion) => (
              <label key={motion}>
                <input
                  type="radio"
                  name="motion"
                  checked={preferences.motion === motion}
                  onChange={() => update({ motion })}
                />
                <span>{{ system: 'システム', full: '標準', reduced: '抑える' }[motion]}</span>
              </label>
            ))}
          </fieldset>
        </section>

        <section className={styles.section} aria-labelledby="sound-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.index}>II</p>
            <div>
              <h2 id="sound-heading">音</h2>
              <p>ホームはほぼ無音。世界の音と操作音は別々に選べます。</p>
            </div>
          </div>
          <div className={styles.switchRows}>
            <label>
              <Music2 aria-hidden="true" size={19} />
              <span><strong>BGM・環境音</strong><small>グリモの世界でだけ再生</small></span>
              <input type="checkbox" role="switch" checked={preferences.bgmEnabled} onChange={(event) => update({ bgmEnabled: event.target.checked })} />
            </label>
            <label>
              <Volume2 aria-hidden="true" size={19} />
              <span><strong>効果音</strong><small>操作、素材、グリモの反応</small></span>
              <input type="checkbox" role="switch" checked={preferences.sfxEnabled} onChange={(event) => update({ sfxEnabled: event.target.checked })} />
            </label>
          </div>
        </section>

        <section id="data" className={styles.section} aria-labelledby="data-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.index}>III</p>
            <div>
              <h2 id="data-heading">データと復旧</h2>
              <p>ブラウザ保存を永久バックアップとは表示しません。</p>
            </div>
          </div>

          <dl className={styles.healthGrid}>
            <div><dt><Database aria-hidden="true" size={17} />データ形式</dt><dd>{storageHealth.databaseVersion}</dd></div>
            <div><dt><HardDrive aria-hidden="true" size={17} />使用量</dt><dd>{bytesLabel(storageHealth.usageBytes)}</dd></div>
            <div><dt><ShieldCheck aria-hidden="true" size={17} />永続保存</dt><dd>{{ granted: '有効', 'not-granted': '未許可', unknown: '未確認' }[storageHealth.persistence]}</dd></div>
            <div><dt>保留中の操作</dt><dd>{storageHealth.pendingOperations}件</dd></div>
          </dl>

          <div className={styles.dataActions}>
            <button type="button" onClick={() => void requestPersistence()}>
              <ShieldCheck aria-hidden="true" size={17} /> 永続保存を確認
            </button>
            <button type="button" onClick={() => void exportData()}>
              <Download aria-hidden="true" size={17} /> 書き出す
            </button>
            <label className={styles.importPicker}>
              <FileUp aria-hidden="true" size={17} /> 読み込む
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => void prepareImport(event.target.files?.[0])}
              />
            </label>
          </div>

          {importPreview?.available ? (
            <div className={styles.importPreview} role="region" aria-label="読み込み内容の確認">
              <div>
                <strong>置き換える内容</strong>
                <small>タスク {importPreview.taskCount}件・報酬履歴 {importPreview.rewardCount}件</small>
                <small>現在のデータは先に自動バックアップされます。</small>
              </div>
              <button type="button" onClick={() => void activateImport()}>
                置き換えて復元
              </button>
            </div>
          ) : null}

          <div className={styles.migrationRow}>
            <div>
              <strong>以前のデータ</strong>
              <small>{migrationAvailable ? '移行可能なデータが見つかりました。' : '現在、移行対象は見つかっていません。'}</small>
            </div>
            <button type="button" disabled={!migrationAvailable} onClick={() => void migrateLegacyData()}>
              移行を開始
            </button>
          </div>

          {feedback ? <p className={styles.feedback} role="status">{feedback}</p> : null}
        </section>
      </div>
    </main>
  )
}
