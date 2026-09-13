import test from 'node:test';
import assert from 'node:assert/strict';
import { generateShape } from '../src/shape.js';
import { createDeformation } from '../src/deformation.js';
import { defaultOptions } from '../src/index.js';
import { memoryUsage } from '../src/resources.js';

test('a stroke scatters nearby lobes and springs back to the exact original shape', () => {
  for (const seed of [7, 42]) for (const aspect of [1, 1.7]) {
    const shape = generateShape(seed), original = shape.slice();
    const effect = createDeformation(shape);
    effect.disturb(.5, .5, .15, -.05, defaultOptions(), aspect);
    for (let i = 0; i < 12; i++) effect.step(1 / 60);
    assert.notDeepEqual(shape, original);
    assert.ok(shape.every(Number.isFinite));
    let active = true;
    for (let i = 0; i < 600 && active; i++) active = effect.step(1 / 60);
    assert.equal(active, false);
    assert.deepEqual(shape, original);
    assert.equal(effect.bytes, 480);
  }
});

test('repeated strokes remain bounded and settle after slow frames', () => {
  const shape = generateShape(7), original = shape.slice();
  const effect = createDeformation(shape);
  for (let i = 0; i < 80; i++) {
    effect.disturb(.5, .5, .2, .1, defaultOptions(), 1);
    effect.step(.1);
    for (let j = 0; j < shape.length; j++) {
      assert.ok(Number.isFinite(shape[j]));
      if (j % 4 !== 3) assert.ok(Math.abs(shape[j] - original[j]) < 2.501);
      else assert.ok(shape[j] > 0);
    }
  }
  let active = true;
  for (let i = 0; i < 100 && active; i++) active = effect.step(.1);
  assert.equal(active, false);
  assert.deepEqual(shape, original);
});

test('temporary spring buffers are included in CPU memory only', () => {
  const before = memoryUsage(100, 100);
  const during = memoryUsage(100, 100, false, 480);
  assert.equal(during.cpu, before.cpu + 480);
  assert.equal(during.total, before.total + 480);
  assert.equal(during.gpu, before.gpu);
  assert.equal(memoryUsage(100, 100, true, 480).total, 0);
});
