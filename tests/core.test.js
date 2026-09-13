import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import createCloud, { defaultOptions, scenes } from '../src/index.js';
import { createNoise, drawingSize, memoryUsage } from '../src/resources.js';
import { generateShape, SHAPE_BYTES } from '../src/shape.js';
import { loadShader } from '../src/load-shader.js';

test('canvas is required and bad options fail before loading shaders', async () => {
  await assert.rejects(createCloud(null), /canvas/);
  for (const patch of [{ renderer: 'invalid' }, { renderer: 'auto' }, { scene: 'invalid' }, { maxPixels: 0 },
    { scale: [1, 0, 1] }, { cloudColor: [1, 2, 1] }, { steps: 193 },
    { density: NaN }, { lightDirection: [0, 0, 0] }, { arbitrary: 1 }]) {
    await assert.rejects(createCloud({ getContext() {} }, patch));
  }
});

test('all dimensions, including narrow aspect ratios, respect the pixel budget', () => {
  for (const [width, height] of [[720, 440], [390, 320], [320, 568], [100000, 1], [1, 100000]]) {
    for (const maxPixels of [1, 32, 10000, 650000]) {
      const [w, h] = drawingSize(width, height, { ...defaultOptions(), pixelRatio: 2, maxPixels }, [8192, 8192]);
      assert.ok(w >= 1 && h >= 1 && w * h <= maxPixels, `${width}x${height} budget ${maxPixels}`);
      assert.ok(w <= 8192 && h <= 8192);
    }
  }
});

test('shape generation is deterministic, seed-driven and can reuse the uniform buffer', () => {
  const uniforms = new Float32Array(128);
  const target = uniforms.subarray(80);
  const shape = generateShape(7, target);
  assert.equal(shape, target);
  assert.equal(shape.buffer, uniforms.buffer);
  assert.equal(shape.byteLength, SHAPE_BYTES);
  assert.deepEqual(shape, generateShape(7));
  assert.notDeepEqual(shape, generateShape(42));
  for (const seed of [-1, 0, 7, 42, 1000]) {
    const result = generateShape(seed);
    assert.ok(result.every(Number.isFinite));
    for (let i = 3; i < result.length; i += 4) assert.ok(result[i] > 0);
  }
  assert.throws(() => generateShape(NaN), /finite/);
});

test('generated noise and memory accounting exclude duplicate shape allocations', () => {
  const noise = createNoise();
  assert.equal(noise.byteLength, 512);
  assert.deepEqual(noise, createNoise());
  assert.ok(new Set(noise).size > 100);
  const memory = memoryUsage(100, 50);
  assert.equal(memory.cpu, 512);
  assert.equal(memory.shapeBytes, 192);
  assert.equal(memory.total, memory.cpu + memory.gpu + 100 * 50 * 4);
  assert.equal(memoryUsage(100, 50, true).total, 0);
});

test('shader loader preserves native source and counts UTF-8 bytes', async () => {
  const code = '// 雲\n@vertex fn vs() {}';
  const source = await loadShader(new URL(`data:text/plain,${encodeURIComponent(code)}`));
  assert.equal(source.code, code);
  assert.equal(source.bytes, new TextEncoder().encode(code).length);
  await assert.rejects(loadShader(new URL('data:text/plain,')), /empty/);
});

test('six scenes are valid and defaults are isolated between consumers', () => {
  assert.equal(scenes.length, 6);
  assert.equal(new Set(scenes.map(s => s.name)).size, 6);
  for (const scene of scenes) for (const value of Object.values(scene.values)) {
    assert.ok((Array.isArray(value) ? value : [value]).every(Number.isFinite));
  }
  assert.equal(defaultOptions().renderer, 'webgl2');
  const first = defaultOptions(); first.scale[0] = 9;
  assert.equal(defaultOptions().scale[0], 1);
});

test('Vercel output has every module/asset and excludes local servers and tests', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
  assert.equal(config.outputDirectory, 'dist');
  assert.equal(config.framework, null);
  const root = resolve('dist');
  const seen = new Set();
  async function visit(path) {
    if (seen.has(path)) return;
    seen.add(path);
    assert.ok((await stat(path)).isFile(), path);
    if (!/\.(html|js)$/.test(path)) return;
    const source = await readFile(path, 'utf8');
    const refs = path.endsWith('.html')
      ? [...source.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(m => m[1])
      : [...source.matchAll(/(?:from\s+|import\(|new URL\()(['"])(\.\.?\/[^'"]+)\1/g)].map(m => m[2]);
    for (const ref of refs) await visit(resolve(dirname(path), ref));
  }
  await visit(resolve(root, 'index.html'));
  assert.ok(seen.has(resolve(root, 'src/webgl.js')));
  assert.ok(seen.has(resolve(root, 'src/webgpu.js')));
  for (const name of ['cloud.vert.glsl', 'cloud.frag.glsl', 'cloud.wgsl']) {
    assert.ok(seen.has(resolve(root, 'src/shaders', name)), `Missing native shader ${name}`);
    const code = await readFile(resolve(root, 'src/shaders', name), 'utf8');
    assert.ok(!code.includes('export const'), 'Shader must not be a JS wrapper');
  }
  for (const directory of ['src', 'dist']) {
    assert.ok(!(await readdir(directory, { recursive: true })).some((name) => name.endsWith('.bin')));
  }
  for (const path of ['tests', 'scripts', 'package.json']) await assert.rejects(stat(resolve(root, path)));
});

test('copied component examples reproduce scene overrides for both renderers', async () => {
  const { usageCode } = await import('../dist/docs.js');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const renderer of ['webgl2', 'webgpu']) for (const scene of scenes) {
    // Resetting a scene prop to the global default must still emit that override.
    const expected = { ...defaultOptions(), ...scene.values, renderer, scene: scene.name,
      density: 9, skyTop: [0.018, 0.17, 0.4], animate: false, time: 42, seed: 123 };
    const html = usageCode(expected, 538, 400);
    const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
      .replace(/import createCloud from '[^']+';/, '');
    let actual;
    const canvas = {};
    await new AsyncFunction('createCloud', 'document', script)(async (target, props) => {
      assert.equal(target, canvas);
      actual = { ...defaultOptions(), ...scenes.find(s => s.name === props.scene).values, ...props };
    }, { querySelector: () => canvas });
    assert.deepEqual(actual, { ...expected, time: 0 });
  }
});
