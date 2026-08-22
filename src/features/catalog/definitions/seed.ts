/**
 * Content-only shape for one catalog specimen, authored per category before
 * `art`, `categoryId`, and `sortOrder` are attached by the aggregator in
 * `../definitions.ts`. Keeping this flat makes each category file a plain,
 * reviewable list with nothing but the id, the name, and the description.
 */
export interface CatalogSeed {
  readonly id: string
  readonly name: string
  readonly description: string
}
