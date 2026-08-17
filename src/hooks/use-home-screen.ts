"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelPendingConfetti,
  fireAllCompleteConfetti,
  fireDropConfetti,
} from "@/lib/confetti";
import { type Task } from "@/lib/db";
import {
  getAllTasks,
  getTasksForDate,
  getCurrentStreakCount,
  recordStreak,
  syncPlantStateFromTasks,
  toggleTaskComplete,
} from "@/lib/taskDb";
import {
  bountyTaskId,
  getDailyBounties,
  isBountyComplete,
  bountyProgress,
  type BountyDef,
} from "@/lib/domain/bounty";
import { getDepartedTaskIds, markDeparted } from "@/lib/departure";
import {
  getNotificationPermission,
  requestNotificationPermission,
  syncTaskNotifications,
  type NotificationPermissionState,
} from "@/lib/notifications";
import { todayDateString } from "@/lib/domain/task-date";
import { withViewTransition } from "@/lib/view-transition";
import { getTodayBountyClaims, grantDropForTask, type GrantResult } from "@/lib/rewardDb";
import {
  playClear,
  playFanfare,
  playMorning,
  playTap,
  playUndo,
  primeAudioOnFirstGesture,
} from "@/lib/sound";
import { isEffectEnabled } from "@/lib/fx";

/** Set once the user has been asked about notifications, so the home screen
 * asks at most once ever rather than on every all-clear. */
const NOTIF_PROMPT_KEY = "notif-prompt-shown";

/* Morning greeting (D-036). The user asked for something to happen when they
 * open the app early — 「朝8時までにタスクチェックのために開いたら…朝の音がなるとか
 * 光が差すとか」. It is ambient, never a modal: F-1 promises the day's quests are
 * visible the instant the app opens, so nothing may sit in front of them. Once
 * per day, before MORNING_UNTIL_HOUR, and only when the "朝のあいさつ演出" toggle
 * is on (T036: replaces the old "にぎやか"-only gate). */
const MORNING_UNTIL_HOUR = 8;
const MORNING_KEY = "morning-greeted";
/** Matches the .morning-light animation in globals.css. */
const MORNING_LIGHT_MS = 4200;

function shouldGreetMorning(today: string): boolean {
  if (!isEffectEnabled("morningGreeting")) return false;
  if (new Date().getHours() >= MORNING_UNTIL_HOUR) return false;
  try {
    if (localStorage.getItem(MORNING_KEY) === today) return false;
    localStorage.setItem(MORNING_KEY, today);
  } catch {
    return false; // Without a marker it would greet on every open; skip instead.
  }
  return true;
}

export interface BountyView {
  bounty: BountyDef;
  progress: number;
  claimed: boolean;
}
import { usePlant } from "./use-plant";

