import {
  TASK_CATEGORY_IDS,
  TASK_CATEGORY_LABELS,
  type TaskCategoryId,
} from '@/app/ui-port'

/**
 * Category presentation. The swatch is the *only* place a category's colour is
 * allowed to appear (決定事項ログ F-7 asks for a category colour; DESIGN.md §1.1
 * keeps saturated colour reserved for Mist), so it is defined once, here, and
 * never inlined into a screen.
 */
export interface TaskCategoryPresentation {
  readonly id: TaskCategoryId
  readonly label: string
  readonly swatch: string
}

export const TASK_CATEGORIES: readonly TaskCategoryPresentation[] = Object.freeze(
  TASK_CATEGORY_IDS.map((id) =>
    Object.freeze({
      id,
      label: TASK_CATEGORY_LABELS[id],
      swatch: `var(--color-category-${id})`,
    }),
  ),
)

export const UNCATEGORIZED_SWATCH = 'var(--color-category-none)'
export const UNCATEGORIZED_LABEL = '分類なし'

export function categoryLabel(id: TaskCategoryId | null): string {
  return id === null ? UNCATEGORIZED_LABEL : TASK_CATEGORY_LABELS[id]
}

export function categorySwatch(id: TaskCategoryId | null): string {
  return id === null ? UNCATEGORIZED_SWATCH : `var(--color-category-${id})`
}
