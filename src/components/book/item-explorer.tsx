"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { RewardArt } from "@/components/reward/reward-art";
import { getRarityLabel, type DropDef } from "@/lib/domain/drops";
import { getRegionById } from "@/lib/domain/regions";
import { rarityStyle } from "@/lib/domain/rarity-style";
import { playCue } from "@/lib/sound";
import { useDialogBackClose } from "@/lib/use-dialog-back-close";

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const SWIPE_THRESHOLD = 54;

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

interface PointerPoint {
  x: number;
  y: number;
}

function distance(a: PointerPoint, b: PointerPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: PointerPoint, b: PointerPoint): PointerPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ItemExplorer({
  items,
  initialId,
  open,
  onOpenChange,
}: {
  items: readonly DropDef[];
  initialId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const initialIndex = Math.max(0, items.findIndex((item) => item.id === initialId));
  const [index, setIndex] = useState(initialIndex);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const [settling, setSettling] = useState(false);

  useDialogBackClose(open, onOpenChange);
  const stageRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, PointerPoint>());
  const gesture = useRef({
    dragStart: { x: 0, y: 0 },
    viewStart: { x: 0, y: 0 },
    pinchDistance: 0,
    pinchScale: 1,
    pinchCenter: { x: 0, y: 0 },
    pinchBase: { x: 0, y: 0 },
    pinchLocal: { x: 0, y: 0 },
    lastTapAt: 0,
    moved: false,
  });

  const item = items[index] ?? items[0];
  const region = item ? getRegionById(item.region) : null;
  const rarity = item ? rarityStyle(item.rarity) : null;

  const bounds = useCallback((scale: number) => {
    const art = artRef.current;
    if (!art) return { x: 0, y: 0 };
    return {
      x: Math.max(0, (art.offsetWidth * scale - art.offsetWidth) / 2),
      y: Math.max(0, (art.offsetHeight * scale - art.offsetHeight) / 2),
    };
  }, []);

  const settle = useCallback(
    (candidate = view) => {
      const scale = clamp(candidate.scale, MIN_SCALE, MAX_SCALE);
      const limit = bounds(scale);
      setSettling(true);
      setView({
        scale,
        x: clamp(candidate.x, -limit.x, limit.x),
        y: clamp(candidate.y, -limit.y, limit.y),
      });
    },
    [bounds, view]
  );

  useEffect(() => {
    if (!settling) return;
    const timer = window.setTimeout(() => setSettling(false), 230);
    return () => window.clearTimeout(timer);
  }, [settling]);

  const moveTo = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= items.length || nextIndex === index) {
        settle({ x: 0, y: 0, scale: 1 });
        return;
      }
      setIndex(nextIndex);
      setSettling(true);
      setView({ x: 0, y: 0, scale: 1 });
      playCue("tap");
    },
    [index, items.length, settle]
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setSettling(false);
    const points = [...pointers.current.values()];
    if (points.length === 1) {
      gesture.current.dragStart = points[0];
      gesture.current.viewStart = { x: view.x, y: view.y };
      gesture.current.moved = false;
    } else if (points.length === 2) {
      gesture.current.pinchDistance = distance(points[0], points[1]);
      gesture.current.pinchScale = view.scale;
      gesture.current.pinchCenter = midpoint(points[0], points[1]);
      const rect = artRef.current?.getBoundingClientRect();
      if (rect) {
        const renderedCenter = {
          x: (rect.left + rect.right) / 2,
          y: (rect.top + rect.bottom) / 2,
        };
        gesture.current.pinchBase = {
          x: renderedCenter.x - view.x,
          y: renderedCenter.y - view.y,
        };
        gesture.current.pinchLocal = {
          x: (gesture.current.pinchCenter.x - renderedCenter.x) / view.scale,
          y: (gesture.current.pinchCenter.y - renderedCenter.y) / view.scale,
        };
      }
      gesture.current.moved = true;
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      const nextScale = clamp(
        gesture.current.pinchScale * (distance(points[0], points[1]) / gesture.current.pinchDistance),
        MIN_SCALE,
        MAX_SCALE
      );
      const center = midpoint(points[0], points[1]);
      setView(() => ({
        scale: nextScale,
        x: center.x - gesture.current.pinchBase.x - gesture.current.pinchLocal.x * nextScale,
        y: center.y - gesture.current.pinchBase.y - gesture.current.pinchLocal.y * nextScale,
      }));
      return;
    }

    const dx = event.clientX - gesture.current.dragStart.x;
    const dy = event.clientY - gesture.current.dragStart.y;
    if (Math.hypot(dx, dy) > 10) gesture.current.moved = true;
    if (view.scale <= 1.01) {
      setView((current) => ({ ...current, x: dx * 0.72, y: dy * 0.08 }));
    } else {
      const limit = bounds(view.scale);
      const rawX = gesture.current.viewStart.x + dx;
      const rawY = gesture.current.viewStart.y + dy;
      const resist = (value: number, max: number) =>
        value < -max ? -max + (value + max) * 0.24 : value > max ? max + (value - max) * 0.24 : value;
      setView((current) => ({
        ...current,
        x: resist(rawX, limit.x),
        y: resist(rawY, limit.y),
      }));
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    const finalPoint = pointers.current.get(event.pointerId);
    pointers.current.delete(event.pointerId);
    if (pointers.current.size > 0) {
      const point = [...pointers.current.values()][0];
      gesture.current.dragStart = point;
      gesture.current.viewStart = { x: view.x, y: view.y };
      gesture.current.moved = true;
      return;
    }

    const dx = (finalPoint?.x ?? event.clientX) - gesture.current.dragStart.x;
    const dy = (finalPoint?.y ?? event.clientY) - gesture.current.dragStart.y;
    if (view.scale <= 1.01 && Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.15) {
      moveTo(index + (dx < 0 ? 1 : -1));
      return;
    }

    const now = event.timeStamp;
    if (!gesture.current.moved && now - gesture.current.lastTapAt < 320) {
      zoomAt(view.scale > 1.05 ? 1 : 2, finalPoint ?? { x: event.clientX, y: event.clientY });
      gesture.current.lastTapAt = 0;
      return;
    }
    if (!gesture.current.moved) gesture.current.lastTapAt = now;
    settle();
  };

  const adjustZoom = (delta: number) => {
    const scale = clamp(view.scale + delta, MIN_SCALE, MAX_SCALE);
    settle(scale === 1 ? { x: 0, y: 0, scale } : { ...view, scale });
  };

  function zoomAt(targetScale: number, point: PointerPoint) {
    const art = artRef.current;
    if (!art) return;
    const scale = clamp(targetScale, MIN_SCALE, MAX_SCALE);
    if (scale === 1) {
      settle({ x: 0, y: 0, scale });
      return;
    }
    const rect = art.getBoundingClientRect();
    const renderedCenter = {
      x: (rect.left + rect.right) / 2,
      y: (rect.top + rect.bottom) / 2,
    };
    const baseCenter = {
      x: renderedCenter.x - view.x,
      y: renderedCenter.y - view.y,
    };
    const local = {
      x: (point.x - renderedCenter.x) / view.scale,
      y: (point.y - renderedCenter.y) / view.scale,
    };
    settle({
      x: point.x - baseCenter.x - local.x * scale,
      y: point.y - baseCenter.y - local.y * scale,
      scale,
    });
  }

  const transformStyle = useMemo(
    () =>
      ({
        "--item-x": `${view.x}px`,
        "--item-y": `${view.y}px`,
        "--item-scale": view.scale,
      }) as CSSProperties,
    [view]
  );

  if (!item || !region || !rarity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => stageRef.current?.focus({ preventScroll: true }));
        }}
        className="inset-0 z-[100] flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-[#071016] p-0 text-white shadow-none"
      >
        <DialogTitle className="sr-only">{item.name}の記録</DialogTitle>
        <DialogDescription className="sr-only">
          左右スワイプで獲得済みアイテムを移動、ピンチまたはダブルタップで拡大できます。
        </DialogDescription>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-28 bg-gradient-to-b from-black/75 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="rounded-full bg-black/38 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-white/78 backdrop-blur-md">
            RECORD {index + 1} / {items.length}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="鑑賞を閉じる"
            className="btn-squish flex size-12 items-center justify-center rounded-full border border-white/18 bg-black/48 text-white shadow-lg backdrop-blur-md"
          >
            <X className="size-5" />
          </button>
        </div>

        <div
          ref={stageRef}
          role="application"
          aria-label={`${item.name}。左右スワイプで記録を移動、ピンチで拡大`}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onWheel={(event: WheelEvent<HTMLDivElement>) => {
            event.preventDefault();
            zoomAt(view.scale + (event.deltaY > 0 ? -0.2 : 0.2), {
              x: event.clientX,
              y: event.clientY,
            });
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" && view.scale === 1) moveTo(index - 1);
            else if (event.key === "ArrowRight" && view.scale === 1) moveTo(index + 1);
            else if (event.key === "+" || event.key === "=") adjustZoom(0.25);
            else if (event.key === "-") adjustZoom(-0.25);
            else if (event.key === "0") settle({ x: 0, y: 0, scale: 1 });
            if (["ArrowLeft", "ArrowRight", "+", "=", "-", "0"].includes(event.key)) {
              event.preventDefault();
            }
          }}
          className="relative h-[64dvh] min-h-0 w-full flex-none touch-none overflow-hidden outline-none"
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{
              background: `radial-gradient(circle at 50% 38%, color-mix(in oklab, ${rarity.color} 22%, transparent), transparent 55%), linear-gradient(180deg, color-mix(in oklab, ${region.accent} 14%, #071016), #071016)`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center px-3 pt-16 pb-2">
            <div
              ref={artRef}
              style={transformStyle}
              className={`item-explorer-art relative aspect-square w-full max-w-[min(94vw,60dvh)] overflow-hidden rounded-[1.6rem] shadow-[0_28px_70px_-24px_rgba(0,0,0,.95)] ring-1 ring-white/12 ${settling ? "is-settling" : ""}`}
            >
              <RewardArt key={item.id} drop={item} variant="inspect" className="object-cover select-none" />
              <div aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
            </div>
          </div>

          {view.scale <= 1.01 && index > 0 && (
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => moveTo(index - 1)}
              aria-label="前の記録"
              className="btn-squish absolute left-2 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/38 text-white/85 backdrop-blur"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          {view.scale <= 1.01 && index < items.length - 1 && (
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => moveTo(index + 1)}
              aria-label="次の記録"
              className="btn-squish absolute right-2 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/38 text-white/85 backdrop-blur"
            >
              <ChevronRight className="size-5" />
            </button>
          )}

          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/12 bg-black/48 p-1 backdrop-blur-md">
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => adjustZoom(-0.25)} disabled={view.scale <= MIN_SCALE} aria-label="縮小" className="btn-squish flex size-10 items-center justify-center rounded-full text-white disabled:opacity-35">
              <Minus className="size-4" />
            </button>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => settle({ x: 0, y: 0, scale: 1 })} aria-label="拡大率を戻す" className="btn-squish flex min-w-12 items-center justify-center gap-1 rounded-full px-1 text-[10px] font-bold tabular-nums text-white/85">
              <RotateCcw className="size-3.5" /> {Math.round(view.scale * 100)}%
            </button>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => adjustZoom(0.25)} disabled={view.scale >= MAX_SCALE} aria-label="拡大" className="btn-squish flex size-10 items-center justify-center rounded-full text-white disabled:opacity-35">
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <section className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[1.75rem] border-t border-white/10 bg-[#0b151c]/96 px-5 pt-4" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.16em]" style={{ color: rarity.color, backgroundColor: `color-mix(in oklab, ${rarity.color} 18%, transparent)` }}>
              {getRarityLabel(item.rarity)}
            </span>
            <span className="text-[10px] font-semibold tracking-wide text-white/48">{region.name}</span>
          </div>
          <h2 className="mt-2 text-[22px] font-bold leading-tight text-white">{item.name}</h2>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-white/64">{item.flavor}</p>
          <p className="mt-3 text-[10px] font-bold tracking-[0.2em] text-white/34">
            {view.scale > 1 ? "DRAG TO EXAMINE" : "SWIPE FOR NEXT RECORD · DOUBLE TAP TO ZOOM"}
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
