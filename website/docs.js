import { defaultOptions, scenes } from './src/index.js';

const shaderProps = [
  ['scale', 'Cloud size on each axis.', 'Each component > 0'],
  ['density', 'Amount of cloud material.', '≥ 0'],
  ['coverage', 'Expands or contracts the cloud boundary.', 'Any finite number'],
  ['softness', 'Softness of the outer edge.', '> 0'],
  ['baseHeight', 'Height of the flat cloud base.', 'Any finite number'],
  ['baseSoftness', 'Softness of the lower edge.', '> 0'],
  ['blend', 'Blending between generated cloud lobes.', '> 0'],
  ['noiseScale', 'Scale of the procedural noise.', '> 0'],
  ['billow', 'Large rounded surface variations.', '≥ 0'],
  ['erosion', 'Erosion of the cloud surface.', '≥ 0'],
  ['detail', 'Fine surface detail.', '≥ 0'],
  ['turbulence', 'Amount of noise distortion.', '≥ 0'],
  ['seed', 'Seed for cloud shape and noise. Same seed, same shape.', 'Any finite number'],
  ['lightDirection', 'Direction toward the light.', 'Nonzero [x, y, z]'],
  ['sunIntensity', 'Strength of direct sunlight.', '≥ 0'],
  ['lightColor', 'Color of direct sunlight.', 'sRGB [r, g, b], 0–1'],
  ['cloudColor', 'Base cloud color.', 'sRGB [r, g, b], 0–1'],
  ['shadowColor', 'Color of shaded areas.', 'sRGB [r, g, b], 0–1'],
  ['ambient', 'Ambient light intensity.', '≥ 0'],
  ['ambientGradient', 'Vertical variation in ambient light.', '0–1'],
  ['absorption', 'Light absorbed through the cloud.', '≥ 0'],
  ['shadowStrength', 'Strength of internal shadows.', '≥ 0'],
  ['scattering', 'Amount of directional light scattering.', '≥ 0'],
  ['anisotropy', 'Forward or backward scattering bias.', '−1 < value < 1'],
  ['powder', 'Soft brightening within the cloud.', '0–1'],
  ['silverLining', 'Brightness of the backlit cloud edge.', '≥ 0'],
  ['exposure', 'Final image exposure.', '≥ 0'],
  ['skyTop', 'Color at the top of the sky.', 'sRGB [r, g, b], 0–1'],
  ['skyBottom', 'Color at the bottom of the sky.', 'sRGB [r, g, b], 0–1'],
  ['skyGradient', 'Spread of the sky gradient.', '> 0'],
  ['sunGlow', 'Sun glow in the sky.', '≥ 0'],
  ['transparent', 'Draw with a transparent background.', 'true | false'],
  ['opacity', 'Overall cloud opacity.', '0–1'],
  ['wind', 'Noise movement along each axis.', '[x, y, z]'],
  ['steps', 'Maximum ray-marching steps.', 'Integer, 1–192'],
  ['lightSteps', 'Shadow sampling steps.', 'Integer, 1–12'],
  ['lightDistance', 'Distance covered by shadow samples.', '> 0'],
  ['jitter', 'Ray-sample jitter amount.', '0–1'],
];
const componentProps = [
  ['renderer', 'Rendering backend. Recreate with a fresh canvas to change it.', '"webgl2" | "webgpu"'],
  ['scene', 'Applies a scene preset. Explicit props override its values.', scenes.map(({ name }) => `"${name}"`).join(' · ')],
  ['animate', 'Advance time on each frame.', 'true | false'],
  ['speed', 'Animation speed multiplier.', '≥ 0'],
  ['time', 'Initial animation time in seconds.', 'Any finite number'],
  ['width', 'Rendering width in CSS pixels; does not set CSS.', '≥ 0; 0 reads canvas size'],
  ['height', 'Rendering height in CSS pixels; does not set CSS.', '≥ 0; 0 reads canvas size'],
  ['pixelRatio', 'Pixel density multiplier.', '> 0'],
  ['resolution', 'Additional rendering resolution multiplier.', '> 0'],
  ['maxPixels', 'Maximum number of rendered pixels.', 'Integer, ≥ 1'],
  ['yaw', 'Horizontal camera angle in radians.', 'Any finite number'],
  ['pitch', 'Vertical camera angle in radians.', 'Any finite number'],
  ['distance', 'Camera distance from its target.', '> 0'],
  ['fov', 'Vertical field of view in degrees.', '1–120'],
  ['target', 'Point the camera looks at.', '[x, y, z]'],
  ['offset', 'Cloud position in screen space.', '[x, y]'],
];
const defaults = defaultOptions();
const literal = (value) => Array.isArray(value) ? `[${value.map(literal).join(', ')}]`
  : typeof value === 'number' ? String(Number(value.toFixed(6))) : JSON.stringify(value);

