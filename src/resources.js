import { SHAPE_BYTES } from './shape.js';

export const UNIFORM_BYTES = 512;
export const NOISE_BYTES = 512;

export function createNoise() {
  const noise = new Uint8Array(NOISE_BYTES);
  let seed = 305441741;
  for (let i = 0; i < noise.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    noise[i] = seed >>> 24;
  }
  return noise;
}

export function drawingSize(width, height, options, maxSize) {
  const budget = options.maxPixels;
  const ratio = Math.min(options.pixelRatio * options.resolution,
    Math.sqrt(budget / (width * height)), maxSize[0] / width, maxSize[1] / height);
  let w = Math.max(1, Math.floor(width * ratio));
  let h = Math.max(1, Math.floor(height * ratio));
  // The 1-pixel minimum must not break the budget at very narrow aspect ratios.
  if (w * h > budget) {
    if (w > h) w = Math.max(1, Math.floor(budget / h));
    else h = Math.max(1, Math.floor(budget / w));
  }
  return [w, h];
}

export function memoryUsage(width, height, destroyed = false, deformationBytes = 0) {
  // The shape is a view into the uniform array, not a second allocation.
  const cpu = destroyed ? 0 : UNIFORM_BYTES + deformationBytes;
  const gpu = destroyed ? 0 : UNIFORM_BYTES + NOISE_BYTES;
  const surface = destroyed ? 0 : width * height * 4;
  return { shapeBytes: destroyed ? 0 : SHAPE_BYTES, cpu, gpu, surface, total: cpu + gpu + surface,
    estimated: true };
}
