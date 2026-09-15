"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Check, Loader2, X } from "lucide-react";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { calendarEventToTaskData, calendarImportSourceKey, fetchUpcomingEvents } from "@/lib/api/google-calendar";
import { checkCalendarDuplicates } from "@/lib/api/calendar-duplicates";
import { type Category } from "@/lib/db";
import { getAllTasks, importCalendarTasks } from "@/lib/taskDb";
import { planCalendarComparisons, type CalendarImportTask, type DuplicateHint } from "@/lib/domain/calendar-import";

interface Props {
  open: boolean;
  onClose: () => void;
  onTasksCreated: () => void;
}

interface Candidate {
  task: CalendarImportTask;
  selected: boolean;
  existing: boolean;
  hint: DuplicateHint | null;
}

type Step = "auth" | "loading" | "checking" | "confirm" | "saving" | "done";
const buttonClass = "rounded-none bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

// A new mount for each opening prevents stale candidates/results from a prior session.
export function CalendarImportModal(props: Props) {
  return props.open ? <ImportSession onClose={props.onClose} onTasksCreated={props.onTasksCreated} /> : null;
}

function ImportSession({ onClose, onTasksCreated }: Omit<Props, "open">) {
  const auth = useGoogleAuth("calendar");
  const [step, setStep] = useState<Step>("auth");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [result, setResult] = useState({ added: 0, skipped: 0 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mounted.current = true;
    const previousFocus = document.activeElement;
    dialog.current?.focus();
    return () => {
      mounted.current = false;
      controller.current?.abort();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  async function loadEvents() {
    if (busy.current) return;
    busy.current = true;
    const request = new AbortController();
    controller.current = request;
    setStep("loading");
    setError(null);
    setNotice(null);
    try {
      const events = await auth.withAuth(() => fetchUpcomingEvents(request.signal));
      if (!mounted.current) return;
      if (events === null) { setStep("auth"); return; }
      const tasks = events.map(event => ({
        ...calendarEventToTaskData(event), importSourceKey: calendarImportSourceKey(event), completed: false, completedAt: null,
      }));
      const plan = planCalendarComparisons(tasks, await getAllTasks());
      if (!mounted.current) return;
      if (plan.pairs.length) {
        setStep("checking");
        try {
          const matches = await checkCalendarDuplicates(plan.pairs, request.signal);
          for (const id of matches) {
            const target = plan.targets[id];
            plan.hints[target.candidate] ??= target.hint;
          }
          if (mounted.current && plan.omittedPairs) setNotice("予定が多いため、一部は意味の重複を確認できていません。内容を確認して選んでください。");
        } catch {
          if (mounted.current) setNotice("意味の重複を確認できませんでした。登録済みIDの確認は済んでいます。予定を見比べて選んでください。");
        }
      }
      if (!mounted.current) return;
      setCandidates(tasks.map((task, i) => ({ task, existing: plan.hardDuplicates[i], hint: plan.hints[i], selected: !plan.hardDuplicates[i] && !plan.hints[i] })));
      setStep("confirm");
    } catch {
      if (mounted.current) {
        setError("予定を読み込めませんでした。接続を確認して、もう一度お試しください。");
        setStep("auth");
      }
    } finally {
      busy.current = false;
    }
  }

  async function createSelectedTasks() {
    if (busy.current) return;
    const selected = candidates.filter(candidate => candidate.selected && !candidate.existing);
    if (!selected.length) return;
    busy.current = true;
    setStep("saving");
    setError(null);
    try {
      const saved = await importCalendarTasks(selected.map(candidate => candidate.task));
      if (mounted.current) {
        setResult(saved);
        setStep("done");
      }
      try { onTasksCreated(); } catch {
        if (mounted.current) setError("予定は保存済みですが、一覧を更新できませんでした。画面を再読み込みしてください。");
      }
    } catch {
      if (mounted.current) {
        setError("保存できませんでした。予定は追加されていません。空き容量などを確認して、もう一度お試しください。");
        setStep("confirm");
      }
    } finally {
      busy.current = false;
    }
  }

  const selectedCount = candidates.filter(c => c.selected && !c.existing).length;
  const saving = step === "saving";
  return (
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="calendar-import-title"
      className="fixed inset-0 z-50 flex flex-col rounded-none bg-background outline-none motion-safe:animate-slide-up"
      onKeyDown={event => {
        if (event.key === "Escape" && !saving) { event.stopPropagation(); onClose(); }
        if (event.key === "Tab") {
          const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), [tabindex="0"]');
          if (!nodes?.length) { event.preventDefault(); return; }
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <header className="flex items-center justify-between border-b border-border px-4 py-4">
        <h2 id="calendar-import-title" className="text-lg font-bold text-foreground">Calendarからインポート</h2>
        <button type="button" onClick={onClose} disabled={saving} aria-label="閉じる" className="rounded-none p-2 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"><X className="size-5" /></button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {step === "auth" && <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
          <CalendarPlus className="size-10 text-brand" />
          <p className="max-w-md text-sm text-muted-foreground">同じ予定の再登録を防ぎます。表現の違う重複候補は、予定名と日時をGeminiで比較します。</p>
          <button type="button" onClick={loadEvents} disabled={auth.isLoading} className={buttonClass}>Calendarと接続</button>
        </div>}
        {(step === "loading" || step === "checking") && <div role="status" className="flex min-h-[60dvh] flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 text-brand motion-safe:animate-spin" />
          <p className="text-sm text-muted-foreground">{step === "checking" ? "似ている予定を確認中…" : "予定を読み込み中…"}</p>
        </div>}
        {(step === "confirm" || saving) && <div className="flex flex-col gap-4" aria-busy={saving}>
          <p className="text-sm text-muted-foreground">登録済みの予定は追加できません。重複候補は選択を外しています。別の予定なら選択して追加できます。</p>
          {notice && <p role="status" className="text-sm text-foreground">{notice}</p>}
          {!candidates.length && <p className="py-12 text-center text-sm text-muted-foreground">追加できる予定はありませんでした</p>}
          <ul className="divide-y divide-border">
            {candidates.map((candidate, index) => <li key={candidate.task.importSourceKey} className="py-4">
              <button type="button" aria-pressed={candidate.selected} disabled={saving || candidate.existing}
                onClick={() => setCandidates(items => items.map((item, i) => i === index ? { ...item, selected: !item.selected } : item))}
                className="flex w-full gap-3 rounded-none text-left focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60">
                <span aria-hidden="true" className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-none border ${candidate.selected ? "border-primary bg-primary" : "border-border"}`}>
                  {candidate.selected && <Check className="size-3 text-primary-foreground" />}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  <span className="block text-sm font-semibold">{candidate.task.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{candidate.task.dueDate} {candidate.task.dueTime ?? "終日"}</span>
                  {candidate.existing && <span className="mt-1 block text-sm">登録済み</span>}
                </span>
              </button>
              {!candidate.existing && candidate.hint && <p className="mt-2 break-words text-sm text-muted-foreground">
                重複候補：{candidate.hint.kind === "existing" ? "登録済み" : "今回の候補"}「{candidate.hint.title}」 {candidate.hint.dueDate} {candidate.hint.dueTime ?? "終日"}
              </p>}
              {!candidate.existing && <select aria-label={`${candidate.task.title}のカテゴリ`} value={candidate.task.category} disabled={saving}
                onChange={event => setCandidates(items => items.map((item, i) => i === index ? { ...item, task: { ...item.task, category: event.target.value as Category } } : item))}
                className="mt-3 w-full rounded-none border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring">
                <option value="job">就活</option><option value="university">大学</option><option value="life">生活</option>
              </select>}
            </li>)}
          </ul>
          <button type="button" onClick={createSelectedTasks} disabled={saving || selectedCount === 0} className={buttonClass}>
            {saving ? "保存中…" : `選択した${selectedCount}件を追加`}
          </button>
        </div>}
        {(error || auth.error) && <p role="alert" className="mt-3 text-sm text-destructive">{step === "auth" ? auth.error ?? error : error}</p>}
        {step === "done" && <div role="status" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
          <Check className="size-10 text-success" />
          <p className="text-base font-semibold">{result.added}件のタスクを追加しました</p>
          {result.skipped > 0 && <p className="text-sm text-muted-foreground">{result.skipped}件は登録済みのため追加しませんでした</p>}
          <button type="button" onClick={onClose} className={buttonClass}>閉じる</button>
        </div>}
      </div>
    </div>
  );
}
