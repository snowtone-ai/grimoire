"use client";

import { Link } from "next-view-transitions";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, RotateCcw, Upload, Volume2, VolumeX } from "lucide-react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import {
  buildBackupJson,
  downloadBackup,
  importBackup,
  parseBackup,
  type ParsedBackup,
} from "@/lib/backup";
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  syncTaskNotifications,
  type NotificationPermissionState,
} from "@/lib/notifications";
import { getSurveyResetCount, resetSurveyNotes } from "@/lib/rewardDb";
import { isFxEnabled, playSave, playTap, setFxEnabled } from "@/lib/sound";
import { getCalendarResetCounts, resetCalendar } from "@/lib/taskDb";

/* Settings (D-036).
 *
 * Everything here used to live on a screen that had other work to do: the sound
 * toggle sat permanently in the home header, the notification panel occupied
 * space above the day's quest list until dismissed, and backup/reset were parked
 * at the bottom of the survey notes. Collecting them costs the home screen
 * nothing and gives each control room to explain itself. */
export function SettingsScreen() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="aurora px-5 pt-8 pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          ホームへ戻る
        </Link>
        <p className="mt-2 font-display text-[10px] font-bold tracking-[0.32em] text-frost">
          SETTINGS
        </p>
        <h1 className="mt-0.5 text-[28px]/[1.15] font-bold tracking-tight text-foreground">
          設定
        </h1>
      </header>

      <main
        className="flex-1 space-y-6 px-4 pt-2"
        style={{ paddingBottom: "calc(6.5rem + env(safe-area-inset-bottom))" }}
      >
        <SoundSection />
        <NotificationSection />
        <BackupSection />
        <ResetSection />
      </main>

      <BottomNav />
    </div>
  );
}

