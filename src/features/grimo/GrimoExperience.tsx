'use client'

import { Layers, NotebookPen } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAppPort, useAppReadModel } from '@/app/app-context'
import { AreaAmbience, useSound } from '@/audio'
import { IconButton, IconLink } from '@/ui/components/icon-button'
import { Sheet } from '@/ui/components/sheet'
import { WorldSurface } from '@/ui/components/world-surface'
import { AREAS, findArea } from '@/world/areas'
import {
  EMPTY_WORLD_MEDIA,
  loadWorldMediaManifest,
  type WorldMediaManifest,
} from '@/world/media-manifest'

import styles from './grimo-experience.module.css'

/**
 * 決定事項ログ F-6 / F-14 — opening Grimo shows the selected area and the
 * creature, and nothing else. No panels, no progress, no reward surface. The
 * only permanent controls are the shared bottom navigation and one transparent
 * area-picker button just above it.
 *
 * The creature itself is not built yet (D-014 fixes its production pipeline);
 * until its asset exists the world stands alone, which is a real product state
 * rather than a placeholder — the area is worth looking at on its own.
 */
export function GrimoExperience() {
  const port = useAppPort()
  const { preferences, world } = useAppReadModel()
  const [media, setMedia] = useState<WorldMediaManifest>(EMPTY_WORLD_MEDIA)
  const [pickerOpen, setPickerOpen] = useState(false)
  const play = useSound()

  useEffect(() => {
    const controller = new AbortController()
    void loadWorldMediaManifest(controller.signal).then(setMedia)
    return () => controller.abort()
  }, [])

  const area = findArea(world.selectedAreaId)

  async function selectArea(areaId: string) {
    if (areaId !== area.id) await port.selectArea({ areaId })
    setPickerOpen(false)
    play('sheetClose')
  }

  return (
    <main id="main-content" className={styles.screen}>
      <AreaAmbience
        areaId={area.id}
        enabled={preferences.bgmEnabled}
        track={media.bgm[area.id] ?? null}
      />

      <WorldSurface area={area} media={media.areas[area.id] ?? null}>
        <div className={styles.topChrome}>
          <h1 className={styles.areaName}>{area.name}</h1>
          {world.unreadObservationCount > 0 ? (
            <IconLink
              href="/catalog"
              surface="chrome"
              label={`新しい観察記録 ${world.unreadObservationCount}件`}
              icon={
                <span className={styles.markWrap}>
                  <NotebookPen aria-hidden="true" strokeWidth={1.65} />
                  <span className={styles.mark} aria-hidden="true" />
                </span>
              }
            />
          ) : null}
        </div>

        <div className={styles.bottomChrome}>
          <IconButton
            surface="chrome"
            size="lg"
            label="エリアを選ぶ"
            icon={<Layers aria-hidden="true" strokeWidth={1.65} />}
            onClick={() => {
              setPickerOpen(true)
              play('sheetOpen')
            }}
          />
        </div>
      </WorldSurface>

      <Sheet
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false)
          play('sheetClose')
        }}
        title="エリア"
        description="選ぶとすぐに切り替わります。行き来は自由です。"
      >
        <ul role="list" className={styles.areaList}>
          {AREAS.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={styles.areaOption}
                aria-current={entry.id === area.id ? 'true' : undefined}
                onClick={() => void selectArea(entry.id)}
              >
                <span
                  className={styles.areaSwatch}
                  style={{ background: entry.posterGradient }}
                  aria-hidden="true"
                />
                <span className={styles.areaText}>
                  <span className={styles.areaOptionName}>{entry.name}</span>
                  <span className={styles.areaSummary}>{entry.summary}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </main>
  )
}
