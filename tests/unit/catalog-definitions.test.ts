import { describe, expect, it } from 'vitest'

import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_CAPACITY,
  CATALOG_DEFINITIONS,
  CATALOG_TOTAL_CAPACITY,
} from '@/features/catalog'

/**
 * The first reviewed specimen in each category. These ids are permanent
 * identifiers (see `src/features/catalog/definitions.ts`): rewards already
 * granted for one of them must keep resolving to the same name forever, even
 * as the rest of the 720-item corpus is written, edited, or reorganized.
 */
const PERMANENT_SPECIMENS: ReadonlyArray<readonly [id: string, name: string]> = [
  ['flora-00', '月白の露花'],
  ['fungi-00', '灯し胞子茸'],
  ['fruits-seeds-00', '星殻の種'],
  ['minerals-00', '薄明晶'],
  ['waterside-00', '潮待ちの小瓶'],
  ['feathers-castoffs-00', '雲渡りの羽根'],
  ['old-tools-00', '苔むす測り針'],
  ['magic-tools-00', '余光の鍵'],
  ['papers-books-00', '雨読みの断章'],
  ['adornments-00', '水脈の耳飾り'],
  ['food-00', '琥珀蜜の焼菓子'],
  ['oddities-00', '眠らない影石'],
]

describe('CATALOG_DEFINITIONS (T021 full corpus)', () => {
  it('contains exactly 720 items', () => {
    expect(CATALOG_DEFINITIONS.length).toBe(720)
    expect(CATALOG_DEFINITIONS.length).toBe(CATALOG_TOTAL_CAPACITY)
  })

  it('declares exactly 12 categories', () => {
    expect(CATALOG_CATEGORIES.length).toBe(12)
  })

  it('contains exactly 60 items per category', () => {
    for (const category of CATALOG_CATEGORIES) {
      const count = CATALOG_DEFINITIONS.filter((definition) => definition.categoryId === category.id).length
      expect(count).toBe(CATALOG_CATEGORY_CAPACITY)
    }
  })

  it('has a unique id for every item', () => {
    const ids = CATALOG_DEFINITIONS.map((definition) => definition.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a unique name for every item', () => {
    const names = CATALOG_DEFINITIONS.map((definition) => definition.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('has a unique description for every item', () => {
    const descriptions = CATALOG_DEFINITIONS.map((definition) => definition.description)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it('has a contiguous zero-based sortOrder within every category', () => {
    const expected = Array.from({ length: CATALOG_CATEGORY_CAPACITY }, (_, index) => index)
    for (const category of CATALOG_CATEGORIES) {
      const sortOrders = CATALOG_DEFINITIONS
        .filter((definition) => definition.categoryId === category.id)
        .map((definition) => definition.sortOrder)
        .sort((left, right) => left - right)
      expect(sortOrders).toEqual(expected)
    }
  })

  it('keeps the 12 permanent ids mapped to their original names', () => {
    const nameById = new Map(CATALOG_DEFINITIONS.map((definition) => [definition.id, definition.name]))
    for (const [id, name] of PERMANENT_SPECIMENS) {
      expect(nameById.get(id)).toBe(name)
    }
  })
})
