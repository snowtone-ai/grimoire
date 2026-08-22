'use client'

import Image from 'next/image'
import { Search, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { useAppReadModel } from '@/app/app-context'
import type { CatalogDiscoveryView, CreatureObservationView } from '@/app/ui-port'
import { useSound } from '@/audio'
import { Chip } from '@/ui/components/chip'
import { TextInput } from '@/ui/components/field'
import { IconButton } from '@/ui/components/icon-button'
import { useModalBehaviour } from '@/ui/hooks/use-modal-behaviour'

import styles from './catalog-experience.module.css'
import { CREATURE_RECORDS } from './creature-records'
import { CATALOG_DEFINITIONS } from './definitions'
import {
  CATALOG_CATEGORIES,
  resolveDiscoveredCatalog,
  type CatalogCategoryId,
  type DiscoveredCatalogEntry,
} from './model'

type Layer = 'creatures' | 'items'
type Ordering = 'name' | 'recent'

/**
 * 決定事項ログ M-10 / M-11 — one screen, two journals.
 *
 * The item catalog shows only what has been discovered: no empty slots, no
 * totals, no completion percentage. The creature journal is the opposite by
 * design — unseen records stay as silhouettes, because the point there is to
 * suggest that more of the animal exists, not to set a target.
 */
export function CatalogExperience() {
  const { catalogDiscoveries, creatureObservations } = useAppReadModel()
  const [layer, setLayer] = useState<Layer>('items')
  const play = useSound()

  return (
    <main id="main-content" className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>図鑑</h1>
        <div className={styles.layerTabs} role="tablist" aria-label="図鑑の種類">
          <button
            type="button"
            role="tab"
            className={styles.layerTab}
            aria-selected={layer === 'items'}
            onClick={() => {
              setLayer('items')
              play('catalogPage')
            }}
          >
            アイテム
          </button>
          <button
            type="button"
            role="tab"
            className={styles.layerTab}
            aria-selected={layer === 'creatures'}
            onClick={() => {
              setLayer('creatures')
              play('catalogPage')
            }}
          >
            グリモ
          </button>
        </div>
      </header>

      {layer === 'items' ? (
        <ItemJournal discoveries={catalogDiscoveries} />
      ) : (
        <CreatureJournal observations={creatureObservations} />
      )}
    </main>
  )
}

function ItemJournal({
  discoveries,
}: {
  readonly discoveries: readonly CatalogDiscoveryView[]
}) {
  const [category, setCategory] = useState<CatalogCategoryId | null>(null)
  const [query, setQuery] = useState('')
  const [ordering, setOrdering] = useState<Ordering>('recent')
  const [openEntry, setOpenEntry] = useState<DiscoveredCatalogEntry | null>(null)
  const play = useSound()

  const resolved = useMemo(
    () => resolveDiscoveredCatalog(CATALOG_DEFINITIONS, discoveries),
    [discoveries],
  )

  const visible = useMemo(() => {
    const needle = query.trim()
    const filtered = resolved.entries.filter((entry) => {
      if (category !== null && entry.definition.categoryId !== category) return false
      if (needle !== '' && !entry.definition.name.includes(needle)) return false
      return true
    })
    return ordering === 'name'
      ? filtered.toSorted((left, right) =>
          left.definition.name.localeCompare(right.definition.name, 'ja'),
        )
      : filtered
  }, [category, ordering, query, resolved.entries])

  if (resolved.entries.length === 0) {
    return (
      <p className={styles.empty}>
        まだ何も収めていません。タスクを書き留めるか、ひとつ終えると、
        最初の標本がここに並びます。
      </p>
    )
  }

  return (
    <>
      <div className={styles.controls}>
        <TextInput
          label="名前で探す"
          labelHidden
          type="search"
          value={query}
          placeholder="名前で探す"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className={styles.orderRow}>
          <Chip pressed={ordering === 'recent'} onClick={() => setOrdering('recent')}>
            最近入手
          </Chip>
          <Chip pressed={ordering === 'name'} onClick={() => setOrdering('name')}>
            名前順
          </Chip>
        </div>
        <div className={styles.categoryRow}>
          <Chip pressed={category === null} onClick={() => setCategory(null)}>
            すべて
          </Chip>
          {CATALOG_CATEGORIES.map((entry) => (
            <Chip
              key={entry.id}
              pressed={category === entry.id}
              onClick={() => setCategory(entry.id)}
            >
              {entry.label}
            </Chip>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className={styles.empty}>
          <Search aria-hidden="true" size={18} strokeWidth={1.6} />
          その条件に合う標本はまだ見つかっていません。
        </p>
      ) : (
        <ul role="list" className={styles.grid}>
          {visible.map((entry) => (
            <li key={entry.definition.id}>
              <button
                type="button"
                className={styles.specimen}
                onClick={() => {
                  setOpenEntry(entry)
                  play('catalogOpen')
                }}
              >
                <span className={styles.plate}>
                  <Image
                    src={entry.definition.art.src}
                    alt=""
                    width={entry.definition.art.width}
                    height={entry.definition.art.height}
                  />
                  {entry.discovery.quantity > 1 ? (
                    <span className={styles.quantity}>×{entry.discovery.quantity}</span>
                  ) : null}
                </span>
                <span className={styles.specimenName}>{entry.definition.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {openEntry === null ? null : (
        <SpecimenDetail
          entry={openEntry}
          onClose={() => {
            setOpenEntry(null)
            play('catalogPage')
          }}
        />
      )}
    </>
  )
}

/**
 * 決定事項ログ M-10: the detail is full-screen so the plate can lead. It is not a
 * sheet — a sheet would keep the grid visible and halve the illustration.
 */
function SpecimenDetail({
  entry,
  onClose,
}: {
  readonly entry: DiscoveredCatalogEntry
  readonly onClose: () => void
}) {
  const surface = useRef<HTMLDivElement>(null)
  useModalBehaviour(surface, true, onClose)

  const categoryLabel =
    CATALOG_CATEGORIES.find((category) => category.id === entry.definition.categoryId)
      ?.label ?? ''

  return (
    <div
      ref={surface}
      className={styles.detail}
      role="dialog"
      aria-modal="true"
      aria-label={entry.definition.name}
      tabIndex={-1}
    >
      <div className={styles.detailBar}>
        <IconButton
          label="図鑑へ戻る"
          icon={<X aria-hidden="true" strokeWidth={1.65} />}
          onClick={onClose}
        />
      </div>
      <figure className={styles.detailFigure}>
        <Image
          className={styles.detailPlate}
          src={entry.definition.art.src}
          alt={entry.definition.art.alt}
          width={entry.definition.art.width}
          height={entry.definition.art.height}
          priority
        />
        <figcaption className={styles.detailCopy}>
          <p className={styles.detailCategory}>{categoryLabel}</p>
          <h2 className={styles.detailName}>{entry.definition.name}</h2>
          <p className={styles.detailDescription}>{entry.definition.description}</p>
          <p className={styles.detailMeta}>
            はじめて手にした日 {formatDiscovered(entry.discovery.firstDiscoveredAt)}
          </p>
        </figcaption>
      </figure>
    </div>
  )
}

function formatDiscovered(instant: string): string {
  const date = new Date(instant)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function CreatureJournal({
  observations,
}: {
  readonly observations: readonly CreatureObservationView[]
}) {
  const observedAt = useMemo(
    () => new Map(observations.map((entry) => [entry.id, entry.observedAt])),
    [observations],
  )

  return (
    <ul role="list" className={styles.records}>
      {CREATURE_RECORDS.map((record) => {
        const seen = observedAt.get(record.id) ?? null
        return (
          <li
            key={record.id}
            className={styles.record}
            data-unseen={seen === null ? '' : undefined}
          >
            <span className={styles.recordSilhouette} aria-hidden="true" />
            <div className={styles.recordText}>
              <p className={styles.recordName}>{seen === null ? '未観察' : record.name}</p>
              <p className={styles.recordNote}>
                {seen === null
                  ? 'グリモのそばで過ごすうちに、そのうち書き加わります。'
                  : record.note}
              </p>
              {seen === null ? null : (
                <p className={styles.recordMeta}>
                  はじめて見た日 {formatDiscovered(seen)}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
