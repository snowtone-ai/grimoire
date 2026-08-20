export const CATALOG_SCHEMA = 1 as const;
export const CATALOG_CATEGORY_CAPACITY = 60 as const;
export const CATALOG_TOTAL_CAPACITY = 720 as const;

export const CATALOG_CATEGORIES = Object.freeze([
  Object.freeze({ id: "flora", label: "草花" }),
  Object.freeze({ id: "fungi", label: "菌類" }),
  Object.freeze({ id: "fruits-seeds", label: "果実と種" }),
  Object.freeze({ id: "minerals", label: "鉱物" }),
  Object.freeze({ id: "waterside", label: "水辺のもの" }),
  Object.freeze({ id: "feathers-castoffs", label: "羽根と抜け殻" }),
  Object.freeze({ id: "old-tools", label: "古道具" }),
  Object.freeze({ id: "magic-tools", label: "魔導具" }),
  Object.freeze({ id: "papers-books", label: "紙片と書物" }),
  Object.freeze({ id: "adornments", label: "装身具" }),
  Object.freeze({ id: "food", label: "食べもの" }),
  Object.freeze({ id: "oddities", label: "不可思議なもの" }),
] as const);

export type CatalogCategoryId = (typeof CATALOG_CATEGORIES)[number]["id"];

export interface CatalogItemDefinition {
  readonly schema: typeof CATALOG_SCHEMA;
  readonly id: string;
  readonly name: string;
  readonly categoryId: CatalogCategoryId;
  readonly description: string;
  /** Stable zero-based position within a category. */
  readonly sortOrder: number;
  readonly art: Readonly<{
    readonly src: string;
    readonly alt: string;
    readonly width: number;
    readonly height: number;
  }>;
}

export interface CatalogDiscovery {
  readonly schema: typeof CATALOG_SCHEMA;
  readonly itemId: string;
  readonly quantity: number;
  readonly firstDiscoveredAt: string;
  readonly lastDiscoveredAt: string;
}

export interface DiscoveredCatalogEntry {
  readonly definition: CatalogItemDefinition;
  readonly discovery: CatalogDiscovery;
}

export interface DiscoveredCatalogResolution {
  readonly entries: readonly DiscoveredCatalogEntry[];
  /** Discoveries retained by storage whose content definition is unavailable. */
  readonly orphanedItemIds: readonly string[];
}

type UnknownRecord = Record<string, unknown>;

const CATEGORY_IDS = new Set<string>(CATALOG_CATEGORIES.map(({ id }) => id));

function record(name: string, value: unknown): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value as UnknownRecord;
}

function exactKeys(name: string, value: UnknownRecord, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unexpected !== undefined) {
    throw new TypeError(`${name}.${unexpected} is not part of catalog schema 1`);
  }
}

function boundedText(name: string, value: unknown, max: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new RangeError(`${name} must be a non-empty string up to ${max} characters`);
  }
  return value;
}

