import { options, colorOptions } from './options.js';
import { scenes } from './scenes.js';

const presets = new Map(scenes.map(scene => [scene.name, scene.values]));
const rule = (accepts, message, ErrorType = RangeError) => (value, key, context) => {
  if (!accepts(value, context)) throw new ErrorType(message(key, value));
};
const forFields = (names, ...rules) => names.map(name => [name, rules]);
const positive = rule(v => v > 0, key => `Invalid ${key}.`);
const nonnegative = rule(v => v >= 0, key => `Invalid ${key}.`);
const unitInterval = rule(v => v >= 0 && v <= 1, key => `${key}: use 0–1.`);
const integer = max => rule(v => Number.isInteger(v) && v >= 1 && v <= max, key => `Invalid ${key}.`);
const color = rule(v => v.every(channel => channel >= 0 && channel <= 1), key => `${key}: colors use 0–1 sRGB values.`);

// Field constraints are declared once, instead of branching on names for every patch.
const constraints = new Map([
  ...forFields(['pixelRatio', 'resolution', 'distance', 'softness', 'baseSoftness',
    'blend', 'noiseScale', 'lightDistance', 'skyGradient'], positive),
  ...forFields(['width', 'height', 'speed', 'density', 'billow', 'erosion', 'detail',
    'turbulence', 'sunIntensity', 'ambient', 'absorption', 'shadowStrength',
    'scattering', 'silverLining', 'exposure', 'sunGlow'], nonnegative),
  ...forFields(['opacity', 'powder', 'ambientGradient', 'jitter'], unitInterval),
  ...forFields([...colorOptions], color),
  ['fov', [rule(v => v >= 1 && v <= 120, () => 'fov: use 1–120 degrees.')]],
  ['anisotropy', [rule(v => Math.abs(v) < 1, () => 'anisotropy must be between -1 and 1.')]],
  ['scale', [rule(v => v.every(axis => axis > 0), () => 'scale components must be positive.')]],
  ['lightDirection', [rule(v => Math.hypot(...v) >= .001, () => 'lightDirection must be nonzero.')]],
  ['steps', [integer(192)]],
  ['lightSteps', [integer(12)]],
  ['maxPixels', [integer(Infinity)]],
]);

const typeRules = {
  number: () => rule(Number.isFinite, key => `${key}: expected a finite number.`, TypeError),
  boolean: () => rule(v => typeof v === 'boolean', key => `${key}: expected a boolean.`, TypeError),
  vector: expected => rule(v => Array.isArray(v) && v.length === expected.length && v.every(Number.isFinite),
    key => `${key}: expected ${expected.length} finite numbers.`, TypeError),
};
const validators = new Map(Object.entries(options).map(([key, [, value]]) => {
  const type = Array.isArray(value) ? 'vector' : typeof value;
  return [key, [typeRules[type](value), ...(constraints.get(key) || [])]];
}));
validators.set('renderer', [
  rule(v => ['webgl2', 'webgpu'].includes(v), () => 'renderer: use webgl2 or webgpu.'),
  rule((v, { state, initialized }) => !initialized || v === state.renderer,
    () => 'Renderer changes require a new canvas and instance.', Error),
]);
validators.set('scene', [rule(v => presets.has(v), (_, value) => `Unknown scene: ${value}`)]);

/** Validate the entire patch before committing it. Explicit options override the preset. */
export function applyOptions(state, patch, initialized = false) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Options must be an object.');
  const context = { state, initialized };
  for (const [key, value] of Object.entries(patch)) {
    const rules = validators.get(key);
    if (!rules) throw new TypeError(`Unknown option: ${key}`);
    for (const validate of rules) validate(value, key, context);
  }
  const values = structuredClone(patch);
  Object.assign(state, structuredClone(presets.get(values.scene) || {}), values);
}