// The copied example reproduces the selected preset plus edits; time starts at zero.
export function usageCode(settings, width, height) {
  const baseline = { ...defaults, ...scenes.find(({ name }) => name === settings.scene)?.values };
  const explicit = new Set(['renderer', 'scene', 'animate', 'speed']);
  const props = [...explicit, ...Object.keys(defaults).filter((key) => !explicit.has(key))]
    .map((key) => [key, settings[key]]).filter(([key, value]) => key !== 'time' &&
    (explicit.has(key) || JSON.stringify(value) !== JSON.stringify(baseline[key])));
  return `<canvas id="cloud"\n  style="display:block;width:min(${width}px,100%);height:${height}px"\n></canvas>\n\n<script type="module">\n  import createCloud from './src/index.js';\n\n  const cloud = await createCloud(document.querySelector('#cloud'), {\n${props.map(([key, value]) => `    ${key}: ${literal(value)},`).join('\n')}\n  });\n</script>`;
}

function table(root, definitions, extra = []) {
  const element = document.createElement('table');
  const head = element.createTHead().insertRow();
  for (const title of ['name', 'description', 'type', 'values']) {
    const th = document.createElement('th'); th.scope = 'col'; th.textContent = title; head.append(th);
  }
  const body = element.createTBody();
  const rows = definitions.map(([name, description, values]) => {
    const value = defaults[name];
    const type = Array.isArray(value) ? `Vec${value.length}` : ['renderer', 'scene'].includes(name) ? 'enum' : typeof value;
    return { name, description, values, type, defaultValue: literal(value) };
  });
  for (const { name, description, type, values, defaultValue, required } of [...extra, ...rows]) {
    const row = body.insertRow();
    const label = document.createElement('th'); label.scope = 'row';
    const code = document.createElement('code'); code.textContent = name; label.append(code);
    if (required) { const tag = document.createElement('span'); tag.className = 'required-tag'; tag.textContent = 'required'; label.append(tag); }
    row.append(label);
    row.insertCell().textContent = description;
    const typeCode = document.createElement('code'); typeCode.textContent = type; row.insertCell().append(typeCode);
    const valueCell = row.insertCell(); valueCell.textContent = values;
    if (defaultValue !== undefined) {
      const fallback = document.createElement('span'); fallback.className = 'prop-default';
      fallback.textContent = `Default: ${defaultValue}`; valueCell.append(fallback);
    }
  }
  root.append(element);
}

export function createDocs() {
  table(document.getElementById('shader-props'), shaderProps);
  table(document.getElementById('component-props'), componentProps, [
    { name: 'canvas', description: 'First argument. A canvas with a visible CSS width and height.', type: 'HTMLCanvasElement', values: 'Available canvas element', required: true },
    { name: 'onRender', description: 'Called before drawing. May return a props patch; times are in seconds.', type: 'function', values: '(time, deltaSeconds) → patch | void', defaultValue: 'undefined' },
    { name: 'onError', description: 'Handles runtime errors. Initialization errors reject the creation promise.', type: 'function', values: '(error) → void', defaultValue: 'console.error' },
  ]);
  const code = document.getElementById('component-code');
  const status = document.getElementById('copy-status');
  let feedback;
  document.getElementById('copy-code').onclick = async () => {
    clearTimeout(feedback);
    try {
      await navigator.clipboard.writeText(code.textContent);
      status.textContent = 'Copied';
    } catch {
      const range = document.createRange(); range.selectNodeContents(code);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      status.textContent = 'Select & copy';
    }
    feedback = setTimeout(() => { status.textContent = ''; }, 2500);
  };
  return { sync(settings, width, height) {
    const next = usageCode(settings, width, height);
    if (code.textContent !== next) code.textContent = next;
  } };
}
