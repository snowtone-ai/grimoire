import test from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_CAROL_INPUT,
  decideCarolPointer,
  normalizeCarolContact,
} from "../../../src/lib/domain/grimo-input.ts";
import {
  CAROL,
  GRIMO_COMPANIONS,
  carolTouchImpulse,
  classifyCarolTouch,
} from "../../../src/lib/domain/grimo-companions.ts";
import { carolReactionStyle, inferCarolMoveReaction } from "../../../src/lib/domain/grimo-reactions.ts";

test("Carol accepts one primary pointer and ignores competing contacts", () => {
  const started = decideCarolPointer(INITIAL_CAROL_INPUT, {
    type: "down", pointerId: 11, isPrimary: true,
  });
  assert.equal(started.capture, true);
  assert.equal(started.contact, true);
  assert.equal(started.state.activePointerId, 11);

  const second = decideCarolPointer(started.state, {
    type: "down", pointerId: 12, isPrimary: true,
  });
  const nonPrimary = decideCarolPointer(INITIAL_CAROL_INPUT, {
    type: "down", pointerId: 12, isPrimary: false,
  });
  assert.equal(second.state.activePointerId, 11);
  assert.equal(second.contact, false);
  assert.deepEqual(nonPrimary, {
    state: INITIAL_CAROL_INPUT, contact: false, release: false, capture: false, releaseCapture: false,
  });
});

test("Carol only moves and releases the pointer that owns the contact", () => {
  const state = { activePointerId: 11 };
  assert.equal(decideCarolPointer(state, { type: "move", pointerId: 12 }).contact, false);
  assert.equal(decideCarolPointer(state, { type: "up", pointerId: 12 }).release, false);

  const moved = decideCarolPointer(state, { type: "move", pointerId: 11 });
  const ended = decideCarolPointer(moved.state, { type: "cancel", pointerId: 11 });
  assert.equal(moved.contact, true);
  assert.equal(ended.release, true);
  assert.equal(ended.releaseCapture, true);
  assert.equal(ended.state.activePointerId, null);
});

test("lost capture, blur, and hidden-page interruption release an active contact once", () => {
  for (const event of [
    { type: "lostcapture", pointerId: 11 },
    { type: "interrupt" },
  ]) {
    const released = decideCarolPointer({ activePointerId: 11 }, event);
    assert.equal(released.release, true);
    assert.equal(released.state.activePointerId, null);
    assert.equal(decideCarolPointer(released.state, { type: "interrupt" }).release, false);
  }
});

test("Carol contact coordinates are finite, stage-local, and bounded", () => {
  const bounds = { left: 10, top: 20, width: 200, height: 100 };
  assert.deepEqual(normalizeCarolContact(110, 70, bounds), { x: 0, y: 0 });
  assert.deepEqual(normalizeCarolContact(-40, 220, bounds), { x: -1, y: -1 });
  assert.deepEqual(normalizeCarolContact(400, -20, bounds), { x: 1, y: 1 });
  assert.equal(normalizeCarolContact(0, 0, { ...bounds, width: 0 }), null);
  assert.equal(normalizeCarolContact(Number.NaN, 0, bounds), null);
});

test("Carol gives a distinct, bounded reply for each meaningful touch area", () => {
  assert.equal(GRIMO_COMPANIONS.length, 5);
  assert.deepEqual(GRIMO_COMPANIONS.map(({ id }) => id), ["carol", "pino", "jill", "shushu", "muu"]);
  assert.equal(CAROL.assetPath, "/grimo/carol-transparent.png");

  const zones = [
    classifyCarolTouch({ x: 0, y: 0.8 }),
    classifyCarolTouch({ x: 0.4, y: 0.2 }),
    classifyCarolTouch({ x: -0.7, y: 0 }),
    classifyCarolTouch({ x: 0.85, y: 0 }),
    classifyCarolTouch({ x: 0, y: -0.7 }),
  ];
  assert.deepEqual(zones, ["crown", "face", "left-fleece", "right-fleece", "feet"]);
  assert.notDeepEqual(carolTouchImpulse("left-fleece"), carolTouchImpulse("right-fleece"));
  assert.notDeepEqual(carolTouchImpulse("face"), carolTouchImpulse("feet"));
});

test("Carol's gesture grammar has distinct reactions without queueing a clip", () => {
  assert.equal(inferCarolMoveReaction(0.04, 600), "hold");
  assert.equal(inferCarolMoveReaction(0.1, 120), "slow-stroke");
  assert.equal(inferCarolMoveReaction(0.5, 120), "drag");
  assert.ok(carolReactionStyle("repeat-tap", "face").stars > carolReactionStyle("repeat-tap", "feet").stars);
  assert.ok(carolReactionStyle("poke", "feet").cloud > carolReactionStyle("poke", "face").cloud);
});
