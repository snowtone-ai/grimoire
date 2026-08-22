import { describe, expect, it } from 'vitest'

import { interactionTokens, layoutTokens, typeScaleTokens } from './design-tokens'

describe('interaction tokens', () => {
  it('keeps the default splash inside its hard startup ceiling', () => {
    expect(interactionTokens.durationMs.splash).toBeLessThanOrEqual(
      interactionTokens.durationMs.splashMaximum,
    )
  })

  it('keeps interactive targets at least 44 CSS pixels', () => {
    expect(interactionTokens.tapTargetPx).toBeGreaterThanOrEqual(44)
  })

  it('keeps overlays in a deterministic order', () => {
    expect(layoutTokens.layer.splash).toBeGreaterThan(layoutTokens.layer.toast)
    expect(layoutTokens.layer.toast).toBeGreaterThan(layoutTokens.layer.sheet)
    expect(layoutTokens.layer.sheet).toBeGreaterThan(
      layoutTokens.layer.navigation,
    )
  })
})

describe('type scale', () => {
  const steps = Object.values(typeScaleTokens)

  it('rises monotonically so a larger step is never visually smaller', () => {
    const sizes = steps.map((step) => step.px)
    expect(sizes).toStrictEqual([...sizes].sort((a, b) => a - b))
  })

  it('stays inside the minor-third ratio the brief asks for', () => {
    for (let index = 1; index < steps.length; index += 1) {
      const ratio = (steps[index]?.px ?? 0) / (steps[index - 1]?.px ?? 1)
      expect(ratio).toBeGreaterThan(1)
      expect(ratio).toBeLessThanOrEqual(1.6)
    }
  })

  it('loosens leading as size shrinks, so captions stay readable', () => {
    expect(typeScaleTokens.caption.leading).toBeGreaterThan(
      typeScaleTokens.display.leading,
    )
  })

  it('reserves the lore register for the two largest steps', () => {
    const loreSteps = steps.filter((step) => step.register === 'lore')
    expect(loreSteps).toStrictEqual([typeScaleTokens.lore, typeScaleTokens.display])
  })
})
