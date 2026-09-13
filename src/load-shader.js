/** Load native GLSL/WGSL as UTF-8 text, without a bundler or runtime transpiler. */
export async function loadShader(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Shader could not load: ${url.pathname} (${response.status}).`);
  const source = await response.arrayBuffer();
  if (!source.byteLength) throw new Error(`Shader is empty: ${url.pathname}.`);
  return { code: new TextDecoder().decode(source), bytes: source.byteLength };
}
