"use client";

import { useCallback, useEffect, useState } from "react";
import confetti from "canvas-confetti";
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
  scheduleTaskNotifications,
  sendTestNotification,
  type NotificationPermissionState,
} from "@/lib/notifications";
import { todayDateString } from "@/lib/domain/task-date";
import { prefersReducedMotion, withViewTransition } from "@/lib/view-transition";
import { getTodayBountyClaims, grantDropForTask, type GrantResult } from "@/lib/rewardDb";
import {
  playClear,
  playFanfare,
  playTap,
  playUndo,
  primeAudioOnFirstGesture,
} from "@/lib/sound";

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
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(false);
  const [testNotifSent, setTestNotifSent] = useState(false);
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
    initializeNotificationState(setNotifPermission, setNotifBannerDismissed);
    const fallback = setTimeout(() => setLoading(false), 1500);

    Promise.resolve()
      .then(() => Promise.all([loadTasks(), refreshStreak(), evaluateBounties()]))
      .catch((err) => console.error("[home] initial load failed:", err))
      .finally(() => {
        clearTimeout(fallback);
        setLoading(false);
      });

    return () => clearTimeout(fallback);
  }, [loadTasks, refreshStreak, evaluateBounties]);

  useEffect(() => {
    if (notifPermission === "granted") {
      scheduleTaskNotifications().catch(console.error);
    }
  }, [notifPermission]);

  async function handleRequestNotification() {
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    if (result === "granted") await scheduleTaskNotifications();
  }

  function handleDismissNotifBanner() {
    localStorage.setItem("notif-banner-dismissed", "1");
    setNotifBannerDismissed(true);
  }

  async function handleTestNotification() {
    await sendTestNotification();
    setTestNotifSent(true);
    setTimeout(() => setTestNotifSent(false), 3000);
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
    scheduleTaskNotifications().catch(console.error);
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
    scheduleTaskNotifications().catch(console.error);
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
    notifBannerDismissed,
    testNotifSent,
    showGmailModal,
    setShowAddModal,
    setShowGmailModal,
    setEditingTask,
    handleRequestNotification,
    handleDismissNotifBanner,
    handleTestNotification,
    handleToggle,
    openAddModal,
    onTasksChanged,
  };
}

function initializeNotificationState(
  setPermission: (state: NotificationPermissionState) => void,
  setDismissed: (dismissed: boolean) => void
) {
  try {
    setPermission(getNotificationPermission());
  } catch (err) {
    console.error("[home] notif permission check failed:", err);
  }
  try {
    setDismissed(localStorage.getItem("notif-banner-dismissed") === "1");
  } catch (err) {
    console.error("[home] localStorage read failed:", err);
  }
}

async function updateCompletionEffects({
  isCompleting,
  allDone,
  today,
  refreshStreak,
  setAllCompleteMessage,
}: {
  isCompleting: boolean;
  allDone: boolean;
  today: string;
  refreshStreak: () => Promise<void>;
  setAllCompleteMessage: (visible: boolean) => void;
}) {
  if (isCompleting && allDone) {
    await recordStreak(today, true);
    await refreshStreak();
    playFanfare();
    fireAllCompleteConfetti();
    setAllCompleteMessage(true);
    setTimeout(() => setAllCompleteMessage(false), 3000);
    return;
  }
  if (isCompleting) return; // Per-completion celebration comes from the drop.
  if (!allDone) {
    await recordStreak(today, false);
    await refreshStreak();
  }
}

/* Frost & ember palette: star confetti scaled by drop rarity. */
const EMBER = ["#fb923c", "#fbbf24"];
const FROST = ["#7dd3fc", "#38bdf8", "#e0f2fe"];
const GOLD = ["#fbbf24", "#f59e0b", "#fde68a"];

function fireDropConfetti(rarity: 1 | 4 | 8) {
  if (prefersReducedMotion()) return;
  if (rarity === 1) {
    confetti({
      particleCount: 30,
      spread: 55,
      startVelocity: 28,
      shapes: ["star"],
      scalar: 0.8,
      origin: { y: 0.6 },
      colors: [...EMBER, FROST[0]],
    });
    return;
  }
  if (rarity === 4) {
    confetti({
      particleCount: 70,
      spread: 75,
      shapes: ["star"],
      scalar: 1,
      origin: { y: 0.55 },
      colors: [...FROST, EMBER[1]],
    });
    return;
  }
  confetti({
    particleCount: 130,
    spread: 100,
    startVelocity: 40,
    shapes: ["star"],
    scalar: 1.15,
    origin: { y: 0.5 },
    colors: [...GOLD, ...FROST],
  });
}

function fireAllCompleteConfetti() {
  if (prefersReducedMotion()) return;
  const colors = [...EMBER, ...FROST, GOLD[2]];
  confetti({
    particleCount: 110,
    angle: 60,
    spread: 70,
    shapes: ["star"],
    origin: { x: 0, y: 0.6 },
    colors,
  });
  confetti({
    particleCount: 110,
    angle: 120,
    spread: 70,
    shapes: ["star"],
    origin: { x: 1, y: 0.6 },
    colors,
  });
}
