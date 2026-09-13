import { options as schema, colorOptions as colors } from './options.js';
import { applyOptions } from './validation.js';
import { drawingSize, memoryUsage, UNIFORM_BYTES } from './resources.js';
import { generateShape } from './shape.js';
import { createDeformation } from './deformation.js';

export { scenes } from './scenes.js';
const rendererLoaders = {
  webgl2: () => import('./webgl.js'),
  webgpu: () => import('./webgpu.js'),
};
const fields = Object.entries(schema);
const linear = (v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;

export function defaultOptions() {
  return { ...Object.fromEntries(fields.map(([key, [, value]]) => [key, structuredClone(value)])),
    renderer: 'webgl2', scene: 'Daylight' };
}

/** @param {HTMLCanvasElement} canvas The only required argument. */
export default async function createCloud(canvas, initial = {}) {
  if (!canvas?.getContext) throw new TypeError('createCloud requires a canvas element.');
  const { onRender, onError = console.error, ...overrides } = initial;
  if (onRender != null && typeof onRender !== 'function' || typeof onError !== 'function') throw new TypeError('Callbacks must be functions.');
  const state = defaultOptions();
  applyOptions(state, overrides);

  let uniforms = new Float32Array(UNIFORM_BYTES / 4);
  let shape = uniforms.subarray(80);
  let shapeSeed = state.seed;
  generateShape(shapeSeed, shape);
  let frame = 0, previous = 0, frames = 0;
  let destroyed = false, failed = false, renderer;
  let deformation;

  function fail(error) {
    failed = true;
    cancelAnimationFrame(frame);
    frame = 0;
    onError(error);
  }
  const { createRenderer } = await rendererLoaders[state.renderer]();
  renderer = await createRenderer(canvas, fail);

  function draw() {
    if (destroyed || failed) return;
    const [w, h] = drawingSize(state.width || canvas.clientWidth || 640,
      state.height || canvas.clientHeight || 480, state, renderer.maxSize);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    for (const [key, [offset]] of fields) {
      if (offset < 0) continue;
      const value = state[key];
      if (Array.isArray(value)) {
        const length = offset === 32 ? Math.hypot(...value) || 1 : 1;
        for (let i = 0; i < value.length; i++) uniforms[offset + i] = colors.has(key) ? linear(value[i]) : value[i] / length;
      } else uniforms[offset] = value;
    }
    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    uniforms[0] = w; uniforms[1] = h;
    uniforms[4] = state.target[0] + sy * cp * state.distance;
    uniforms[5] = state.target[1] + sp * state.distance;
    uniforms[6] = state.target[2] + cy * cp * state.distance;
    uniforms[7] = Math.tan(state.fov * Math.PI / 360);
    uniforms[8] = cy; uniforms[9] = 0; uniforms[10] = -sy;
    uniforms[12] = -sy * sp; uniforms[13] = cp; uniforms[14] = -cy * sp;
    uniforms[16] = -sy * cp; uniforms[17] = -sp; uniforms[18] = -cy * cp;
    const margin = state.blend + Math.max(state.coverage, 0) + state.turbulence * .5 + .03;
    uniforms.fill(1e6, 24, 27);
    uniforms.fill(-1e6, 28, 31);
    if (state.seed !== shapeSeed) {
      deformation = null;
      generateShape(state.seed, shape);
      shapeSeed = state.seed;
    }
    uniforms[75] = shape.length / 4;
    for (let i = 0; i < shape.length; i += 4) for (let axis = 0; axis < 3; axis++) {
      uniforms[24 + axis] = Math.min(uniforms[24 + axis], (shape[i + axis] - shape[i + 3] - margin) * state.scale[axis]);
      uniforms[28 + axis] = Math.max(uniforms[28 + axis], (shape[i + axis] + shape[i + 3] + margin) * state.scale[axis]);
    }
    uniforms[25] = Math.max(uniforms[25], state.baseHeight * state.scale[1]);
    renderer.draw(uniforms);
    frames++;
  }
  function schedule() {
    if (!frame && !destroyed && !failed && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function tick(now) {
    frame = 0;
    const delta = previous ? Math.min((now - previous) / 1000, .1) : 0;
    previous = now;
    try {
      if (state.animate) state.time += delta * state.speed;
      if (deformation && !deformation.step(delta)) deformation = null;
      const patch = onRender?.(state.time, delta);
      if (patch) applyOptions(state, patch, true);
      draw();
      if (state.animate || deformation) schedule();
      else previous = 0;
    } catch (error) { fail(error); }
  }
  function visibility() {
    cancelAnimationFrame(frame);
    frame = previous = 0;
    if (!document.hidden) schedule();
  }
  const observer = new ResizeObserver(schedule);
  observer.observe(canvas);
  document.addEventListener('visibilitychange', visibility);
  const api = {
    backend: renderer.kind,
    sourceBytes: renderer.sourceBytes,
    get options() { return structuredClone(state); },
    get stats() { return { frames, time: state.time, width: canvas.width, height: canvas.height }; },
    get memory() { return memoryUsage(canvas.width, canvas.height, destroyed, deformation?.bytes || 0); },
    disturb(x, y, deltaX = 0, deltaY = 0) {
      if (destroyed || failed) return;
      if (![x, y, deltaX, deltaY].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1) {
        throw new RangeError('disturb: x and y must be 0–1; movement must be finite.');
      }
      if (state.seed !== shapeSeed) draw();
      deformation ||= createDeformation(shape);
      deformation.disturb(x, y, Math.max(-1, Math.min(1, deltaX)), Math.max(-1, Math.min(1, deltaY)),
        state, canvas.width / canvas.height);
      schedule();
    },
    update(patch) {
      if (destroyed || failed) return;
      applyOptions(state, patch, true);
      schedule();
    },
    render(time) {
      if (time !== undefined) applyOptions(state, { time }, true);
      draw();
    },
    pause() { api.update({ animate: false }); },
    resume() { previous = 0; api.update({ animate: true }); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      renderer.destroy();
      shape = uniforms = deformation = null;
    },
  };
  try {
    draw();
    if (state.animate) schedule();
    return api;
  } catch (error) { api.destroy(); throw error; }
}
