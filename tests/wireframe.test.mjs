import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  applyWireframe,
  setSolidLayerWireframe,
  isSolidLayerWireframe,
} from '../src/wireframe.js';

function buildSolidLayer() {
  const solidGroup = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()]);
  solidGroup.add(wall, bed);
  return { solidGroup, wall, bed };
}

test('enabling the toggle switches every solid mesh, including multi-material meshes, to wireframe', () => {
  const { solidGroup, wall, bed } = buildSolidLayer();

  setSolidLayerWireframe(solidGroup, true);

  assert.equal(isSolidLayerWireframe(solidGroup), true);
  assert.equal(wall.material.wireframe, true);
  bed.material.forEach((material) => assert.equal(material.wireframe, true));
});

test('disabling the toggle restores solid rendering', () => {
  const { solidGroup, wall } = buildSolidLayer();
  setSolidLayerWireframe(solidGroup, true);

  setSolidLayerWireframe(solidGroup, false);

  assert.equal(isSolidLayerWireframe(solidGroup), false);
  assert.equal(wall.material.wireframe, false);
});

test('a mesh added while the toggle is on picks up wireframe when it is applied', () => {
  const { solidGroup } = buildSolidLayer();
  setSolidLayerWireframe(solidGroup, true);

  const relief = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial());
  applyWireframe(relief, isSolidLayerWireframe(solidGroup));
  solidGroup.add(relief);

  assert.equal(relief.material.wireframe, true);
});
