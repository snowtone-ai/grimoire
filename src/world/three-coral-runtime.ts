import { WorldFallbackGuard } from './fallback'
import { adaptPrototypeEnvironmentV2 } from './prototype-environment-adapter'
import type { WorldRuntimePort, WorldRuntimeSession } from './runtime'

interface PrototypeArea {
  readonly building: boolean
  readonly params: Readonly<{ quality: Readonly<{ minSamples: number; tier: 'auto' | 'full' | 'reduced' }> }>
  readonly qualityGovernor: Readonly<{ samples: readonly unknown[]; warmupRemaining: number }>
  readonly resolvedTier: 'full' | 'reduced'
  readonly stats: Readonly<{ fpsP20: number }>
  onProgress: ((label: string, progress: number) => void) | null
  dispose(): void
  getEnvironment(): unknown
  on(event: string, handler: (payload: unknown) => void): () => void
  rebuild(): Promise<void>
  setSize(width: number, height: number): void
  start(): void
  stop(): void
}

interface PrototypeModule {
  readonly CoralArea: new (canvas: HTMLCanvasElement, params: unknown) => PrototypeArea
  readonly createParams: () => unknown
}

const AREA_ID = 'area-01-coral-plateau'

function supportsWebGl2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null
  } catch {
    return false
  }
}

/**
 * Production boundary around the existing tuned Area 1 prototype. Prototype
 * diagnostics stay inside this adapter; consumers receive schema V3 only.
 */
export class ThreeCoralRuntime implements WorldRuntimePort {
  async mount(input: Parameters<WorldRuntimePort['mount']>[0]): Promise<WorldRuntimeSession> {
    if (!supportsWebGl2()) {
      input.onStatus({ phase: 'fallback', reason: 'webgl-unavailable' })
      return Object.freeze({
        setArea: async () => undefined,
        stop: () => undefined,
        dispose: () => undefined,
      })
    }

    input.onStatus({ phase: 'loading', progress: 0, label: '景観を整えています' })
    // The prototype remains plain ESM by design. This is its single typed integration boundary.
    // @ts-expect-error No declaration file is exported by the isolated prototype package.
    const prototype = await import('../../grimore-v2/prototypes/area1-coral/src/scene.js') as PrototypeModule
    const area = new prototype.CoralArea(input.canvas, prototype.createParams())
    const fallback = new WorldFallbackGuard()
    let revision = 0
    let disposed = false
    let fallbackActive = false

    const publishEnvironment = (value: unknown) => {
      if (disposed || fallbackActive) return
      try {
        input.onEnvironment(adaptPrototypeEnvironmentV2(value, revision))
        revision += 1
      } catch {
        fallbackActive = true
        area.stop()
        input.onStatus({ phase: 'fallback', reason: 'schema-incompatible' })
      }
    }
    area.onProgress = (label, progress) => {
      if (!disposed && !fallbackActive) input.onStatus({ phase: 'loading', label, progress })
    }
    const subscriptions = [
      area.on('environment', publishEnvironment),
      area.on('contextlost', () => {
        fallbackActive = true
        fallback.fail('context-lost')
        area.stop()
        input.onStatus({ phase: 'fallback', reason: 'context-lost' })
      }),
      area.on('tier', () => {
        if (!fallbackActive) input.onStatus({ phase: 'live', qualityTier: area.resolvedTier })
      }),
    ]
    const resize = () => {
      const bounds = input.canvas.parentElement?.getBoundingClientRect()
      area.setSize(Math.max(1, bounds?.width ?? window.innerWidth), Math.max(1, bounds?.height ?? window.innerHeight))
    }
    const resizeObserver = new ResizeObserver(resize)
    if (input.canvas.parentElement) resizeObserver.observe(input.canvas.parentElement)
    const visibility = () => {
      if (document.hidden) area.stop()
      else if (!disposed && !fallbackActive) area.start()
    }
    document.addEventListener('visibilitychange', visibility)
    resize()
    area.start()
    await area.rebuild()
    publishEnvironment(area.getEnvironment())
    if (!fallbackActive) input.onStatus({ phase: 'live', qualityTier: area.resolvedTier })

    const healthTimer = window.setInterval(() => {
      if (disposed || fallbackActive) return
      const sample = {
        measuredAt: performance.now(),
        mode: area.params.quality.tier,
        tier: area.resolvedTier,
        p20Fps: area.stats.fpsP20,
        sampleCount: area.qualityGovernor.samples.length,
        minimumSamples: area.params.quality.minSamples,
        warmup: area.qualityGovernor.warmupRemaining > 0,
        building: area.building,
      } as const
      input.onHealth(sample)
      if (fallback.observe(sample).active) {
        fallbackActive = true
        area.stop()
        input.onStatus({ phase: 'fallback', reason: 'sustained-low-fps' })
      }
    }, 500)

    const stop = () => area.stop()
    const dispose = () => {
      if (disposed) return
      disposed = true
      window.clearInterval(healthTimer)
      document.removeEventListener('visibilitychange', visibility)
      resizeObserver.disconnect()
      subscriptions.forEach((unsubscribe) => unsubscribe())
      area.dispose()
    }
    return Object.freeze({
      setArea: async (areaId: string) => {
        if (areaId !== input.areaId || areaId !== AREA_ID) {
          throw new RangeError(`未登録の観察域です: ${areaId}`)
        }
      },
      stop,
      dispose,
    })
  }
}
