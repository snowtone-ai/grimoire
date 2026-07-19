"use client";

import { useCallback, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { createTask } from "@/lib/taskDb";
import { parseTaskFromText } from "@/lib/gemini";
import { RateLimitError, redactSecret } from "@/lib/errors";
import { todayDateString } from "@/lib/domain/task-date";
import { playSave, playTap } from "@/lib/sound";

interface VoiceInputButtonProps {
  onTaskCreated: () => void;
  onFallbackToManual: (prefill?: string) => void;
}

type VoiceStatus = "idle" | "listening" | "processing" | "error" | "success";

export function VoiceInputButton({
  onTaskCreated,
  onFallbackToManual,
}: VoiceInputButtonProps) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    // Cross-browser SpeechRecognition (webkit prefix for Chrome/Android)
    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setErrorMsg("このブラウザは音声入力に対応していません");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "ja-JP";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setStatus("listening");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript?.trim() ?? "";
      if (!transcript) {
        setErrorMsg("音声がうまく取得できませんでした。もう一度お試しください");
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2500);
        return;
      }
      setStatus("processing");

      parseTaskFromText(transcript, todayDateString())
        .then(async (parsed) => {
          await createTask({
            title: parsed.title,
            dueDate: parsed.dueDate,
            dueTime: parsed.dueTime,
            category: parsed.category,
            completed: false,
            completedAt: null,
            recurrence: "none",
          });
          onTaskCreated();
          const isToday = parsed.dueDate === todayDateString();
          const dateObj = new Date(parsed.dueDate + "T00:00:00");
          const dateLabel = isToday
            ? "今日"
            : dateObj.toLocaleDateString("ja-JP", { month: "long", day: "numeric" });
          setSuccessMsg(`「${parsed.title}」を${dateLabel}に受注しました`);
          playSave();
          setStatus("success");
          setTimeout(() => setStatus("idle"), 3000);
        })
        .catch((err: unknown) => {
          console.error("[VoiceInput] error:", redactSecret(err));
          if (err instanceof RateLimitError) {
            setErrorMsg("AI解析が一時的に利用できません。手動で入力してください");
            setStatus("error");
            setTimeout(() => {
              setStatus("idle");
              onFallbackToManual(transcript);
            }, 2000);
          } else {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMsg(`エラー: ${msg}`);
            setStatus("error");
            setTimeout(() => setStatus("idle"), 5000);
          }
        });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        setStatus("idle");
        return;
      }
      if (event.error === "aborted") {
        setStatus("idle");
        return;
      }
      setErrorMsg("音声の認識に失敗しました");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    };

    recognition.onend = () => {
      // If still "listening" (no result arrived), go back to idle
      setStatus((prev) => (prev === "listening" ? "idle" : prev));
    };

    recognition.start();
  }, [onTaskCreated, onFallbackToManual]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const handleClick = () => {
    if (status === "listening") {
      stopListening();
    } else if (status === "idle") {
      playTap();
      startListening();
    }
  };

  const buttonColor =
    status === "listening"
      ? "bg-destructive text-background"
      : status === "processing" || status === "error"
        ? "bg-muted text-muted-foreground"
        : status === "success"
          ? "bg-success text-background"
          : "border border-border bg-card text-brand";

  const isDisabled = status === "processing" || status === "error" || status === "success";

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Status popup */}
      <div role="status" aria-live="polite">
        {(status === "listening" || status === "processing" || status === "error" || status === "success") && (
          <div
            className={`max-w-xs animate-pop-in rounded-xl border px-3 py-2 text-xs font-medium shadow-sm ${
              status === "error"
                ? "border-destructive/25 bg-destructive/10 text-destructive"
                : status === "success"
                  ? "border-success/25 bg-success-soft text-success"
                  : status === "listening"
                    ? "border-brand/25 bg-brand-soft text-brand"
                    : "border-border bg-muted text-muted-foreground"
            }`}
          >
            {status === "listening" && "聞いています..."}
            {status === "processing" && "AI解析中..."}
            {status === "error" && errorMsg}
            {status === "success" && successMsg}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label={status === "listening" ? "音声入力を停止" : "音声入力"}
        onClick={handleClick}
        disabled={isDisabled}
        className={`btn-squish relative flex size-14 items-center justify-center rounded-full shadow-lg disabled:cursor-not-allowed ${buttonColor}`}
      >
        {status === "listening" && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-destructive/40 motion-safe:animate-ping"
          />
        )}
        {status === "processing" ? (
          <Loader2 className="size-6 motion-safe:animate-spin" />
        ) : status === "listening" ? (
          <MicOff className="relative size-6" />
        ) : status === "success" ? (
          <span className="text-lg" aria-hidden>✓</span>
        ) : (
          <Mic className="size-6" />
        )}
      </button>
    </div>
  );
}