export function useHomeScreen() {
  const plant = usePlant();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalInitialTitle, setAddModalInitialTitle] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [allCompleteMessage, setAllCompleteMessage] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [notifPermission, setNotifPermission] =
    useState<NotificationPermissionState>("unsupported");
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [showMorningLight, setShowMorningLight] = useState(false);
  const promptedThisSession = useRef(false);
  const [showGmailModal, setShowGmailModal] = useState(false);
  const [dropQueue, setDropQueue] = useState<GrantResult[]>([]);
  const [bountyView, setBountyView] = useState<BountyView[]>([]);
  const [departedIds, setDepartedIds] = useState<Set<string>>(new Set());
  const today = todayDateString();

  const loadTasks = useCallback(
    async (animate = false) => {
      const loaded = await getTasksForDate(today);
      if (animate) {
        withViewTransition(() => setTasks(loaded));
      } else {
        setTasks(loaded);
      }
      return loaded;
    },
    [today]
  );

  const refreshStreak = useCallback(async () => {
    setStreakCount(await getCurrentStreakCount());
  }, []);

  /** Recompute bounty progress and auto-claim finished ones (zero friction:
   * satisfied bounties reward immediately, no claim button to remember). */
  const evaluateBounties = useCallback(async () => {
    const [all, claims] = await Promise.all([getAllTasks(), getTodayBountyClaims(today)]);
    const departed = getDepartedTaskIds(today);
    const input = {
      completedToday: all.filter((task) => task.completedAt?.slice(0, 10) === today).length,
      addedToday: all.filter((task) => task.createdAt.slice(0, 10) === today).length,
      startedToday: departed.size,
    };

    const defs = getDailyBounties(today);
    for (const bounty of defs) {
      const claimId = bountyTaskId(bounty);
      if (!claims.has(claimId) && isBountyComplete(bounty, input)) {
        try {
          const grant = await grantDropForTask(claimId, today);
          if (grant) {
            claims.add(claimId);
            playClear(grant.rarity);
            fireDropConfetti(grant.rarity);
            setDropQueue((queue) => [...queue, grant]);
          }
        } catch (err) {
          console.error("[bounty] claim failed:", err);
        }
      }
    }

    setDepartedIds(departed);
    setBountyView(
      defs.map((bounty) => ({
        bounty,
        progress: bountyProgress(bounty, input),
        claimed: claims.has(bountyTaskId(bounty)),
      }))
    );
  }, [today]);

  useEffect(() => {
    primeAudioOnFirstGesture();
    const fallback = setTimeout(() => setLoading(false), 1500);
    let morningTimer: ReturnType<typeof setTimeout> | undefined;

    // Deferred to a microtask along with the initial load: reading the
    // permission is synchronous, but setting state straight from an effect body
    // triggers a cascading render (react-hooks/set-state-in-effect, see T013).
    Promise.resolve()
      .then(() => {
        try {
          setNotifPermission(getNotificationPermission());
        } catch (err) {
          console.error("[home] notif permission check failed:", err);
        }
        if (shouldGreetMorning(today)) {
          setShowMorningLight(true);
          playMorning();
          morningTimer = setTimeout(() => setShowMorningLight(false), MORNING_LIGHT_MS);
        }
      })
      .then(() => Promise.all([loadTasks(), refreshStreak(), evaluateBounties()]))
      .catch((err) => console.error("[home] initial load failed:", err))
      .finally(() => {
        clearTimeout(fallback);
        setLoading(false);
      });

    return () => {
      clearTimeout(fallback);
      clearTimeout(morningTimer);
    };
  }, [loadTasks, refreshStreak, evaluateBounties, today]);

  useEffect(() => {
    if (notifPermission === "granted") {
      syncTaskNotifications().catch(console.error);
    }
  }, [notifPermission]);

  /* An installed PWA is usually resumed, not reloaded, so this hook may not
   * remount for days. Catch-up delivery has to be re-run when the app comes
   * back to the foreground, or a session left open overnight would never check
   * the next morning's 09:00 slot at all. */
  useEffect(() => {
    if (notifPermission !== "granted") return;
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        syncTaskNotifications().catch(console.error);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [notifPermission]);

  // Waves live on document.body outside React, so leaving the screen must take
  // any queued burst with it.
  useEffect(() => cancelPendingConfetti, []);

  /* F-7 Must NOT: never ask for notification permission on first launch — ask
   * once the user has felt the app's value. The first all-quests-cleared moment
   * is that point, and it is the only place on the home screen that asks; every
   * later visit to the subject lives in /settings (D-036). */
  const maybePromptNotification = useCallback(() => {
    if (promptedThisSession.current) return;
    if (getNotificationPermission() !== "default") return;
    try {
      if (localStorage.getItem(NOTIF_PROMPT_KEY) === "1") return;
      localStorage.setItem(NOTIF_PROMPT_KEY, "1");
    } catch {
      // Storage unavailable: degrade to at most once per session.
    }
    promptedThisSession.current = true;
    setShowNotifPrompt(true);
  }, []);

  async function handleRequestNotification() {
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    setShowNotifPrompt(false);
    if (result === "granted") await syncTaskNotifications();
  }

  function dismissNotifPrompt() {
    setShowNotifPrompt(false);
  }

  async function handleToggle(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    await toggleTaskComplete(taskId);
    const newTasks = await loadTasks(true);
    await updateCompletionEffects({
      isCompleting: !task.completed,
      allDone: newTasks.length > 0 && newTasks.every((item) => item.completed),
      today,
      refreshStreak,
      setAllCompleteMessage,
      onAllComplete: maybePromptNotification,
    });
    if (!task.completed) {
      await plant.incrementCompleted();
      try {
        const grant = await grantDropForTask(taskId, today);
        if (grant) {
          playClear(grant.rarity);
          fireDropConfetti(grant.rarity);
          setDropQueue((queue) => [...queue, grant]);
        } else {
          // Already rewarded today for this task — quiet completion chime.
          playClear(1);
        }
      } catch (err) {
        console.error("[reward] drop grant failed:", err);
      }
    } else {
      playUndo();
      await plant.decrementCompleted();
    }
    await syncPlantStateFromTasks();
    await evaluateBounties();
    syncTaskNotifications().catch(console.error);
  }

  function dismissDrop() {
    setDropQueue((queue) => queue.slice(1));
  }

  function handleDepart(taskId: string) {
    if (departedIds.has(taskId)) return;
    playTap();
    setDepartedIds(markDeparted(today, taskId));
    evaluateBounties().catch(console.error);
  }

  function openAddModal(initialTitle = "") {
    setAddModalInitialTitle(initialTitle);
    setShowAddModal(true);
  }

  function onTasksChanged() {
    Promise.all([loadTasks(true), syncPlantStateFromTasks()]).catch(console.error);
    evaluateBounties().catch(console.error);
    syncTaskNotifications().catch(console.error);
  }

  return {
    plantSpecies: plant.species,
    plantStage: plant.stage,
    pendingDrop: dropQueue[0] ?? null,
    dismissDrop,
    bounties: bountyView,
    departedIds,
    handleDepart,
    tasks,
    loading,
    showAddModal,
    addModalInitialTitle,
    editingTask,
    allCompleteMessage,
    streakCount,
    notifPermission,
    showNotifPrompt,
    showMorningLight,
    showGmailModal,
    setShowAddModal,
    setShowGmailModal,
    setEditingTask,
    handleRequestNotification,
    dismissNotifPrompt,
    handleToggle,
    openAddModal,
    onTasksChanged,
  };
}

async function updateCompletionEffects({
  isCompleting,
  allDone,
  today,
  refreshStreak,
  setAllCompleteMessage,
  onAllComplete,
}: {
  isCompleting: boolean;
  allDone: boolean;
  today: string;
  refreshStreak: () => Promise<void>;
  setAllCompleteMessage: (visible: boolean) => void;
  onAllComplete: () => void;
}) {
  if (isCompleting && allDone) {
    await recordStreak(today, true);
    await refreshStreak();
    playFanfare();
    fireAllCompleteConfetti();
    setAllCompleteMessage(true);
    setTimeout(() => setAllCompleteMessage(false), 3000);
    onAllComplete();
    return;
  }
  if (isCompleting) return; // Per-completion celebration comes from the drop.
  if (!allDone) {
    await recordStreak(today, false);
    await refreshStreak();
  }
}

