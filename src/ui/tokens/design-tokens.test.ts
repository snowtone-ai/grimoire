import { describe, expect, it } from 'vitest'

import { interactionTokens, layoutTokens } from './design-tokens'

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
