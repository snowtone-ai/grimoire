"use client";

import { useRef, useState } from "react";
import { CalendarDays, ChevronDown, Clock3, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type Recurrence } from "@/lib/db";
import { toDateStr, todayDateString, WEEKDAY_LABELS } from "@/lib/domain/task-date";
import { playCue } from "@/lib/sound";
import { useDialogBackClose } from "@/lib/use-dialog-back-close";
import { createTask } from "@/lib/taskDb";

interface TaskAddModalProps {
  onClose: () => void;
  onTaskCreated: () => void;
  initialTitle?: string;
  initialDueDate?: string;
}

const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "daily", label: "毎日" },
  { value: "weekly", label: "毎週" },
  { value: "monthly", label: "毎月" },
];

function tomorrowDateString(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateStr(date.getFullYear(), date.getMonth(), date.getDate());
}

export function TaskAddModal({
  onClose,
  onTaskCreated,
  initialTitle = "",
  initialDueDate,
}: TaskAddModalProps) {
  // Android's Back gesture closes this dialog rather than leaving the screen
  // under it. The two full-screen explorers got this in the same rebuild;
  // without it here, a half-typed quest is the thing Back throws away.
  const requestClose = useDialogBackClose(true, (open) => !open && onClose());
  const today = todayDateString();
  const tomorrow = tomorrowDateString();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(initialDueDate || today);
  const [dueTime, setDueTime] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState(1);
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  function dismiss() {
    if (saving) return;
    playCue("modalClose");
    requestClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !dueDate || saving) return;

    setSaving(true);
    setSaveError("");
    try {
      await createTask({
        title: title.trim(),
        description: description.trim(),
        dueDate,
        dueTime: dueTime || null,
        category: "life",
        completed: false,
        completedAt: null,
        recurrence,
        recurrenceDayOfWeek: recurrence === "weekly" ? recurrenceDayOfWeek : undefined,
        recurrenceDayOfMonth: recurrence === "monthly" ? recurrenceDayOfMonth : undefined,
      });
      playCue("save");
      onTaskCreated();
      requestClose();
    } catch (error) {
      console.error("[task-add] save failed:", error);
      setSaveError("保存できませんでした。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  const datePreset = dueDate === today ? "today" : dueDate === tomorrow ? "tomorrow" : "";
  const recurrenceLabel = RECURRENCES.find((item) => item.value === recurrence)?.label;
  const detailSummary = [description.trim() ? "メモあり" : "", recurrence !== "none" ? recurrenceLabel : ""]
    .filter(Boolean)
    .join("・");

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => titleInputRef.current?.focus());
        }}
        className="quest-entry-dialog inset-0 top-0 left-0 h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none border-0 p-0 sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100"
      >
        <DialogHeader className="quest-entry-header flex-row items-start gap-3 px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-4 text-left">
          <div className="quest-entry-sigil" aria-hidden>
            <Sparkles />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[0.5625rem] font-bold tracking-[0.28em] text-frost">NEW QUEST</p>
            <DialogTitle className="mt-1 text-xl font-bold tracking-tight">調査票に記す</DialogTitle>
            <DialogDescription className="mt-1 text-xs">名前と期限だけで受注できます</DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="閉じる"
            disabled={saving}
            onClick={dismiss}
            className="size-11 shrink-0 rounded-full"
          >
            <X />
          </Button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
          <div className="quest-entry-scroll overflow-y-auto px-5 py-4">
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="task-title">クエスト名</FieldLabel>
                <Input
                  ref={titleInputRef}
                  id="task-title"
                  type="text"
                  required
                  autoComplete="off"
                  enterKeyHint="done"
                  placeholder="例：A社へ応募書類を送る"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="quest-entry-input h-12 rounded-xl px-4 font-medium"
                />
              </Field>

              <Field>
                <FieldTitle id="task-date-preset-label">いつ挑む？</FieldTitle>
                <ToggleGroup
                  type="single"
                  value={datePreset}
                  onValueChange={(value) => {
                    if (value === "today") setDueDate(today);
                    if (value === "tomorrow") setDueDate(tomorrow);
                  }}
                  aria-labelledby="task-date-preset-label"
                  variant="outline"
                  className="quest-entry-quick grid w-full grid-cols-2"
                >
                  <ToggleGroupItem value="today" className="h-11 min-w-0 rounded-xl">今日</ToggleGroupItem>
                  <ToggleGroupItem value="tomorrow" className="h-11 min-w-0 rounded-xl">明日</ToggleGroupItem>
                </ToggleGroup>
              </Field>

              <FieldGroup className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-3">
                <Field>
                  <FieldLabel htmlFor="task-due-date">
                    <CalendarDays aria-hidden />
                    期限日
                  </FieldLabel>
                  <Input
                    id="task-due-date"
                    type="date"
                    required
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="quest-entry-input h-11 rounded-xl px-3"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="task-due-time">
                    <Clock3 aria-hidden />
                    時刻
                  </FieldLabel>
                  <Input
                    id="task-due-time"
                    type="time"
                    value={dueTime}
                    onChange={(event) => setDueTime(event.target.value)}
                    className="quest-entry-input h-11 rounded-xl px-3"
                  />
                </Field>
              </FieldGroup>

              <Button
                type="button"
                variant="ghost"
                aria-expanded={showDetails}
                aria-controls="quest-extra-fields"
                onClick={() => setShowDetails((visible) => !visible)}
                className="quest-entry-detail-button h-auto w-full justify-between rounded-xl px-3 py-3 text-left"
              >
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="font-semibold">メモ・繰り返し</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {detailSummary || "必要なときだけ設定"}
                  </span>
                </span>
                <ChevronDown data-icon="inline-end" className={showDetails ? "rotate-180" : undefined} />
              </Button>

              {showDetails && (
                <FieldGroup id="quest-extra-fields" className="quest-entry-extras gap-4">
                  <Field>
                    <FieldLabel htmlFor="task-description">メモ</FieldLabel>
                    <Textarea
                      id="task-description"
                      rows={2}
                      placeholder="持ち物や、小さな手順を書いておく"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="quest-entry-input min-h-20 resize-none rounded-xl px-4 py-3"
                    />
                  </Field>

                  <Field>
                    <FieldTitle id="task-recurrence-label">繰り返し</FieldTitle>
                    <ToggleGroup
                      type="single"
                      value={recurrence}
                      onValueChange={(value) => value && setRecurrence(value as Recurrence)}
                      aria-labelledby="task-recurrence-label"
                      variant="outline"
                      className="quest-entry-repeat grid w-full grid-cols-4"
                    >
                      {RECURRENCES.map(({ value, label }) => (
                        <ToggleGroupItem key={value} value={value} className="h-11 min-w-0 rounded-lg px-1">
                          {label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Field>

                  {recurrence === "weekly" && (
                    <Field>
                      <FieldTitle id="task-weekday-label">曜日</FieldTitle>
                      <ToggleGroup
                        type="single"
                        value={String(recurrenceDayOfWeek)}
                        onValueChange={(value) => value && setRecurrenceDayOfWeek(Number(value))}
                        aria-labelledby="task-weekday-label"
                        variant="outline"
                        className="quest-entry-weekdays grid w-full grid-cols-7"
                      >
                        {WEEKDAY_LABELS.map((day, index) => (
                          <ToggleGroupItem key={day} value={String(index)} className="h-11 min-w-0 rounded-lg px-0">
                            {day}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </Field>
                  )}

                  {recurrence === "monthly" && (
                    <Field>
                      <FieldLabel htmlFor="add-recurrence-day">毎月 何日</FieldLabel>
                      <div className="flex items-center gap-2">
                        <Input
                          id="add-recurrence-day"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={31}
                          value={recurrenceDayOfMonth}
                          onChange={(event) => setRecurrenceDayOfMonth(Number(event.target.value))}
                          className="quest-entry-input h-10 w-24 rounded-xl px-3"
                        />
                        <span className="text-sm text-muted-foreground">日</span>
                      </div>
                      {recurrenceDayOfMonth > 28 && (
                        <FieldDescription className="text-brand">
                          短い月には表示されない日があります
                        </FieldDescription>
                      )}
                    </Field>
                  )}
                </FieldGroup>
              )}

              {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
            </FieldGroup>
          </div>

          <div className="quest-entry-footer px-5 pt-3">
            <Button
              type="submit"
              size="lg"
              disabled={saving || !title.trim() || !dueDate}
              className="quest-accept-button btn-squish h-12 w-full rounded-xl font-bold"
            >
              {saving ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
              {saving ? "調査票に記録中…" : "このクエストを受注"}
            </Button>
            <p className="mt-2 text-center text-[0.6875rem] text-muted-foreground">
              メモと繰り返しは後からでも変更できます
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
