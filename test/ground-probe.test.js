import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GroundProbe } from '../src/player/GroundProbe.js';

test('downward ground probe returns the walkable floor height', () => {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(20, .4, 20));
  floor.position.y = -.2;
  floor.updateMatrixWorld(true);
  const probe = new GroundProbe();
  assert.ok(Math.abs(probe.probe(new THREE.Vector3(0, 0, 0), [floor])) < 1e-6);
  assert.equal(probe.probe(new THREE.Vector3(30, 0, 0), [floor]), null);
});
