// Blend the existing uniforms on one canvas; cloud time and camera stay continuous.
export function interpolateScene(from, to, progress) {
  if (progress <= 0) return structuredClone(from);
  if (progress >= 1) return structuredClone(to);
  const t = progress * progress * (3 - 2 * progress);
  return Object.fromEntries(Object.entries(to).map(([key, value]) => {
    const start = from[key];
    if (!Array.isArray(value)) return [key, start + (value - start) * t];
    if (key === 'lightDirection') {
      const a = start.map(v => v / Math.hypot(...start));
      const b = value.map(v => v / Math.hypot(...value));
      // Opposite custom light directions need an arc to avoid a zero vector.
      if (a.reduce((dot, v, i) => dot + v * b[i], 0) < -.999) {
        const axis = Math.abs(a[0]) < .9 ? [1, 0, 0] : [0, 1, 0];
        const dot = a.reduce((sum, v, i) => sum + v * axis[i], 0);
        const perpendicular = axis.map((v, i) => v - dot * a[i]);
        const length = Math.hypot(...perpendicular);
        return [key, a.map((v, i) => v * Math.cos(Math.PI * t) + perpendicular[i] / length * Math.sin(Math.PI * t))];
      }
    }
    return [key, value.map((v, i) => start[i] + (v - start[i]) * t)];
  }));
}