function normalizedInstant(name: string, value: unknown): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be an ISO timestamp`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new RangeError(`${name} must be a valid timestamp`);
  return new Date(timestamp).toISOString();
}

function normalizeDefinition(source: unknown, index: number): CatalogItemDefinition {
  const item = record(`definitions[${index}]`, source);
  exactKeys(`definitions[${index}]`, item, [
    "schema",
    "id",
    "name",
    "categoryId",
    "description",
    "sortOrder",
    "art",
  ]);
  if (item.schema !== CATALOG_SCHEMA) {
    throw new RangeError(`definitions[${index}].schema must be ${CATALOG_SCHEMA}`);
  }
  if (typeof item.categoryId !== "string" || !CATEGORY_IDS.has(item.categoryId)) {
    throw new RangeError(`definitions[${index}].categoryId is unknown`);
  }
  if (
    !Number.isSafeInteger(item.sortOrder)
    || (item.sortOrder as number) < 0
    || (item.sortOrder as number) >= CATALOG_CATEGORY_CAPACITY
  ) {
    throw new RangeError(`definitions[${index}].sortOrder must be between 0 and 59`);
  }
  const art = record(`definitions[${index}].art`, item.art);
  exactKeys(`definitions[${index}].art`, art, ["src", "alt", "width", "height"]);
  if (
    !Number.isSafeInteger(art.width)
    || !Number.isSafeInteger(art.height)
    || (art.width as number) <= 0
    || (art.height as number) <= 0
    || (art.width as number) > 8_192
    || (art.height as number) > 8_192
  ) {
    throw new RangeError(`definitions[${index}].art dimensions are invalid`);
  }
  const src = boundedText(`definitions[${index}].art.src`, art.src, 512);
  if (!src.startsWith("/")) {
    throw new RangeError(`definitions[${index}].art.src must be a local absolute path`);
  }

  return Object.freeze({
    schema: CATALOG_SCHEMA,
    id: boundedText(`definitions[${index}].id`, item.id, 128),
    name: boundedText(`definitions[${index}].name`, item.name, 120),
    categoryId: item.categoryId as CatalogCategoryId,
    description: boundedText(`definitions[${index}].description`, item.description, 1_200),
    sortOrder: item.sortOrder as number,
    art: Object.freeze({
      src,
      alt: boundedText(`definitions[${index}].art.alt`, art.alt, 180),
      width: art.width as number,
      height: art.height as number,
    }),
  });
}

export function normalizeCatalogDefinitions(
  source: unknown,
  options: Readonly<{ requireComplete?: boolean }> = {},
): readonly CatalogItemDefinition[] {
  if (!Array.isArray(source)) throw new TypeError("catalog definitions must be an array");
  if (source.length > CATALOG_TOTAL_CAPACITY) {
    throw new RangeError(`catalog definitions cannot exceed ${CATALOG_TOTAL_CAPACITY}`);
  }
  const definitions = source.map(normalizeDefinition);
  const ids = new Set<string>();
  const slots = new Set<string>();
  const counts = new Map<CatalogCategoryId, number>();
  for (const definition of definitions) {
    if (ids.has(definition.id)) throw new RangeError(`duplicate catalog id: ${definition.id}`);
    ids.add(definition.id);
    const slot = `${definition.categoryId}:${definition.sortOrder}`;
    if (slots.has(slot)) throw new RangeError(`duplicate catalog position: ${slot}`);
    slots.add(slot);
    const count = (counts.get(definition.categoryId) ?? 0) + 1;
    if (count > CATALOG_CATEGORY_CAPACITY) {
      throw new RangeError(`${definition.categoryId} exceeds ${CATALOG_CATEGORY_CAPACITY} entries`);
    }
    counts.set(definition.categoryId, count);
  }
  if (options.requireComplete === true) {
    if (definitions.length !== CATALOG_TOTAL_CAPACITY) {
      throw new RangeError(`complete catalog must contain ${CATALOG_TOTAL_CAPACITY} definitions`);
    }
    for (const category of CATALOG_CATEGORIES) {
      if (counts.get(category.id) !== CATALOG_CATEGORY_CAPACITY) {
        throw new RangeError(`${category.id} must contain ${CATALOG_CATEGORY_CAPACITY} definitions`);
      }
    }
  }
  return Object.freeze(definitions);
}

export function normalizeCatalogDiscoveries(source: unknown): readonly CatalogDiscovery[] {
  if (!Array.isArray(source)) throw new TypeError("catalog discoveries must be an array");
  if (source.length > CATALOG_TOTAL_CAPACITY) {
    throw new RangeError(`catalog discoveries cannot exceed ${CATALOG_TOTAL_CAPACITY}`);
  }
  const ids = new Set<string>();
  const discoveries = source.map((entry, index) => {
    const discovery = record(`discoveries[${index}]`, entry);
    exactKeys(`discoveries[${index}]`, discovery, [
      "schema",
      "itemId",
      "quantity",
      "firstDiscoveredAt",
      "lastDiscoveredAt",
    ]);
    if (discovery.schema !== CATALOG_SCHEMA) {
      throw new RangeError(`discoveries[${index}].schema must be ${CATALOG_SCHEMA}`);
    }
    const itemId = boundedText(`discoveries[${index}].itemId`, discovery.itemId, 128);
    if (ids.has(itemId)) throw new RangeError(`duplicate discovery: ${itemId}`);
    ids.add(itemId);
    if (!Number.isSafeInteger(discovery.quantity) || (discovery.quantity as number) <= 0) {
      throw new RangeError(`discoveries[${index}].quantity must be a positive safe integer`);
    }
    const firstDiscoveredAt = normalizedInstant(
      `discoveries[${index}].firstDiscoveredAt`,
      discovery.firstDiscoveredAt,
    );
    const lastDiscoveredAt = normalizedInstant(
      `discoveries[${index}].lastDiscoveredAt`,
      discovery.lastDiscoveredAt,
    );
    if (Date.parse(lastDiscoveredAt) < Date.parse(firstDiscoveredAt)) {
      throw new RangeError(`discoveries[${index}] last discovery precedes the first`);
    }
    return Object.freeze({
      schema: CATALOG_SCHEMA,
      itemId,
      quantity: discovery.quantity as number,
      firstDiscoveredAt,
      lastDiscoveredAt,
    });
  });
  return Object.freeze(discoveries);
}

/** Resolves only discovered definitions. It never manufactures unknown slots. */
export function resolveDiscoveredCatalog(
  definitionsSource: unknown,
  discoveriesSource: unknown,
): DiscoveredCatalogResolution {
  const definitions = normalizeCatalogDefinitions(definitionsSource);
  const discoveries = normalizeCatalogDiscoveries(discoveriesSource);
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const entries: DiscoveredCatalogEntry[] = [];
  const orphanedItemIds: string[] = [];
  for (const discovery of discoveries) {
    const definition = byId.get(discovery.itemId);
    if (!definition) {
      orphanedItemIds.push(discovery.itemId);
      continue;
    }
    entries.push(Object.freeze({ definition, discovery }));
  }
  entries.sort((left, right) => (
    Date.parse(right.discovery.lastDiscoveredAt) - Date.parse(left.discovery.lastDiscoveredAt)
  ));
  return Object.freeze({
    entries: Object.freeze(entries),
    orphanedItemIds: Object.freeze(orphanedItemIds),
  });
}
