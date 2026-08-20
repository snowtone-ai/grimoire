export const colorTokens = {
  world: 'var(--color-world)',
  ground: 'var(--color-ground)',
  surface: 'var(--color-surface)',
  surfaceStrong: 'var(--color-surface-strong)',
  ink: 'var(--color-ink)',
  inkMuted: 'var(--color-ink-muted)',
  iron: 'var(--color-iron)',
  line: 'var(--color-line)',
  mist: 'var(--color-mist)',
  focus: 'var(--color-focus)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
} as const

export const interactionTokens = {
  tapTargetPx: 44,
  durationMs: {
    instant: 90,
    feedback: 180,
    reveal: 360,
    splash: 900,
    splashMaximum: 1_200,
    reducedOpacity: 150,
  },
  easing: {
    press: [0.2, 0.8, 0.25, 1],
    settle: [0.16, 1, 0.3, 1],
    ambient: [0.45, 0, 0.55, 1],
  },
  spring: {
    control: { damping: 28, mass: 0.7, stiffness: 420 },
    sheet: { damping: 34, mass: 1, stiffness: 310 },
  },
} as const

export const layoutTokens = {
  breakpointPx: {
    compact: 480,
    splitView: 800,
    wide: 1_200,
  },
  contentMaxPx: 1_248,
  readingMaxPx: 672,
  layer: {
    world: 0,
    content: 10,
    navigation: 30,
    sheet: 50,
    toast: 70,
    splash: 90,
  },
} as const

export const typographyTokens = {
  operation: 'var(--font-operation)',
  lore: 'var(--font-lore)',
} as const

export type GrimoireTheme = 'natural-history' | 'order'
export type ColorScheme = 'dark' | 'light' | 'system'
export type SplashDisplayMode = 'always' | 'off' | 'timed'
