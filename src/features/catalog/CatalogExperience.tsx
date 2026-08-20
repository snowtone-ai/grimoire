'use client'

import { BookOpen, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useAppReadModel } from '@/app/app-context'

import { CATALOG_DEFINITIONS } from './definitions'
import {
  CATALOG_CATEGORIES,
  resolveDiscoveredCatalog,
  type CatalogCategoryId,
  type DiscoveredCatalogEntry,
} from './model'
import styles from './catalog-experience.module.css'

type Shelf = 'creatures' | 'items'
type SortOrder = 'name' | 'recent'

const categoryById = new Map(CATALOG_CATEGORIES.map((category) => [category.id, category]))

function formatObservedAt(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function SpecimenGlyph({ categoryId }: { readonly categoryId: CatalogCategoryId }) {
  const index = CATALOG_CATEGORIES.findIndex(({ id }) => id === categoryId)
  const rotation = index * 19
  return (
    <svg
      aria-hidden="true"
      className={styles.specimenGlyph}
      data-category={categoryId}
      viewBox="0 0 160 160"
    >
      <circle cx="80" cy="80" r="55" />
      <path d="M80 25c-8 27-29 37-42 58 17-2 30 4 42 30 12-26 25-32 42-30-13-21-34-31-42-58Z" transform={`rotate(${rotation} 80 80)`} />
      <path d="M45 115c22-14 48-14 70 0M80 42v78" />
    </svg>
  )
}

function ItemDetail({ entry, onClose }: {
  readonly entry: DiscoveredCatalogEntry
  readonly onClose: () => void
}) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    closeButton.current?.focus()
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialog.current) return
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeys)
    return () => {
      document.documentElement.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeys)
      previouslyFocused?.focus()
    }
  }, [onClose])

  const category = categoryById.get(entry.definition.categoryId)
  return (
    <div className={styles.detailBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        ref={dialog}
        className={styles.detail}
        role="dialog"
        aria-modal="true"
        aria-labelledby="specimen-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button ref={closeButton} className={styles.closeButton} type="button" onClick={onClose}>
          <X aria-hidden="true" size={20} />
          <span className="sr-only">閉じる</span>
        </button>
        <div className={styles.detailPlate}>
          <SpecimenGlyph categoryId={entry.definition.categoryId} />
          <span aria-hidden="true">No. {String(entry.definition.sortOrder + 1).padStart(2, '0')}</span>
        </div>
        <div className={styles.detailCopy}>
          <p className={styles.eyebrow}>{category?.label ?? '標本記録'}</p>
          <h2 id="specimen-title">{entry.definition.name}</h2>
          <p>{entry.definition.description}</p>
          <dl>
            <div><dt>初発見</dt><dd>{formatObservedAt(entry.discovery.firstDiscoveredAt)}</dd></div>
            <div><dt>最近の発見</dt><dd>{formatObservedAt(entry.discovery.lastDiscoveredAt)}</dd></div>
            <div><dt>記録数</dt><dd>{entry.discovery.quantity}</dd></div>
          </dl>
        </div>
      </section>
    </div>
  )
}

