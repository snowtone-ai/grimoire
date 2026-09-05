"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { createTask } from "@/lib/taskDb";
import { parseTaskFromText } from "@/lib/gemini";
import { RateLimitError, redactSecret } from "@/lib/errors";
import { todayDateString } from "@/lib/domain/task-date";
import { playCue } from "@/lib/sound";

interface VoiceInputButtonProps {
  onTaskCreated: () => void;
  onFallbackToManual: (prefill?: string) => void;
}

type VoiceStatus = "idle" | "listening" | "processing" | "error" | "success";
const VOICE_CAPTURE_TIMEOUT_MS = 20_000;

function detachRecognitionHandlers(recognition: SpeechRecognition): void {
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
}

function speechErrorMessage(error: SpeechRecognitionErrorCode): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "マイクの使用が許可されていません。ブラウザの設定を確認してください";
    case "audio-capture":
      return "マイクを利用できません。接続とブラウザの設定を確認してください";
    case "network":
      return "音声認識の通信に失敗しました。接続を確認してもう一度お試しください";
    case "language-not-supported":
    case "language-unavailable":
      return "このブラウザでは日本語の音声認識を利用できません";
    case "no-speech":
      return "音声を聞き取れませんでした。もう一度お試しください";
    default:
      return "音声の認識に失敗しました。もう一度お試しください";
  }
}

