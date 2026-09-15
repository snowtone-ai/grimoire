export const BASE_THEME_STORAGE_KEY = "grimoire-base-theme";
export const BASE_THEME_CHANGE_EVENT = "grimoire:base-theme-change";

export const BASE_THEMES = [
  {
    id: "hoarfrost",
    label: "霜の拠点",
    description: "氷霧と淡い炉火",
  },
  {
    id: "aurora",
    label: "オーロラ",
    description: "青緑の夜光",
  },
  {
    id: "daybreak",
    label: "夜明け",
    description: "薄明と朝焼け",
  },
  {
    id: "glacier",
    label: "氷河",
    description: "澄んだ氷の青",
  },
  {
    id: "moonlit",
    label: "月明かり",
    description: "静かな藍の空",
  },
  {
    id: "hearth",
    label: "炉辺",
    description: "琥珀色のぬくもり",
  },
  {
    id: "tundra",
    label: "ツンドラ",
    description: "苔と雪解け水",
  },
  {
    id: "deep-sea",
    label: "深海",
    description: "群青と水面の光",
  },
  {
    id: "blossom",
    label: "雪桜",
    description: "薄紅の雪雲",
  },
  {
    id: "parchment",
    label: "古書",
    description: "紙と淡いインク",
  },
] as const;

export type BaseTheme = (typeof BASE_THEMES)[number]["id"];

export const DEFAULT_BASE_THEME: BaseTheme = "hoarfrost";
export const BASE_THEME_IDS = BASE_THEMES.map((theme) => theme.id);

const BASE_THEME_ID_SET = new Set<string>(BASE_THEME_IDS);

export function parseBaseTheme(value: string | null | undefined): BaseTheme {
  return value && BASE_THEME_ID_SET.has(value)
    ? (value as BaseTheme)
    : DEFAULT_BASE_THEME;
}

export function getStoredBaseTheme(
  storage?: Pick<Storage, "getItem">,
): BaseTheme {
  if (!storage && typeof window === "undefined") return DEFAULT_BASE_THEME;

  try {
    return parseBaseTheme(
      (storage ?? window.localStorage).getItem(BASE_THEME_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_BASE_THEME;
  }
}

export function applyBaseTheme(
  theme: BaseTheme,
  root?: Pick<HTMLElement, "dataset">,
): void {
  if (!root && typeof document === "undefined") return;
  (root ?? document.documentElement).dataset.baseTheme = theme;
}

export function setBaseTheme(
  theme: BaseTheme,
  storage?: Pick<Storage, "setItem">,
  root?: Pick<HTMLElement, "dataset">,
): void {
  try {
    (storage ?? window.localStorage).setItem(BASE_THEME_STORAGE_KEY, theme);
  } catch {
    // Applying the preference still helps when storage is unavailable.
  }
  applyBaseTheme(theme, root);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BASE_THEME_CHANGE_EVENT));
  }
}

export function subscribeBaseTheme(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener(BASE_THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(BASE_THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

/**
 * Runs in <head> before first paint. Keep this dependency-free and synchronous:
 * the stored data attribute must exist before body::before resolves its gradient.
 */
export function getBaseThemeInitScript(): string {
  return `(function(){var fallback=${JSON.stringify(DEFAULT_BASE_THEME)};try{var allowed=${JSON.stringify(BASE_THEME_IDS)};var value=localStorage.getItem(${JSON.stringify(BASE_THEME_STORAGE_KEY)});document.documentElement.dataset.baseTheme=allowed.indexOf(value)>=0?value:fallback}catch(_){document.documentElement.dataset.baseTheme=fallback}})()`;
}
