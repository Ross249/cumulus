// A small spring per procedural lobe. The renderers consume the same shape uniforms.
export function createDeformation(shape) {
  const rest = shape.slice();
  const offset = new Float32Array(shape.length / 4 * 3);
  const velocity = new Float32Array(offset.length);
  return {
    bytes: rest.byteLength + offset.byteLength + velocity.byteLength,
    disturb(x, y, dx, dy, state, aspect) {
      const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
      const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      const right = [cy, 0, -sy], up = [-sy * sp, cp, -cy * sp];
      const forward = [-sy * cp, -sp, -cy * cp];
      const eye = state.target.map((v, i) => v - forward[i] * state.distance);
      const tan = Math.tan(state.fov * Math.PI / 360);
      for (let i = 0; i < shape.length / 4; i++) {
        const p = [0, 1, 2].map(axis => shape[i * 4 + axis] * state.scale[axis] - eye[axis]);
        const dot = axis => p.reduce((sum, v, j) => sum + v * axis[j], 0);
        const depth = dot(forward);
        if (depth <= .01) continue;
        const px = ((dot(right) / (depth * tan) + state.offset[0]) / aspect + 1) / 2;
        const py = (1 - dot(up) / (depth * tan) - state.offset[1]) / 2;
        const reach = .16 + rest[i * 4 + 3] * Math.max(...state.scale) / (2 * depth * tan);
        const distance = Math.hypot((px - x) * aspect, py - y);
        const weight = Math.max(0, 1 - distance / reach) ** 2;
        const spread = Math.atan2(y - py, (px - x) * aspect);
        const strength = Math.min(1, Math.hypot(dx * aspect, dy) * 12 + .12);
        const horizontal = dx * aspect * depth * tan * 65 + Math.cos(spread) * strength * 3;
        const vertical = -dy * depth * tan * 65 + Math.sin(spread) * strength * 3;
        for (let axis = 0; axis < 3; axis++) {
          const index = i * 3 + axis;
          velocity[index] = Math.max(-12, Math.min(12, velocity[index] +
            (right[axis] * horizontal + up[axis] * vertical) * weight / state.scale[axis]));
        }
      }
    },
    step(delta) {
      // Substeps keep the spring stable on slow frames and after tab visibility changes.
      const steps = Math.max(1, Math.ceil(delta / (1 / 120))), dt = delta / steps;
      for (let step = 0; step < steps; step++) for (let i = 0; i < offset.length; i++) {
        velocity[i] += (-18 * offset[i] - 6 * velocity[i]) * dt;
        offset[i] = Math.max(-2.5, Math.min(2.5, offset[i] + velocity[i] * dt));
      }
      let active = false;
      for (let i = 0; i < shape.length / 4; i++) {
        let spread = 0;
        for (let axis = 0; axis < 3; axis++) {
          const index = i * 3 + axis;
          shape[i * 4 + axis] = rest[i * 4 + axis] + offset[index];
          spread += offset[index] ** 2;
          if (Math.abs(offset[index]) > .001 || Math.abs(velocity[index]) > .003) active = true;
        }
        shape[i * 4 + 3] = rest[i * 4 + 3] * (1 - .28 * Math.min(1, Math.sqrt(spread)));
      }
      if (!active) shape.set(rest);
      return active;
    },
  };
}