function SettingsSection({
  overline,
  title,
  tone = "frost",
  children,
}: {
  overline: string;
  title: string;
  tone?: "frost" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`rounded-2xl border bg-card p-4 ${
        tone === "destructive" ? "border-destructive/25" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        <p
          className={`font-display text-[10px] font-bold tracking-[0.26em] ${
            tone === "destructive" ? "text-destructive" : "text-frost"
          }`}
        >
          {overline}
        </p>
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      </div>
      <div
        aria-hidden
        className={`mt-1.5 mb-3 h-px bg-gradient-to-r ${
          tone === "destructive"
            ? "from-destructive/35 via-destructive/10 to-transparent"
            : "from-gold/45 via-gold/15 to-transparent"
        }`}
      />
      {children}
    </section>
  );
}

/* The existing preference gates sound AND haptics together (see sound.ts), so
 * the label says so rather than promising two independent switches. */
function SoundSection() {
  // Lazy initializer rather than an effect: this screen is mounted client-only
  // (dynamic ssr:false), so localStorage is available on first render.
  const [enabled, setEnabled] = useState(isFxEnabled);

  function toggle() {
    const next = !enabled;
    setFxEnabled(next);
    setEnabled(next);
    if (next) playTap();
  }

  return (
    <SettingsSection overline="FEEDBACK" title="効果音とバイブ">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        className="btn-squish flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-muted"
      >
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
            enabled ? "bg-brand-soft text-brand" : "bg-muted text-muted-foreground"
          }`}
        >
          {enabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            効果音とバイブレーション
          </span>
          <span className="block text-xs text-muted-foreground">
            クエスト達成音・操作音と、端末の振動をまとめて切り替えます
          </span>
        </span>
        <span
          aria-hidden
          className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
            enabled ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`block size-5 rounded-full bg-background transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </span>
      </button>
    </SettingsSection>
  );
}

function NotificationSection() {
  const [permission, setPermission] =
    useState<NotificationPermissionState>(getNotificationPermission);
  const [busy, setBusy] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const testTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(testTimer.current), []);

  async function handleRequest() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result === "granted") await syncTaskNotifications();
    } catch (err) {
      console.error("[settings] notification request failed:", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    await sendTestNotification();
    setTestSent(true);
    clearTimeout(testTimer.current);
    testTimer.current = setTimeout(() => setTestSent(false), 3000);
  }

  return (
    <SettingsSection overline="ALERTS" title="締切通知">
      <p className="text-xs leading-relaxed text-muted-foreground">
        締切の前日ぶんと当日ぶんを、朝9時以降に最初にアプリを開いたときにお知らせします。
      </p>

      {permission === "unsupported" && (
        <p className="mt-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          この端末・ブラウザは通知に対応していません
        </p>
      )}

      {permission === "default" && (
        <button
          type="button"
          onClick={handleRequest}
          disabled={busy}
          className="btn-squish mt-3 w-full rounded-xl bg-primary bg-gradient-to-b from-white/20 to-transparent py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "確認中..." : "通知を許可する"}
        </button>
      )}

      {permission === "denied" && (
        <p className="mt-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          通知はブロックされています。ブラウザのサイト設定から許可に変更してください
        </p>
      )}

      {permission === "granted" && (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl bg-success-soft px-3 py-2 text-sm font-medium text-success">
            通知は有効です
          </p>
          <button
            type="button"
            onClick={handleTest}
            className="btn-squish w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            {testSent ? "✓ 送信しました！" : "テスト通知を送る"}
          </button>
        </div>
      )}
    </SettingsSection>
  );
}

function BackupSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setMessage(null);
    try {
      playTap();
      downloadBackup(await buildBackupJson());
      setMessage("バックアップファイルを保存しました");
    } catch (err) {
      console.error("[backup] export failed:", err);
      setMessage("エクスポートに失敗しました");
    }
  }

  async function handleFileSelected(file: File | undefined) {
    setMessage(null);
    setPending(null);
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "ファイルを読み込めませんでした");
    }
  }

  async function handleImportConfirm() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      await importBackup(pending.payload);
      playSave();
      setMessage(`取り込み完了: クエスト${pending.counts.tasks}件 / ドロップ${pending.counts.drops}件`);
      setPending(null);
    } catch (err) {
      console.error("[backup] import failed:", err);
      setMessage("取り込みに失敗しました");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <SettingsSection overline="ARCHIVE" title="調査データのバックアップ">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="btn-squish flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <Download className="size-4" aria-hidden />
          エクスポート
        </button>
        <button
          type="button"
          onClick={() => {
            playTap();
            fileInputRef.current?.click();
          }}
          className="btn-squish flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <Upload className="size-4" aria-hidden />
          インポート
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="バックアップファイルを選択"
          onChange={(event) => handleFileSelected(event.target.files?.[0])}
        />
      </div>
      {pending && (
        <div className="mt-3 rounded-xl bg-brand-soft p-3">
          <p className="text-sm font-semibold text-brand">
            クエスト{pending.counts.tasks}件・ドロップ{pending.counts.drops}件を取り込みます
          </p>
          <p className="mt-0.5 text-xs text-brand/80">
            同じIDのデータは上書きされます。既存データが消えることはありません
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPending(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="btn-squish flex-1 rounded-lg border border-border bg-card py-2 text-sm font-semibold text-foreground"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleImportConfirm}
              disabled={busy}
              className="btn-squish flex-1 rounded-lg bg-primary bg-gradient-to-b from-white/20 to-transparent py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "取り込み中..." : "取り込む"}
            </button>
          </div>
        </div>
      )}
      <div aria-live="polite">
        {message && <p className="mt-2.5 text-xs text-muted-foreground">{message}</p>}
      </div>
    </SettingsSection>
  );
}

function ResetSection() {
  return (
    <SettingsSection overline="RESET" title="データのリセット（取り消し不可）" tone="destructive">
      <div className="space-y-3">
        <ResetRow
          label="カレンダーをリセット"
          description="すべてのクエスト（タスク）とストリーク記録を削除し、カレンダーを空の状態に戻します"
          loadSummary={async () => {
            const { tasks, streaks } = await getCalendarResetCounts();
            return `クエスト${tasks}件・ストリーク記録${streaks}件を完全に削除します`;
          }}
          onReset={resetCalendar}
        />
        <ResetRow
          label="調査記録をリセット"
          description="ドロップ（素材/コレクション/年代記）の記録をすべて削除し、図鑑を空の状態に戻します"
          loadSummary={async () => {
            const drops = await getSurveyResetCount();
            return `ドロップ記録${drops}件を完全に削除します`;
          }}
          onReset={resetSurveyNotes}
        />
      </div>
    </SettingsSection>
  );
}

/** Two-tap destructive confirm: tap reveals a count-backed warning panel,
 * a second explicit tap performs the (irreversible) reset. Same pattern as
 * the quest-delete confirm in task-edit-modal.tsx. */
function ResetRow({
  label,
  description,
  loadSummary,
  onReset,
}: {
  label: string;
  description: string;
  loadSummary: () => Promise<string>;
  onReset: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startConfirm() {
    playTap();
    setMessage(null);
    setSummary(await loadSummary().catch(() => null));
    setConfirming(true);
  }

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onReset();
      setConfirming(false);
      setMessage("削除しました");
    } catch (err) {
      console.error(`[reset] ${label} failed:`, err);
      setMessage("削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          onClick={startConfirm}
          className="btn-squish flex w-full items-center justify-center gap-1.5 rounded-xl border border-destructive/30 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
        >
          <RotateCcw className="size-4" aria-hidden />
          {label}
        </button>
        <div aria-live="polite">
          {message && <p className="mt-1.5 text-center text-xs text-muted-foreground">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-destructive/25 bg-destructive/10 p-4">
      <div>
        <p className="text-sm font-medium text-destructive">{summary ?? description}</p>
        <p className="mt-1 text-xs text-destructive/80">
          この操作は取り消せません。必要ならARCHIVEで先にエクスポートしてください
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-bold text-background transition-opacity disabled:opacity-50"
        >
          {busy ? "削除中..." : "本当に削除する"}
        </button>
      </div>
      <div aria-live="polite">
        {message && <p className="text-center text-xs text-destructive">{message}</p>}
      </div>
    </div>
  );
}
