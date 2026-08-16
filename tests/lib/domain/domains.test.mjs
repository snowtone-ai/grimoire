import test from "node:test";
import assert from "node:assert/strict";
import { DROP_CATALOG } from "../../../src/lib/domain/drops.ts";
import { DOMAINS, getDomainById } from "../../../src/lib/domain/domains.ts";

/* Fantasy item visual overhaul (prototype). Every item that opts into the
 * new domain-driven presentation must resolve a real domain and carry the
 * full new-style field set — a half-filled item would silently fall back
 * to the legacy emoji-only render path with no warning. */

const FANTASY_ITEMS = DROP_CATALOG.filter((drop) => drop.domain !== undefined);

test("at least one prototype item exists", () => {
  assert.ok(FANTASY_ITEMS.length > 0);
});

test("every domain id used by a catalog item resolves via getDomainById", () => {
  for (const drop of FANTASY_ITEMS) {
    assert.ok(getDomainById(drop.domain), `${drop.id} has unknown domain "${drop.domain}"`);
  }
});

test("every domain-tagged item carries the full new-style field set", () => {
  for (const drop of FANTASY_ITEMS) {
    assert.ok(drop.model && drop.model.length > 0, `${drop.id} needs a model path`);
    assert.ok(drop.params && drop.params.length > 0, `${drop.id} needs params`);
    assert.equal(drop.region, "fantasy", `${drop.id} must use the fantasy region sentinel`);
  }
});

test("every DOMAINS entry is actually used by at least one catalog item", () => {
  const usedDomains = new Set(FANTASY_ITEMS.map((drop) => drop.domain));
  for (const domain of DOMAINS) {
    assert.ok(usedDomains.has(domain.id), `domain ${domain.id} has no catalog items`);
  }
});

test("domain accents are valid hex colors", () => {
  for (const domain of DOMAINS) {
    assert.match(domain.accent, /^#[0-9a-fA-F]{6}$/, `${domain.id} has a hex accent`);
  }
});
