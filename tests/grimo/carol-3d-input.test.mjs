import test from "node:test";
import assert from "node:assert/strict";
import { beginCarolContact, moveCarolContact, heldCarolGesture, finishCarolContact } from "../../src/lib/domain/carol-3d-input.ts";

test("short release retains poke; stationary contact becomes hold", () => {
  const input = beginCarolContact(100, 100, 0);
  assert.equal(finishCarolContact(input, 100), "poke");
  assert.equal(heldCarolGesture(input, 519), "touch");
  assert.equal(heldCarolGesture(input, 520), "hold");
  assert.equal(finishCarolContact(input, 800), "hold");
});

test("slow stroke cancels hold even when returning to its origin", () => {
  let input = beginCarolContact(100, 100, 0);
  input = moveCarolContact(input, 130, 100, 200);
  input = moveCarolContact(input, 100, 100, 500);
  assert.equal(heldCarolGesture(input, 900), "pet");
  assert.equal(finishCarolContact(input, 1000), "pet");
});

test("fast swipe is neither pet nor accidental hold", () => {
  const input = moveCarolContact(beginCarolContact(0, 0, 0), 100, 0, 15);
  assert.equal(heldCarolGesture(input, 900), "touch");
  assert.equal(finishCarolContact(input, 950), "touch");
});
