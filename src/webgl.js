import { createNoise } from './resources.js';
import { loadShader } from './load-shader.js';

export async function createRenderer(canvas, onError) {
  const [vertex, fragment] = await Promise.all([
    loadShader(new URL('./shaders/cloud.vert.glsl', import.meta.url)),
    loadShader(new URL('./shaders/cloud.frag.glsl', import.meta.url)),
  ]);
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error('WebGL2 is unavailable. Try a browser with hardware acceleration.');

  const program = gl.createProgram();
  const shaders = [];
  let texture;
  const lost = (event) => {
    event.preventDefault();
    onError(new Error('Graphics context lost. Reload to reconnect.'));
  };
  function destroy() {
    canvas.removeEventListener('webglcontextlost', lost);
    gl.useProgram(null);
    gl.deleteTexture(texture);
    gl.deleteProgram(program);
    shaders.forEach((shader) => gl.deleteShader(shader));
    shaders.length = 0;
  }

  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex.code], [gl.FRAGMENT_SHADER, fragment.code]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
      }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    shaders.forEach((shader) => {
      gl.detachShader(program, shader);
      gl.deleteShader(shader);
    });
    shaders.length = 0;
    gl.useProgram(program);

    // One deterministic, shared 8 × 8 × 8 R8 noise texture.
    const noise = createNoise();
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, texture);
    for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) {
      gl.texParameteri(gl.TEXTURE_3D, parameter, gl.REPEAT);
    }
    for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) {
      gl.texParameteri(gl.TEXTURE_3D, parameter, gl.LINEAR);
    }
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, 8, 8, 8, 0, gl.RED, gl.UNSIGNED_BYTE, noise);
    gl.uniform1i(gl.getUniformLocation(program, 'n'), 0);
    if (gl.getError() !== gl.NO_ERROR) throw new Error('Could not initialize the renderer.');
    const uniforms = gl.getUniformLocation(program, 'u');
    canvas.addEventListener('webglcontextlost', lost);

    return {
      kind: 'webgl2',
      sourceBytes: vertex.bytes + fragment.bytes,
      maxSize: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      draw(values) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform4fv(uniforms, values);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      destroy,
    };
  } catch (error) {
    destroy();
    throw error;
  }
}
