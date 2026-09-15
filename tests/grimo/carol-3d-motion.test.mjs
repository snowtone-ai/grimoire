import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { CAROL_MORPHS, applyCarolPerformance, clampCarolUnit } from "../../src/components/grimo/carol-3d-motion.ts";

test("Carol keeps only facial performance controls; no walking rig remains", () => {
  assert.deepEqual(CAROL_MORPHS, ["Blink", "Smile", "Surprise", "Squint", "LookLeft", "LookRight", "LookUp", "LookDown"]);
  const screen = readFileSync(new URL("../../src/components/grimo/carol-3d-screen.tsx", import.meta.url), "utf8");
  const world = readFileSync(new URL("../../src/components/grimo/carol-3d-world.ts", import.meta.url), "utf8");
  assert.doesNotMatch(screen, /歩いてみて|act\("walk"\)/);
  assert.doesNotMatch(world, /sampleCarolWalk|CAROL_LEGS/);
});

test("Carol performance never accepts non-finite or negative deformation state", () => {
  const body = new THREE.Object3D(); body.name = "Body"; body.scale.set(1.7, .8, 1.2);
  const tail = new THREE.Object3D(); tail.name = "Tail"; tail.scale.set(.6, 1.4, .9);
  const face = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  face.morphTargetDictionary = Object.fromEntries(CAROL_MORPHS.map((name, index) => [name, index]));
  face.morphTargetInfluences = CAROL_MORPHS.map(() => 0);
  const nodes = new Map([["Body", body], ["Tail", tail]]);
  const bases = new Map([...nodes].map(([name, node]) => [name, {
    position: node.position.clone(), rotation: node.rotation.clone(), scale: node.scale.clone(),
  }]));

  applyCarolPerformance({ nodes, bases, faces: [face] }, {
    time: 0, reduced: true, joy: -8, surprise: Number.NaN, lean: Number.POSITIVE_INFINITY,
    compression: -3, lookX: 0, lookY: 0, contactPart: "Head", weight: 0, gesture: "touch", feedAge: 2, reactionAge: 0,
  });

  assert.deepEqual(body.scale.toArray(), [1.7, .8, 1.2], "Body restores its authored scale, not unit scale");
  assert.deepEqual(tail.scale.toArray(), [.6, 1.4, .9], "Tail restores its authored scale, not unit scale");
  assert.ok(face.morphTargetInfluences.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  assert.equal(clampCarolUnit(-.1), 0);
  assert.equal(clampCarolUnit(1.1), 1);
  assert.equal(clampCarolUnit(Number.NaN), 0);
});

test("tail startle is a finite rooted-tuck-then-snap performance", () => {
  const body = new THREE.Object3D(); body.name = "Body";
  const tail = new THREE.Object3D(); tail.name = "Tail";
  const face = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  face.morphTargetDictionary = { Blink: 0, Surprise: 1 };
  face.morphTargetInfluences = [0, 0];
  const nodes = new Map([["Body", body], ["Tail", tail]]);
  const bases = new Map([...nodes].map(([name, node]) => [name, {
    position: node.position.clone(), rotation: node.rotation.clone(), scale: node.scale.clone(),
  }]));
  const input = { time: .3, reduced: false, joy: 0, surprise: 1, lean: 0, compression: 0,
    lookX: 0, lookY: 0, contactPart: "Tail", weight: 1, gesture: "tail", feedAge: -1, reactionAge: .25 };
  applyCarolPerformance({ nodes, bases, faces: [face] }, input);
  const snappedRotation = tail.rotation.z;
  assert.ok(Number.isFinite(snappedRotation));
  assert.notEqual(snappedRotation, 0, "tail has its own motion, rather than reusing poke unchanged");
  assert.ok(body.position.x > 0, "body recoils after the tail-root touch");
  assert.ok(face.morphTargetInfluences[0] > .8, "tail contact closes the eyes promptly");

  applyCarolPerformance({ nodes, bases, faces: [face] }, { ...input, reactionAge: .35 });
  const heldBlink = face.morphTargetInfluences[0];
  assert.ok(heldBlink > .8, "tail contact keeps the eyes closed for a beat");

  applyCarolPerformance({ nodes, bases, faces: [face] }, { ...input, reactionAge: .9 });
  assert.ok(face.morphTargetInfluences[0] < heldBlink*.35, "tail contact reopens the eyes before the tail settles");

  applyCarolPerformance({ nodes, bases, faces: [face] }, { ...input, gesture: "poke", contactPart: "Head", reactionAge: .25 });
  assert.equal(face.morphTargetInfluences[0], 0, "a poke keeps the tail-specific blink out of the reaction");

  applyCarolPerformance({ nodes, bases, faces: [face] }, { ...input, reduced: true, reactionAge: .35 });
  assert.equal(face.morphTargetInfluences[0], 1, "reduced motion retains the semantic closed-eye state");
});
