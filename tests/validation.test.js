import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultOptions } from '../src/index.js';
import { applyOptions } from '../src/validation.js';

test('option rules preserve inclusive and exclusive boundaries', () => {
  const cases = [
    ['pixelRatio', 0, .001, RangeError],
    ['density', -1, 0, RangeError],
    ['fov', 121, 120, RangeError],
    ['anisotropy', -1, -.999, RangeError],
    ['opacity', 1.001, 1, RangeError],
    ['steps', 193, 192, RangeError],
    ['lightSteps', 12.5, 12, RangeError],
    ['maxPixels', 0, 1, RangeError],
    ['speed', Infinity, 0, TypeError],
    ['animate', 'false', false, TypeError],
    ['target', [1, 2], [1, 2, 3], TypeError],
    ['wind', [0, NaN, 0], [0, 0, 0], TypeError],
    ['cloudColor', [1, 1.001, 0], [1, 1, 0], RangeError],
    ['scale', [1, 0, 1], [1, .001, 1], RangeError],
    ['lightDirection', [0, 0, 0], [0, .001, 0], RangeError],
  ];
  for (const [key, invalid, valid, ErrorType] of cases) {
    const state = defaultOptions(), before = structuredClone(state);
    assert.throws(() => applyOptions(state, { [key]: invalid }), ErrorType, key);
    assert.deepEqual(state, before, `${key} mutated state on failure`);
    applyOptions(state, { [key]: valid });
    assert.deepEqual(state[key], valid, key);
  }
});

test('an invalid patch never partially applies a scene or earlier valid fields', () => {
  const state = defaultOptions();
  applyOptions(state, { yaw: .8, wind: [.3, .2, .1] });
  const before = structuredClone(state);
  for (const patch of [
    { density: 4, scene: 'Storm', opacity: 2 },
    { scene: 'Storm', wind: [NaN, 0, 0] },
    { scene: 'missing', density: 4 },
    { density: 4, constructor: 1 },
    JSON.parse('{"density":4,"__proto__":{}}'),
  ]) {
    assert.throws(() => applyOptions(state, patch, true));
    assert.deepEqual(state, before);
  }
});

test('scene overrides preserve unrelated options and copy input arrays', () => {
  const state = defaultOptions();
  applyOptions(state, { yaw: .8, wind: [.3, .2, .1] });
  const patch = { scene: 'Storm', density: 4, cloudColor: [.8, .7, .6] };
  applyOptions(state, patch, true);
  assert.equal(state.scene, 'Storm');
  assert.equal(state.density, 4);
  assert.equal(state.sunIntensity, .9);
  assert.equal(state.yaw, .8);
  assert.deepEqual(state.wind, [.3, .2, .1]);
  patch.cloudColor[0] = 0;
  assert.deepEqual(state.cloudColor, [.8, .7, .6]);
});

test('renderer selection is validated and locked after initialization', () => {
  const state = defaultOptions();
  applyOptions(state, { renderer: 'webgpu' });
  applyOptions(state, { renderer: 'webgpu' }, true);
  assert.throws(() => applyOptions(state, { renderer: 'webgl2' }, true),
    { name: 'Error', message: 'Renderer changes require a new canvas and instance.' });
  assert.equal(state.renderer, 'webgpu');
  assert.throws(() => applyOptions(state, { renderer: 'auto' }), RangeError);
  for (const patch of [null, [], false, 0, 'options']) {
    assert.throws(() => applyOptions(state, patch), TypeError);
  }
});
