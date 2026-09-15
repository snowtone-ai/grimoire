import test from "node:test";
import assert from "node:assert/strict";
import {
  bountyProgress,
  bountyTaskId,
  getDailyBounties,
  hashDateKey,
  isBountyComplete,
} from "../../../src/lib/domain/bounty.ts";

test("daily bounties are deterministic and always start with departure", () => {
  const a = getDailyBounties("2026-07-20");
  const b = getDailyBounties("2026-07-20");
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  assert.equal(a[0].id, "start-1");
  assert.equal(a[2].id, "add-1");
  assert.match(a[1].id, /^complete-[123]$/);
});

test("complete target varies with the date but stays within 1-3", () => {
  const targets = new Set();
  for (let day = 1; day <= 28; day++) {
    const dateKey = `2026-07-${String(day).padStart(2, "0")}`;
    const bounty = getDailyBounties(dateKey)[1];
    assert.ok(bounty.target >= 1 && bounty.target <= 3);
    targets.add(bounty.target);
  }
  assert.ok(targets.size > 1, "targets should vary across a month");
  assert.equal(typeof hashDateKey("2026-07-20"), "number");
});

test("bountyProgress clamps to target and maps kinds to inputs", () => {
  const [start, complete, add] = getDailyBounties("2026-07-20");
  const input = { completedToday: 5, addedToday: 0, startedToday: 2 };
  assert.equal(bountyProgress(start, input), 1);
  assert.equal(bountyProgress(complete, input), complete.target);
  assert.equal(bountyProgress(add, input), 0);
  assert.equal(isBountyComplete(add, input), false);
  assert.equal(isBountyComplete(start, input), true);
});

test("bountyTaskId is stable and namespaced", () => {
  const [start] = getDailyBounties("2026-07-20");
  assert.equal(bountyTaskId(start), "bounty:start-1");
});
