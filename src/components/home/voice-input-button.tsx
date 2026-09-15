"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { createTask } from "@/lib/taskDb";
import { GeminiTaskError, parseTaskFromText, type ParsedTask } from "@/lib/gemini";
import { RateLimitError } from "@/lib/errors";
import { todayDateString } from "@/lib/domain/task-date";
import { playCue } from "@/lib/sound";
import { startVoiceRecognitionWatchdog } from "@/lib/voice-recognition";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
  onTaskCreated: () => void;
  onFallbackToManual: (prefill?: string) => void;
}

type VoiceStatus = "idle" | "listening" | "processing" | "error" | "success";
type VoiceErrorAction = "listen" | "process" | "save";
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
      return "マイクの使用が許可されていません。ブラウザの設定を確認してください";
    case "service-not-allowed":
      return "音声認識サービスが利用を拒否しました。ブラウザやネットワークの設定を確認してください";
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

function taskErrorMessage(error: unknown): string {
  if (error instanceof RateLimitError) {
    return "音声解析の利用上限に達しました。時間をおいて再試行するか、手入力に切り替えてください";
  }
  if (error instanceof GeminiTaskError) {
    switch (error.kind) {
      case "configuration":
        return "音声解析サービスの設定に問題があります。管理者にお問い合わせください";
      case "upstream-timeout":
      case "timeout":
        return "音声解析がタイムアウトしました。もう一度お試しください";
      case "invalid-response":
        return "音声解析の応答を確認できませんでした。もう一度お試しください";
      case "unavailable":
        return "音声解析サービスに接続できませんでした。接続を確認して再試行してください";
    }
  }
  return "音声解析に失敗しました。もう一度お試しください";
}

