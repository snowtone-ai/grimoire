import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WorldSurface } from '@/ui/components/world-surface'
import { AREAS } from '@/world/areas'
import type { WorldMediaEntry } from '@/world/media-manifest'

const area = AREAS[0]

const footage: WorldMediaEntry = {
  poster: '/world/area-01-coral-plateau.poster.jpg',
  sources: [
    { src: '/world/area-01-coral-plateau.webm', type: 'video/webm' },
    { src: '/world/area-01-coral-plateau.mp4', type: 'video/mp4' },
  ],
}

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.motion
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})

/**
 * D-013 / DESIGN.md §6.5 — the world has three states and the last one always
 * exists. These tests exist because the first two depend on assets the owner
 * has not delivered yet: the screen must open regardless, or the app would be
 * unusable until a video lands.
 */
describe('WorldSurface', () => {
  it('opens on the area ambience when no footage has been supplied', () => {
    const { container } = render(<WorldSurface area={area} media={null} />)

    expect(container.querySelector('video')).toBeNull()
    expect(container.innerHTML).toContain('radial-gradient')
  })

  it('offers every source it was given, in the order the manifest listed them', () => {
    const { container } = render(<WorldSurface area={area} media={footage} />)

    const sources = [...container.querySelectorAll('video source')].map((source) =>
      source.getAttribute('src'),
    )
    expect(sources).toEqual([
      '/world/area-01-coral-plateau.webm',
      '/world/area-01-coral-plateau.mp4',
    ])
    expect(container.querySelector('video')?.getAttribute('poster')).toBe(footage.poster)
  })

  it('never mounts the video under a reduced-motion preference', () => {
    document.documentElement.dataset.motion = 'reduced'

    const { container } = render(<WorldSurface area={area} media={footage} />)

    // Not merely paused: pausing still costs the decode and a first-frame
    // flash, so the element must not exist at all (決定事項ログ E-5).
    expect(container.querySelector('video')).toBeNull()
    expect(container.innerHTML).toContain('radial-gradient')
  })

  it('keeps chrome drawn above the world rather than inside it', () => {
    const { getByRole } = render(
      <WorldSurface area={area} media={null}>
        <button type="button">エリアを選ぶ</button>
      </WorldSurface>,
    )

    expect(getByRole('button', { name: 'エリアを選ぶ' })).toBeTruthy()
  })
})
