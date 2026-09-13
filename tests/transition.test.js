import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolateScene } from '../website/transition.js';
import { scenes } from '../src/scenes.js';

test('every scene pair blends within its bounds and reaches the exact destination', () => {
  for (const a of scenes) for (const b of scenes) {
    assert.deepEqual(interpolateScene(a.values, b.values, 0), a.values);
    assert.deepEqual(interpolateScene(a.values, b.values, 1), b.values);
    for (const t of [.1, .5, .9]) {
      const sample = interpolateScene(a.values, b.values, t);
      for (const key of Object.keys(sample)) {
        const values = Array.isArray(sample[key]) ? sample[key] : [sample[key]];
        const from = Array.isArray(a.values[key]) ? a.values[key] : [a.values[key]];
        const to = Array.isArray(b.values[key]) ? b.values[key] : [b.values[key]];
        values.forEach((value, i) => {
          assert.ok(Number.isFinite(value));
          assert.ok(value >= Math.min(from[i], to[i]) && value <= Math.max(from[i], to[i]));
        });
      }
      assert.ok(Math.hypot(...sample.lightDirection) > .001);
    }
  }
});

test('interrupted transitions start at the current appearance without mutating it', () => {
  const current = interpolateScene(scenes[0].values, scenes[1].values, .4);
  const before = structuredClone(current);
  const restarted = interpolateScene(current, scenes[2].values, 0);
  assert.deepEqual(restarted, current);
  assert.deepEqual(interpolateScene(current, scenes[2].values, 1), scenes[2].values);
  assert.deepEqual(current, before);
});

test('opposite custom light directions never interpolate through a zero vector', () => {
  const from = { lightDirection: [1, 0, 0] }, to = { lightDirection: [-1, 0, 0] };
  for (const t of [.1, .5, .9]) {
    assert.ok(Math.hypot(...interpolateScene(from, to, t).lightDirection) > .999);
  }
});
