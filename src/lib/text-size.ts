export const TEXT_SIZE_STORAGE_KEY = "grimoire-text-size";

export type TextSize = "normal" | "large";

export function parseTextSize(value: string | null | undefined): TextSize {
  return value === "large" ? "large" : "normal";
}

export function getStoredTextSize(
  storage?: Pick<Storage, "getItem">,
): TextSize {
  if (!storage && typeof window === "undefined") return "normal";

  try {
    return parseTextSize((storage ?? window.localStorage).getItem(TEXT_SIZE_STORAGE_KEY));
  } catch {
    return "normal";
  }
}

export function applyTextSize(
  size: TextSize,
  root?: Pick<HTMLElement, "dataset">,
): void {
  if (!root && typeof document === "undefined") return;
  (root ?? document.documentElement).dataset.textSize = size;
}

export function setTextSize(
  size: TextSize,
  storage?: Pick<Storage, "setItem">,
  root?: Pick<HTMLElement, "dataset">,
): void {
  try {
    (storage ?? window.localStorage).setItem(TEXT_SIZE_STORAGE_KEY, size);
  } catch {
    // Applying the preference still helps when storage is unavailable.
  }
  applyTextSize(size, root);
}
