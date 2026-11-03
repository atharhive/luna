import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SpatialIngestionEngine } from '../src/spatialIngestion.js';

function fakeFrame() {
  const width = 2;
  const height = 2;
  return {
    canvas: { width, height },
    ctx: { getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }) },
  };
}

test('an upload made while the solid layer is in wireframe renders the relief as wireframe', () => {
  const solidGroup = new THREE.Group();
  solidGroup.userData.wireframe = true;
  const engine = new SpatialIngestionEngine(null, solidGroup, null, null, () => {});

  engine.reconstructPBRSolidScene(fakeFrame());

  const relief = solidGroup.getObjectByName('UploadedPhotometricRelief');
  assert.equal(relief.material.wireframe, true);
});
