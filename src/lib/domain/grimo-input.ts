/**
 * Carol's input boundary is deliberately browser-free.  The scene owns pointer
 * capture, while this small state machine decides which browser events may
 * change the interaction.  A stray second finger or a late cancel must never
 * release somebody else's active contact.
 */
export interface CarolInputState {
  activePointerId: number | null;
}

export type CarolPointerEvent =
  | { type: "down"; pointerId: number; isPrimary: boolean }
  | { type: "move" | "up" | "cancel" | "lostcapture"; pointerId: number }
  | { type: "interrupt" };

export type CarolPointerDecision = {
  state: CarolInputState;
  contact: boolean;
  release: boolean;
  capture: boolean;
  releaseCapture: boolean;
};

export const INITIAL_CAROL_INPUT: CarolInputState = { activePointerId: null };

const ignored = (state: CarolInputState): CarolPointerDecision => ({
  state,
  contact: false,
  release: false,
  capture: false,
  releaseCapture: false,
});

export function decideCarolPointer(
  state: CarolInputState,
  event: CarolPointerEvent,
): CarolPointerDecision {
  if (event.type === "down") {
    if (!event.isPrimary || state.activePointerId !== null) return ignored(state);
    return {
      state: { activePointerId: event.pointerId },
      contact: true,
      release: false,
      capture: true,
      releaseCapture: false,
    };
  }

  if (event.type === "interrupt") {
    if (state.activePointerId === null) return ignored(state);
    return {
      state: INITIAL_CAROL_INPUT,
      contact: false,
      release: true,
      capture: false,
      releaseCapture: false,
    };
  }

  if (state.activePointerId !== event.pointerId) return ignored(state);
  if (event.type === "move") {
    return { ...ignored(state), contact: true };
  }

  return {
    state: INITIAL_CAROL_INPUT,
    contact: false,
    release: true,
    capture: false,
    releaseCapture: event.type === "up" || event.type === "cancel",
  };
}

export function normalizeCarolContact(
  clientX: number,
  clientY: number,
  bounds: Pick<DOMRect, "left" | "top" | "width" | "height">,
): { x: number; y: number } | null {
  if (
    !Number.isFinite(clientX) || !Number.isFinite(clientY) ||
    !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) ||
    bounds.width <= 0 || bounds.height <= 0
  ) return null;

  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  const y = clamp(-((clientY - bounds.top) / bounds.height - 0.5) * 2);
  return {
    x: clamp(((clientX - bounds.left) / bounds.width - 0.5) * 2),
    y: y === 0 ? 0 : y,
  };
}