export function CatalogExperience() {
  const { catalogDiscoveries } = useAppReadModel()
  const [shelf, setShelf] = useState<Shelf>('creatures')
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<'all' | CatalogCategoryId>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent')
  const [selected, setSelected] = useState<DiscoveredCatalogEntry | null>(null)

  const resolution = useMemo(() => resolveDiscoveredCatalog(
    CATALOG_DEFINITIONS,
    catalogDiscoveries.map((discovery) => ({ schema: 1, ...discovery })),
  ), [catalogDiscoveries])
  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ja-JP')
    const result = resolution.entries.filter(({ definition }) => {
      if (categoryId !== 'all' && definition.categoryId !== categoryId) return false
      return normalizedQuery.length === 0
        || definition.name.toLocaleLowerCase('ja-JP').includes(normalizedQuery)
        || definition.description.toLocaleLowerCase('ja-JP').includes(normalizedQuery)
    })
    return [...result].sort((left, right) => sortOrder === 'name'
      ? left.definition.name.localeCompare(right.definition.name, 'ja-JP')
      : Date.parse(right.discovery.lastDiscoveredAt) - Date.parse(left.discovery.lastDiscoveredAt))
  }, [categoryId, query, resolution.entries, sortOrder])
  const discoveredCategories = new Set(resolution.entries.map(({ definition }) => definition.categoryId))

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>FIELD ARCHIVE</p>
          <h1>観察図鑑</h1>
          <p>出会った姿と、手元に残った標本だけを記します。</p>
        </div>
        <BookOpen aria-hidden="true" className={styles.bookMark} />
      </header>

      <div className={styles.tabs} role="tablist" aria-label="図鑑の種類">
        <button type="button" role="tab" aria-selected={shelf === 'creatures'} onClick={() => setShelf('creatures')}>グリモ</button>
        <button type="button" role="tab" aria-selected={shelf === 'items'} onClick={() => setShelf('items')}>アイテム</button>
      </div>

      {shelf === 'creatures' ? (
        <section className={styles.creatureLedger} role="tabpanel" aria-label="グリモの観察記録">
          <div className={styles.creaturePlate}>
            <span className={styles.waterEgg} aria-hidden="true" />
            <p>観察個体 01</p>
          </div>
          <article>
            <p className={styles.eyebrow}>WATER LINEAGE · EGG</p>
            <h2>水の仔、卵の姿</h2>
            <p>内側を巡る淡い水流は、触れた気配にだけゆっくり向きを変える。まだ名を持たない、最初の観察記録。</p>
            <dl>
              <div><dt>段階</dt><dd>卵</dd></div>
              <div><dt>属性</dt><dd>水</dd></div>
              <div><dt>観察域</dt><dd>霧光の珊瑚台地</dd></div>
            </dl>
          </article>
        </section>
      ) : (
        <section className={styles.itemLedger} role="tabpanel" aria-label="アイテムの標本記録">
          <div className={styles.tools}>
            <label className={styles.search}>
              <Search aria-hidden="true" size={17} />
              <span className="sr-only">標本名を検索</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="標本名を検索" />
            </label>
            <select value={categoryId} aria-label="分類" onChange={(event) => setCategoryId(event.target.value as 'all' | CatalogCategoryId)}>
              <option value="all">すべての分類</option>
              {CATALOG_CATEGORIES.filter(({ id }) => discoveredCategories.has(id)).map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
            <select value={sortOrder} aria-label="並び順" onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
              <option value="recent">最近の発見順</option>
              <option value="name">名前順</option>
            </select>
          </div>

          {visibleEntries.length > 0 ? (
            <div className={styles.specimenGrid}>
              {visibleEntries.map((entry) => (
                <button key={entry.definition.id} type="button" className={styles.specimenCard} onClick={() => setSelected(entry)}>
                  <span className={styles.specimenPlate}><SpecimenGlyph categoryId={entry.definition.categoryId} /></span>
                  <span className={styles.specimenCopy}>
                    <strong>{entry.definition.name}</strong>
                    <small>{categoryById.get(entry.definition.categoryId)?.label}</small>
                  </span>
                  {entry.discovery.quantity > 1 ? <span className={styles.quantity}>×{entry.discovery.quantity}</span> : null}
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <BookOpen aria-hidden="true" size={31} />
              <h2>{resolution.entries.length === 0 ? 'まだ標本はありません' : '一致する標本がありません'}</h2>
              <p>{resolution.entries.length === 0 ? 'ホームでタスクを記し、完了すると最初の標本に出会えます。' : '検索語か分類を変えてください。'}</p>
            </div>
          )}
        </section>
      )}

      {selected ? <ItemDetail entry={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  )
}
