import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { countTriangles } from '../src/geometry.js';

test('primary scene triangles count visible world geometry, instances, and no sky', () => {
  const worldScene = new THREE.Scene();
  const worldGroup = new THREE.Group();
  worldScene.add(worldGroup);

  worldGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1)));
  worldGroup.add(new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial(),
    3
  ));

  const hiddenMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
  hiddenMesh.visible = false;
  worldGroup.add(hiddenMesh);

  const hiddenParent = new THREE.Group();
  hiddenParent.visible = false;
  hiddenParent.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1)));
  worldGroup.add(hiddenParent);

  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
  worldScene.add(sky);

  assert.equal(countTriangles(worldGroup), 8);
  assert.equal(countTriangles(worldScene), 10, 'passing the scene would include the sky');
});