export function VoiceInputButton({
  onTaskCreated,
  onFallbackToManual,
}: VoiceInputButtonProps) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorAction, setErrorAction] = useState<VoiceErrorAction | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const captureWatchdogRef = useRef<{ finish(): void } | null>(null);
  const requestIdRef = useRef(0);
  const transcriptRef = useRef("");
  const pendingTaskRef = useRef<ParsedTask | null>(null);
  const scheduledTimersRef = useRef<Set<number>>(new Set());
  const stoppingRecognitionRef = useRef<SpeechRecognition | null>(null);
  const fallbackHandledRef = useRef(false);
  const mountedRef = useRef(false);

  const clearCaptureTimeout = useCallback(() => {
    captureWatchdogRef.current?.finish();
    captureWatchdogRef.current = null;
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
      if (recognitionRef.current === recognition) {
        clearCaptureTimeout();
        recognitionRef.current = null;
      }
      if (stoppingRecognitionRef.current === recognition) {
        stoppingRecognitionRef.current = null;
      }
      detachRecognitionHandlers(recognition);
    },
    [clearCaptureTimeout],
  );

  const cancelPendingWork = useCallback(() => {
    const recognition = recognitionRef.current;
    const request = requestAbortRef.current;
    if (!recognition && !request) return;

    request?.abort();
    requestAbortRef.current = null;
    requestIdRef.current += 1;
    if (recognition) {
      recognitionRef.current = null;
      clearCaptureTimeout();
      detachRecognitionHandlers(recognition);
      try {
        recognition.abort();
      } catch {
        // The recognizer may already have disconnected during navigation.
      }
    }
    if (mountedRef.current) setStatus("idle");
  }, [clearCaptureTimeout]);

  const showVoiceError = useCallback(
    (message: string, action: VoiceErrorAction, withCue = true) => {
      clearScheduledTimers();
      if (withCue) playCue("error");
      fallbackHandledRef.current = false;
      setErrorMsg(message);
      setErrorAction(action);
      setStatus("error");
    },
    [clearScheduledTimers],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearScheduledTimers();
      clearCaptureTimeout();
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
      requestIdRef.current += 1;

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

  useEffect(() => {
    const cancelWhenHidden = () => {
      if (document.visibilityState === "hidden") cancelPendingWork();
    };
    document.addEventListener("visibilitychange", cancelWhenHidden);
    window.addEventListener("pagehide", cancelPendingWork);
    return () => {
      document.removeEventListener("visibilitychange", cancelWhenHidden);
      window.removeEventListener("pagehide", cancelPendingWork);
    };
  }, [cancelPendingWork]);

  const saveParsedTask = useCallback(
    async (parsed: ParsedTask, requestId: number, controller: AbortController) => {
      const isCurrent = () =>
        mountedRef.current &&
        requestIdRef.current === requestId &&
        requestAbortRef.current === controller &&
        !controller.signal.aborted;
      if (!isCurrent()) return;

      try {
        await createTask({
          title: parsed.title,
          dueDate: parsed.dueDate,
          dueTime: parsed.dueTime,
          category: parsed.category,
          completed: false,
          completedAt: null,
          recurrence: "none",
        });
      } catch {
        if (!isCurrent()) return;
        pendingTaskRef.current = parsed;
        console.warn("[VoiceInput] task-save-failed");
        showVoiceError("タスクを保存できませんでした。もう一度お試しください", "save");
        return;
      }

      if (!isCurrent()) return;
      pendingTaskRef.current = null;
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
    },
    [onTaskCreated, schedule, showVoiceError],
  );

  const processTranscript = useCallback(
    (transcript: string) => {
      const normalizedTranscript = transcript.trim();
      if (!mountedRef.current || !normalizedTranscript || requestAbortRef.current) return;

      transcriptRef.current = normalizedTranscript;
      pendingTaskRef.current = null;
      const controller = new AbortController();
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      requestAbortRef.current = controller;
      setErrorAction(null);
      setStatus("processing");

      parseTaskFromText(normalizedTranscript, todayDateString(), { signal: controller.signal })
        .then((parsed) => {
          if (
            !mountedRef.current ||
            controller.signal.aborted ||
            requestIdRef.current !== requestId ||
            requestAbortRef.current !== controller
          ) {
            return;
          }
          pendingTaskRef.current = parsed;
          return saveParsedTask(parsed, requestId, controller);
        })
        .catch((error: unknown) => {
          if (
            !mountedRef.current ||
            controller.signal.aborted ||
            requestIdRef.current !== requestId ||
            requestAbortRef.current !== controller
          ) {
            return;
          }
          const knownKind =
            error instanceof RateLimitError
              ? "quota"
              : error instanceof GeminiTaskError
                ? error.kind
                : "unknown";
          console.warn("[VoiceInput] task-parse-failed", knownKind);
          showVoiceError(taskErrorMessage(error), "process");
        })
        .finally(() => {
          if (requestAbortRef.current === controller) requestAbortRef.current = null;
        });
    },
    [saveParsedTask, showVoiceError],
  );

  const startListening = useCallback(() => {
    // React state updates are asynchronous, so status alone cannot prevent two
    // clicks in the same frame from starting two recognizers.
    if (recognitionRef.current || requestAbortRef.current) return;

    transcriptRef.current = "";
    pendingTaskRef.current = null;
    clearScheduledTimers();
    setErrorMsg("");
    setSuccessMsg("");
    setErrorAction(null);
    fallbackHandledRef.current = false;

    // Cross-browser SpeechRecognition (webkit prefix for Chrome/Android)
    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      showVoiceError("このブラウザは音声入力に対応していません", "listen", false);
      return;
    }

    let recognition: SpeechRecognition;
    try {
      recognition = new SpeechRecognitionAPI();
    } catch {
      showVoiceError("音声入力を開始できませんでした。もう一度お試しください", "listen");
      return;
    }
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
      if (!mountedRef.current || recognitionRef.current !== recognition || resultHandled) return;
      resultHandled = true;

      const result = event.results[event.resultIndex] ?? event.results[0];
      const transcript = result?.[0]?.transcript?.trim() ?? "";
      transcriptRef.current = transcript;
      releaseRecognition(recognition);
      try {
        recognition.abort();
      } catch {
        // The recognizer may have ended while the result was being handled.
      }
      if (!transcript) {
        showVoiceError("音声がうまく取得できませんでした。もう一度お試しください", "listen");
        return;
      }
      processTranscript(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (!mountedRef.current || recognitionRef.current !== recognition) return;
      if (event.error === "aborted") {
        releaseRecognition(recognition);
        setStatus("idle");
        return;
      }
      releaseRecognition(recognition);
      showVoiceError(speechErrorMessage(event.error), "listen");
    };

    recognition.onend = () => {
      if (!mountedRef.current || recognitionRef.current !== recognition) return;
      releaseRecognition(recognition);
      // If still "listening" (no result arrived), go back to idle
      setStatus((prev) => (prev === "listening" ? "idle" : prev));
    };

    // Install the watchdog before start(): some implementations dispatch a
    // terminal event synchronously, and releaseRecognition must be able to
    // finish the exact watchdog that belongs to this session.
    captureWatchdogRef.current = startVoiceRecognitionWatchdog(
      recognition,
      {
        setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
        clearTimeout: (timerId) => window.clearTimeout(timerId),
      },
      VOICE_CAPTURE_TIMEOUT_MS,
      () => {
        if (!mountedRef.current || recognitionRef.current !== recognition || resultHandled) return;
        releaseRecognition(recognition);
        showVoiceError("音声入力がタイムアウトしました。もう一度お試しください", "listen");
      },
    );

    try {
      recognition.start();
    } catch {
      releaseRecognition(recognition);
      try {
        recognition.abort();
      } catch {
        // The recognizer may have rejected start before it became active.
      }
      showVoiceError("音声入力を開始できませんでした。もう一度お試しください", "listen");
    }
  }, [
    clearScheduledTimers,
    processTranscript,
    releaseRecognition,
    showVoiceError,
  ]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || stoppingRecognitionRef.current === recognition) return;
    // Keep the capture watchdog armed until stop() produces a terminal event.
    // Some browser implementations accept stop() but never emit onend,
    // onresult, or onerror; clearing this timer first would leave the button
    // stuck in the listening state indefinitely.
    stoppingRecognitionRef.current = recognition;
    try {
      recognition.stop();
    } catch {
      releaseRecognition(recognition);
      try {
        recognition.abort();
      } catch {
        // The recognizer may have disconnected while stop() threw.
      }
      showVoiceError("音声入力を停止できませんでした。もう一度お試しください", "listen");
    }
  }, [releaseRecognition, showVoiceError]);

  const retrySave = useCallback(() => {
    const parsed = pendingTaskRef.current;
    if (!mountedRef.current || !parsed || requestAbortRef.current) return;

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    requestAbortRef.current = controller;
    setErrorAction(null);
    setStatus("processing");
    void saveParsedTask(parsed, requestId, controller).finally(() => {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
    });
  }, [saveParsedTask]);

  const retry = useCallback(() => {
    if (!mountedRef.current || !errorAction) return;
    if (errorAction === "listen") {
      startListening();
    } else if (errorAction === "process") {
      processTranscript(transcriptRef.current);
    } else {
      retrySave();
    }
  }, [errorAction, processTranscript, retrySave, startListening]);

  const switchToManual = useCallback(() => {
    if (!mountedRef.current || fallbackHandledRef.current) return;
    fallbackHandledRef.current = true;
    const transcript = transcriptRef.current;
    cancelPendingWork();
    clearScheduledTimers();
    pendingTaskRef.current = null;
    setErrorMsg("");
    setSuccessMsg("");
    setErrorAction(null);
    setStatus("idle");
    playCue("add");
    onFallbackToManual(transcript);
  }, [cancelPendingWork, clearScheduledTimers, onFallbackToManual]);

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
            className={cn(
              "box-border w-[calc(100vw-2rem)] max-w-80 animate-pop-in rounded-none border px-3 py-2 text-xs font-medium shadow-sm",
              status === "error"
                ? "border-destructive/25 bg-destructive/10 text-destructive"
                : status === "success"
                  ? "border-success/25 bg-success-soft text-success"
                  : status === "listening"
                  ? "border-brand/25 bg-brand-soft text-brand"
                  : "border-border bg-muted text-muted-foreground"
            )}
          >
            {status === "listening" && "聞いています..."}
            {status === "processing" && "AI解析中..."}
            {status === "error" && errorMsg}
            {status === "success" && successMsg}
            {status === "error" && errorAction && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="btn-squish rounded-none"
                  onClick={retry}
                >
                  再試行
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="btn-squish rounded-none"
                  onClick={switchToManual}
                >
                  手入力に切り替える
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={status === "listening" ? "音声入力を停止" : "音声入力"}
        onClick={handleClick}
        disabled={isDisabled}
        className={cn(
          "btn-squish relative flex size-16 items-center justify-center rounded-full shadow-lg disabled:cursor-not-allowed",
          buttonColor,
        )}
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
      </Button>
    </div>
  );
}
