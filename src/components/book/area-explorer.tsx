"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { LocateFixed, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RegionDef } from "@/lib/domain/regions";
import { useDialogBackClose } from "@/lib/use-dialog-back-close";

const MIN_SCALE = 1;
const MAX_SCALE = 2.25;
const INITIAL_VIEW = { x: 0, y: 0, scale: 1 };

type View = typeof INITIAL_VIEW;
type Point = { x: number; y: number };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function cap(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function AreaExplorer({
  region,
  open,
  onOpenChange,
}: {
  region: RegionDef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const viewRef = useRef<View>(INITIAL_VIEW);
  const dragRef = useRef<{
    pointerId: number;
    startPointer: Point;
    startView: View;
  } | null>(null);
  const pinchRef = useRef<{
    startDistance: number;
    startMidpoint: Point;
    startView: View;
  } | null>(null);
  const lastTapRef = useRef<{ at: number; point: Point } | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [showHint, setShowHint] = useState(true);

  useDialogBackClose(open, onOpenChange);

  const boundsFor = useCallback((scale: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return { maxX: 0, maxY: 0 };
    return {
      maxX: viewport.clientWidth * (scale - 0.5),
      maxY: viewport.clientHeight * (scale - 0.5),
    };
  }, []);

  const commitView = useCallback((next: View, elastic = false) => {
    const scale = cap(next.scale, MIN_SCALE, MAX_SCALE);
    const { maxX, maxY } = boundsFor(scale);
    const resist = (value: number, max: number) => {
      if (!elastic || Math.abs(value) <= max) return cap(value, -max, max);
      const edge = Math.sign(value) * max;
      return edge + (value - edge) * 0.16;
    };
    const resolved = {
      x: resist(next.x, maxX),
      y: resist(next.y, maxY),
      scale,
    };
    viewRef.current = resolved;
    setView(resolved);
  }, [boundsFor]);

  const settleView = useCallback((next: View) => {
    const plane = planeRef.current;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    if (plane) plane.dataset.settling = "true";
    commitView(next);
    settleTimerRef.current = setTimeout(() => {
      if (plane) delete plane.dataset.settling;
    }, 260);
  }, [commitView]);

  const zoomAt = useCallback((targetScale: number, point?: Point) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const current = viewRef.current;
    const scale = cap(targetScale, MIN_SCALE, MAX_SCALE);
    const focal = point ?? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    const center = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    const localX = (focal.x - center.x - current.x) / current.scale;
    const localY = (focal.y - center.y - current.y) / current.scale;
    settleView({
      x: focal.x - center.x - localX * scale,
      y: focal.y - center.y - localY * scale,
      scale,
    });
  }, [settleView]);

  useEffect(() => {
    if (!open) return;
    pointersRef.current.clear();
    const hintTimer = setTimeout(() => setShowHint(false), 3200);
    const measureViewport = () => {
      const viewport = viewportRef.current;
      if (viewport) setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    };
    const measureFrame = requestAnimationFrame(measureViewport);
    const handleResize = () => {
      measureViewport();
      settleView(viewRef.current);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(hintTimer);
      cancelAnimationFrame(measureFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, settleView]);

  useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);

  const beginSingleDrag = (pointerId: number, point: Point) => {
    dragRef.current = {
      pointerId,
      startPointer: point,
      startView: viewRef.current,
    };
    pinchRef.current = null;
  };

  const beginPinch = () => {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return;
    pinchRef.current = {
      startDistance: Math.max(distance(points[0], points[1]), 1),
      startMidpoint: midpoint(points[0], points[1]),
      startView: viewRef.current,
    };
    dragRef.current = null;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, point);
    setShowHint(false);
    if (pointersRef.current.size === 1) beginSingleDrag(event.pointerId, point);
    else beginPinch();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const point = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const viewport = viewportRef.current;
      const points = [...pointersRef.current.values()];
      if (!viewport) return;
      const pinch = pinchRef.current;
      const currentMidpoint = midpoint(points[0], points[1]);
      const scale = cap(
        pinch.startView.scale * (distance(points[0], points[1]) / pinch.startDistance),
        MIN_SCALE,
        MAX_SCALE,
      );
      const center = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
      const localX = (pinch.startMidpoint.x - center.x - pinch.startView.x) / pinch.startView.scale;
      const localY = (pinch.startMidpoint.y - center.y - pinch.startView.y) / pinch.startView.scale;
      commitView({
        x: currentMidpoint.x - center.x - localX * scale,
        y: currentMidpoint.y - center.y - localY * scale,
        scale,
      }, true);
      return;
    }

    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      commitView({
        x: drag.startView.x + point.x - drag.startPointer.x,
        y: drag.startView.y + point.y - drag.startPointer.y,
        scale: drag.startView.scale,
      }, true);
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const endedAt = pointersRef.current.get(event.pointerId);
    const endedDrag = dragRef.current?.pointerId === event.pointerId ? dragRef.current : null;
    pointersRef.current.delete(event.pointerId);
    settleView(viewRef.current);

    if (pointersRef.current.size === 1) {
      const [pointerId, point] = [...pointersRef.current.entries()][0];
      beginSingleDrag(pointerId, point);
    } else {
      dragRef.current = null;
      pinchRef.current = null;
    }

    if (
      endedAt &&
      endedDrag &&
      distance(endedAt, endedDrag.startPointer) < 10 &&
      event.type === "pointerup"
    ) {
      const now = event.timeStamp;
      const lastTap = lastTapRef.current;
      if (lastTap && now - lastTap.at < 300 && distance(lastTap.point, endedAt) < 28) {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (rect) {
          zoomAt(viewRef.current.scale > 1.05 ? 1 : 1.7, {
            x: endedAt.x - rect.left,
            y: endedAt.y - rect.top,
          });
        }
        lastTapRef.current = null;
      } else {
        lastTapRef.current = { at: now, point: endedAt };
      }
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    zoomAt(viewRef.current.scale * Math.exp(-event.deltaY * 0.0014), {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 96 : 48;
    const current = viewRef.current;
    let next: View | null = null;
    if (event.key === "ArrowLeft") next = { ...current, x: current.x + step };
    if (event.key === "ArrowRight") next = { ...current, x: current.x - step };
    if (event.key === "ArrowUp") next = { ...current, y: current.y + step };
    if (event.key === "ArrowDown") next = { ...current, y: current.y - step };
    if (event.key === "+" || event.key === "=") zoomAt(current.scale + 0.25);
    if (event.key === "-" || event.key === "_") zoomAt(current.scale - 0.25);
    if (event.key === "0") settleView(INITIAL_VIEW);
    if (next) settleView(next);
    if (next || ["+", "=", "-", "_", "0"].includes(event.key)) event.preventDefault();
  };

  const planeStyle = {
    "--area-x": `${view.x}px`,
    "--area-y": `${view.y}px`,
    "--area-scale": view.scale,
  } as CSSProperties;
  const viewportWidth = 50 / view.scale;
  const viewportHeight = 50 / view.scale;
  const imageCenterX = 50 - (view.x / (viewportSize.width * 2 * view.scale)) * 100;
  const imageCenterY = 50 - (view.y / (viewportSize.height * 2 * view.scale)) * 100;
  const locatorStyle = {
    width: `${viewportWidth}%`,
    height: `${viewportHeight}%`,
    left: `${cap(imageCenterX - viewportWidth / 2, 0, 100 - viewportWidth)}%`,
    top: `${cap(imageCenterY - viewportHeight / 2, 0, 100 - viewportHeight)}%`,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-black p-0 text-white ring-0 data-open:zoom-in-100 data-closed:zoom-out-100"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          settleView(INITIAL_VIEW);
          setShowHint(true);
          requestAnimationFrame(() => viewportRef.current?.focus({ preventScroll: true }));
        }}
      >
        <DialogTitle className="sr-only">{region.name}の探索</DialogTitle>
        <DialogDescription className="sr-only">
          画像を上下左右にドラッグして探索できます。ピンチまたはダブルタップで拡大できます。
        </DialogDescription>

        <div
          ref={viewportRef}
          role="application"
          aria-roledescription="探索画像"
          aria-label={`${region.name}。矢印キーで移動、プラスとマイナスで拡大縮小、0で中央に戻ります。`}
          tabIndex={0}
          className="area-explorer relative h-full w-full cursor-grab touch-none overflow-hidden overscroll-none bg-black outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
        >
          <div ref={planeRef} className="area-explorer-plane" style={planeStyle} aria-hidden>
            <picture>
              <source srcSet={`/area-heroes/explore/${region.id}.avif`} type="image/avif" />
              <img
                src={`/area-heroes/explore/${region.id}.webp`}
                alt=""
                draggable={false}
                className="h-full w-full object-cover select-none"
              />
            </picture>
          </div>

          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.48),transparent_18%,transparent_72%,rgba(0,0,0,0.54))]" />

          <div className="pointer-events-none absolute inset-x-16 top-[calc(env(safe-area-inset-top)+1rem)] z-10 text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            <p className="font-display text-[9px] font-bold tracking-[0.34em] text-white/70">AREA SURVEY</p>
            <p className="mt-1 truncate text-sm font-bold text-white">{region.name}</p>
          </div>

          <DialogClose asChild>
            <Button
              variant="secondary"
              size="icon-lg"
              className="absolute left-4 top-[calc(env(safe-area-inset-top)+0.8rem)] z-20 size-11 rounded-full border border-white/25 bg-black/55 text-white shadow-lg backdrop-blur-md hover:bg-black/75 hover:text-white"
              aria-label="探索を閉じる"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <X />
            </Button>
          </DialogClose>

          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-[46%] z-10 flex justify-center transition-opacity duration-500 ${showHint ? "opacity-100" : "opacity-0"}`}
          >
            <p className="rounded-full border border-white/25 bg-black/55 px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-white shadow-lg backdrop-blur-md">
              ↕ スワイプして周囲を探索 ↔
            </p>
          </div>

          <div
            className="absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-black/55 p-1.5 shadow-xl backdrop-blur-md"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon-lg"
              className="rounded-full text-white hover:bg-white/15 hover:text-white"
              onClick={() => zoomAt(viewRef.current.scale - 0.25)}
              aria-label="縮小"
            >
              <Minus />
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              className="rounded-full text-white hover:bg-white/15 hover:text-white"
              onClick={() => settleView(INITIAL_VIEW)}
              aria-label="中央に戻る"
            >
              <LocateFixed />
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              className="rounded-full text-white hover:bg-white/15 hover:text-white"
              onClick={() => zoomAt(viewRef.current.scale + 0.25)}
              aria-label="拡大"
            >
              <Plus />
            </Button>
          </div>

          <div aria-hidden className="absolute bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-4 z-10 h-14 w-7 rounded-[3px] border border-white/50 bg-black/35 shadow-lg backdrop-blur-sm">
            <span className="absolute rounded-[1px] border border-white bg-white/10 shadow-[0_0_8px_rgba(255,255,255,0.45)]" style={locatorStyle} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
