export const LOBE_COUNT = 12;
export const SHAPE_FLOATS = LOBE_COUNT * 4;
export const SHAPE_BYTES = SHAPE_FLOATS * Float32Array.BYTES_PER_ELEMENT;

/** Generate a broad base, a rising crown and a foreground row of billows.
 * Writes directly into the uniform buffer when a target is supplied.
 * A seed changes the shape; there are no stored geometry or binary assets.
 */
export function generateShape(seed, target = new Float32Array(SHAPE_FLOATS)) {
  if (!Number.isFinite(seed)) throw new TypeError('Shape seed must be finite.');
  if (!(target instanceof Float32Array) || target.length !== SHAPE_FLOATS) {
    throw new TypeError(`Shape target must contain ${SHAPE_FLOATS} floats.`);
  }
  let randomState = (Math.trunc(seed * 1000) ^ 0x6d2b79f5) >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  let offset = 0;
  for (let row = 0; row < 3; row++) {
    const count = row === 0 ? 5 : row === 1 ? 3 : 4;
    for (let i = 0; i < count; i++) {
      const x = i / (count - 1) * 2 - 1;
      const arch = 1 - x * x;
      target[offset++] = x * (row === 0 ? 1.58 : row === 1 ? .78 : 1.24) + (random() - .5) * .16;
      target[offset++] = (row === 0 ? -.22 + arch * .57 : row === 1 ? .94 + arch * .3 : -.16 + arch * .24) + (random() - .5) * .13;
      target[offset++] = (row === 2 ? .62 : row === 1 ? -.13 : 0) + (random() - .5) * .16;
      target[offset++] = (row === 0 ? .68 + arch * .36 : row === 1 ? .66 + arch * .14 : .5 + arch * .19) + (random() - .5) * .1;
    }
  }
  return target;
}
