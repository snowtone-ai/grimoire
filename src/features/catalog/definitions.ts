import { normalizeCatalogDefinitions } from './model'
import { ADORNMENTS_SEEDS } from './definitions/adornments'
import { FEATHERS_CASTOFFS_SEEDS } from './definitions/feathers-castoffs'
import { FLORA_SEEDS } from './definitions/flora'
import { FOOD_SEEDS } from './definitions/food'
import { FRUITS_SEEDS_SEEDS } from './definitions/fruits-seeds'
import { FUNGI_SEEDS } from './definitions/fungi'
import { MAGIC_TOOLS_SEEDS } from './definitions/magic-tools'
import { MINERALS_SEEDS } from './definitions/minerals'
import { ODDITIES_SEEDS } from './definitions/oddities'
import { OLD_TOOLS_SEEDS } from './definitions/old-tools'
import { PAPERS_BOOKS_SEEDS } from './definitions/papers-books'
import { WATERSIDE_SEEDS } from './definitions/waterside'

/**
 * Each category is authored as a flat, reviewable list of `{ id, name,
 * description }` in its own file under `./definitions/` (see `./definitions/seed.ts`
 * for the shared `CatalogSeed` shape). This aggregator is the single place that
 * attaches `categoryId`, `sortOrder` (the zero-based array position within the
 * category), and the shared placeholder `art` before validating the full corpus.
 *
 * IDs are permanent: rewards and the catalog both import this same corpus so a
 * discovered item can never drift to a different entry after an app update. The
 * first entry of every category (`*-00`) is the original reviewed specimen and
 * must keep its existing id/name/description.
 */
const CATEGORY_SEEDS = [
  ['flora', FLORA_SEEDS],
  ['fungi', FUNGI_SEEDS],
  ['fruits-seeds', FRUITS_SEEDS_SEEDS],
  ['minerals', MINERALS_SEEDS],
  ['waterside', WATERSIDE_SEEDS],
  ['feathers-castoffs', FEATHERS_CASTOFFS_SEEDS],
  ['old-tools', OLD_TOOLS_SEEDS],
  ['magic-tools', MAGIC_TOOLS_SEEDS],
  ['papers-books', PAPERS_BOOKS_SEEDS],
  ['adornments', ADORNMENTS_SEEDS],
  ['food', FOOD_SEEDS],
  ['oddities', ODDITIES_SEEDS],
] as const

export const CATALOG_DEFINITIONS = normalizeCatalogDefinitions(
  CATEGORY_SEEDS.flatMap(([categoryId, seeds]) => seeds.map((seed, sortOrder) => ({
    schema: 1,
    id: seed.id,
    name: seed.name,
    categoryId,
    description: seed.description,
    sortOrder,
    art: {
      src: '/brand/grimoire-seal.svg',
      alt: `${seed.name}の標本印`,
      width: 512,
      height: 512,
    },
  }))),
  { requireComplete: true },
)

export const CATALOG_REWARD_POOL = Object.freeze(
  CATALOG_DEFINITIONS.map(({ id }) => Object.freeze({ itemId: id, weight: 1 })),
)
