export interface VoiceRecognitionAbortable {
  abort(): void;
}

export interface VoiceRecognitionTimer {
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(timerId: number): void;
}

export interface VoiceRecognitionWatchdog {
  /** Mark the recognition session terminal and cancel its timeout. */
  finish(): void;
}

/**
 * Bounds a recognition session whose implementation may never emit a terminal
 * event. The expiry callback must release/detach the session before this helper
 * invokes abort(), so a late browser callback cannot re-enter the component.
 */
export function startVoiceRecognitionWatchdog(
  recognition: VoiceRecognitionAbortable,
  timer: VoiceRecognitionTimer,
  timeoutMs: number,
  onExpire: () => void,
): VoiceRecognitionWatchdog {
  let active = true;
  let timerId: number | null = timer.setTimeout(() => {
    timerId = null;
    if (!active) return;
    active = false;

    try {
      onExpire();
    } finally {
      try {
        recognition.abort();
      } catch {
        // The recognizer may have disconnected while the watchdog fired.
      }
    }
  }, timeoutMs);

  return {
    finish() {
      if (!active) return;
      active = false;
      if (timerId !== null) {
        timer.clearTimeout(timerId);
        timerId = null;
      }
    },
  };
}