export function VoiceInputButton({
  onTaskCreated,
  onFallbackToManual,
}: VoiceInputButtonProps) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const captureTimeoutRef = useRef<number | null>(null);
  const scheduledTimersRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(false);

  const clearCaptureTimeout = useCallback(() => {
    if (captureTimeoutRef.current !== null) {
      window.clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
  }, []);

  const clearScheduledTimers = useCallback(() => {
    for (const timer of scheduledTimersRef.current) window.clearTimeout(timer);
    scheduledTimersRef.current.clear();
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      scheduledTimersRef.current.delete(timer);
      if (mountedRef.current) callback();
    }, delay);
    scheduledTimersRef.current.add(timer);
  }, []);

  const releaseRecognition = useCallback(
    (recognition: SpeechRecognition) => {
      clearCaptureTimeout();
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      detachRecognitionHandlers(recognition);
    },
    [clearCaptureTimeout],
  );

  const showTemporaryError = useCallback(
    (message: string, delay = 3_000, withCue = true) => {
      if (withCue) playCue("error");
      setErrorMsg(message);
      setStatus("error");
      schedule(() => setStatus("idle"), delay);
    },
    [schedule],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearScheduledTimers();
      clearCaptureTimeout();
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;

      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        detachRecognitionHandlers(recognition);
        try {
          recognition.abort();
        } catch {
          // The recognizer may already have disconnected during navigation.
        }
      }
    };
  }, [clearCaptureTimeout, clearScheduledTimers]);

  const startListening = useCallback(() => {
    // React state updates are asynchronous, so status alone cannot prevent two
    // clicks in the same frame from starting two recognizers.
    if (recognitionRef.current || requestAbortRef.current) return;

    clearScheduledTimers();
    setErrorMsg("");
    setSuccessMsg("");

    // Cross-browser SpeechRecognition (webkit prefix for Chrome/Android)
    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      showTemporaryError("このブラウザは音声入力に対応していません", 3_000, false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    let captureTimedOut = false;
    let resultHandled = false;
    recognition.lang = "ja-JP";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    // Reflect the user action immediately while Chrome may still be waiting
    // for its first microphone permission decision.
    setStatus("listening");

    recognition.onstart = () => {
      if (mountedRef.current && recognitionRef.current === recognition) {
        setStatus("listening");
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (resultHandled) return;
      resultHandled = true;
      clearCaptureTimeout();

      const result = event.results[event.resultIndex] ?? event.results[0];
      const transcript = result?.[0]?.transcript?.trim() ?? "";
      if (!transcript) {
        showTemporaryError("音声がうまく取得できませんでした。もう一度お試しください", 2_500);
        return;
      }

      const controller = new AbortController();
      requestAbortRef.current = controller;
      setStatus("processing");

      parseTaskFromText(transcript, todayDateString(), { signal: controller.signal })
        .then(async (parsed) => {
          if (!mountedRef.current || controller.signal.aborted) return;
          await createTask({
            title: parsed.title,
            dueDate: parsed.dueDate,
            dueTime: parsed.dueTime,
            category: parsed.category,
            completed: false,
            completedAt: null,
            recurrence: "none",
          });
          if (!mountedRef.current || controller.signal.aborted) return;
          onTaskCreated();
          const isToday = parsed.dueDate === todayDateString();
          const dateObj = new Date(parsed.dueDate + "T00:00:00");
          const dateLabel = isToday
            ? "今日"
            : dateObj.toLocaleDateString("ja-JP", { month: "long", day: "numeric" });
          setSuccessMsg(`「${parsed.title}」を${dateLabel}に受注しました`);
          playCue("save");
          setStatus("success");
          schedule(() => setStatus("idle"), 3_000);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || !mountedRef.current) return;
          console.error("[VoiceInput] error:", redactSecret(err));
          playCue("error");
          if (err instanceof RateLimitError) {
            setErrorMsg("AI解析が一時的に利用できません。手動で入力してください");
          } else {
            setErrorMsg("AI解析に失敗しました。内容を確認して手動で入力してください");
          }
          setStatus("error");
          schedule(() => {
            setStatus("idle");
            // The capture sheet has its own cue when opened from the add
            // button; this path needs the same handover feedback.
            playCue("add");
            onFallbackToManual(transcript);
          }, 2_000);
        })
        .finally(() => {
          if (requestAbortRef.current === controller) requestAbortRef.current = null;
        });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      clearCaptureTimeout();
      if (captureTimedOut) return;
      if (event.error === "aborted") {
        releaseRecognition(recognition);
        setStatus("idle");
        return;
      }
      releaseRecognition(recognition);
      showTemporaryError(speechErrorMessage(event.error), 3_500);
    };

    recognition.onend = () => {
      releaseRecognition(recognition);
      // If still "listening" (no result arrived), go back to idle
      setStatus((prev) => (prev === "listening" ? "idle" : prev));
    };

    try {
      recognition.start();
      captureTimeoutRef.current = window.setTimeout(() => {
        captureTimeoutRef.current = null;
        if (recognitionRef.current !== recognition || resultHandled) return;
        captureTimedOut = true;
        releaseRecognition(recognition);
        showTemporaryError("音声入力がタイムアウトしました。もう一度お試しください", 3_500);
        try {
          recognition.abort();
        } catch {
          // The timeout raced with the browser ending the session.
        }
      }, VOICE_CAPTURE_TIMEOUT_MS);
    } catch (error) {
      console.error("[VoiceInput] failed to start:", redactSecret(error));
      releaseRecognition(recognition);
      showTemporaryError("音声入力を開始できませんでした。もう一度お試しください", 3_500);
    }
  }, [
    clearCaptureTimeout,
    clearScheduledTimers,
    onFallbackToManual,
    onTaskCreated,
    releaseRecognition,
    schedule,
    showTemporaryError,
  ]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    clearCaptureTimeout();
    try {
      recognition.stop();
    } catch (error) {
      console.error("[VoiceInput] failed to stop:", redactSecret(error));
      releaseRecognition(recognition);
      showTemporaryError("音声入力を停止できませんでした。もう一度お試しください", 3_500);
    }
  }, [clearCaptureTimeout, releaseRecognition, showTemporaryError]);

  const handleClick = () => {
    if (status === "listening") {
      stopListening();
    } else if (
      status === "idle" &&
      !recognitionRef.current &&
      !requestAbortRef.current
    ) {
      playCue("tap");
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
