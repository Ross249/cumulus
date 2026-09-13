# Cumulus

An animated procedural cloud component for any web page. Built with plain JavaScript and zero third-party dependencies, it renders six scenes using **GLSL / WebGL2** or **WGSL / WebGPU**. Cloud geometry and the noise texture are generated at runtime, with no external model or image assets.

`src/` contains the component; `website/` contains the playground SPA. The carousel, parameter panel, drag-to-orbit controls, and resizable card belong to the playground and are not added to your page by the component.

## Minimal usage

Copy the entire `src/` directory to `/cloud/` on your website. Preserve the relative paths of the JavaScript modules and the `.glsl` / `.wgsl` files in `shaders/`, and serve them over HTTP or HTTPS:

```html
<canvas id="cloud" style="display:block;width:100%;height:360px"></canvas>

<script type="module">
  import createCloud from '/cloud/index.js';

  // The canvas is the only required argument. The options object can be omitted.
  const cloud = await createCloud(document.querySelector('#cloud'));

  // Call cloud.destroy() when removing the component.
</script>
```

The cloud animates by default. The component observes the canvas size, adjusts its rendering resolution, and suspends rendering when the tab is hidden. Give the canvas a visible CSS width and height. Loading modules and shader sources over `file://` is unreliable; WebGPU requires HTTPS or localhost and a supported browser and GPU.

## Scenes and options

```js
import createCloud, { scenes, defaultOptions } from '/cloud/index.js';

const cloud = await createCloud(canvas, {
  renderer: 'webgl2',        // Default backend; choose 'webgpu' explicitly to use it
  scene: 'Golden hour',
  animate: true,
  speed: 0.65,
  density: 10,
  cloudColor: [1, 1, 1],    // sRGB, with each component between 0 and 1
  pixelRatio: Math.min(window.devicePixelRatio, 2),
  maxPixels: 650_000,
  onError(error) { console.error(error); },
});

cloud.update({ scene: 'Storm' });
cloud.update({ coverage: 0.35, wind: [0.3, -0.04, 0.07] });
cloud.pause();
cloud.render(2.5);            // Render at a specific time, even while paused
cloud.resume();

console.log(cloud.sourceBytes); // Uncompressed UTF-8 shader bytes loaded by this backend
console.log(cloud.backend);  // The active backend: 'webgl2' or 'webgpu'
console.log(cloud.options);  // A copy of the current options, excluding callbacks
console.log(cloud.stats);    // Frames, time, and rendering width / height in pixels
console.log(cloud.memory);   // Known resource memory estimates, in bytes
console.log(scenes.map(scene => scene.name));
console.log(defaultOptions());

// On removal: stop RAF, disconnect ResizeObserver, remove listeners, and release GPU resources.
cloud.destroy();
```

Available scenes: `Daylight`, `Golden hour`, `Storm`, `Backlit`, `Overcast`, and `Silver lining`.

`update({ scene })` applies the lighting, color, and cloud parameters defined by that preset. Other custom options are preserved. Explicit values in the same patch take precedence: `update({ scene: 'Storm', density: 8 })` uses a density of 8. Array options must be supplied as complete arrays.

## What is required?

| Argument or resource | Required | Description |
| --- | --- | --- |
| `canvas`, the first argument | **Yes** | An available `HTMLCanvasElement`; do not reuse a canvas bound to another graphics backend |
| `options`, the second argument | No | The entire object can be omitted; every property has a default |
| `onRender` / `onError` | No | Animation is built in; you do not need your own RAF loop |
| External model URL / API key | No | Cloud geometry and noise are generated at runtime; no API key or backend service is needed |

## API

| Method / property | Description |
| --- | --- |
| `await createCloud(canvas, options?)` | Generates the cloud from its seed, asynchronously loads the selected backend's shader sources, and initializes rendering. Rejects if initialization fails |
| `update(patch)` | Validates and updates options for the next frame. Invalid options throw without changing the existing state |
| `disturb(x, y, deltaX?, deltaY?)` | Pokes or scatters nearby cloud lobes, which spring back automatically. Coordinates use 0–1 canvas fractions; movement uses fractions of canvas width / height |
| `render(time?)` | Draws a frame immediately, with an optional time in seconds |
| `pause()` / `resume()` | Stops / resumes the cloud's time animation. Updating, resizing, and rendering remain available while paused |
| `destroy()` | Releases resources and can be called repeatedly. After destruction, update / render / pause / resume no longer draw |
| `backend` | The active backend; read-only |
| `sourceBytes` | UTF-8 byte count of this backend's shader sources; read-only. Excludes JavaScript, fonts, and HTTP headers |
| `options` | A copy of the current options. Modify the component through `update()`, not this copy |
| `stats` | Total rendered frames, time, and actual rendering dimensions in pixels |
| `memory` | Procedural shape bytes within the CPU buffer, CPU buffers, GPU payload, one RGBA8 color surface, and their total |

`onRender(time, deltaSeconds)` runs before drawing and may return an options patch. Both time values are in seconds. Resuming a background tab does not produce a large accumulated time step.

```js
const cloud = await createCloud(canvas, {
  onRender(time) {
    return { yaw: 0.12 + Math.sin(time * 0.1) * 0.2 };
  },
});
```

There is no need to call `render()` inside the callback. Initialization errors reject the `createCloud()` promise. Runtime errors, such as device or context loss, call `onError` and stop rendering.

### Poking and dispersing the cloud

```js
cloud.pause();
cloud.disturb(0.5, 0.5);             // Poke the center
cloud.disturb(0.5, 0.5, 0.12, -0.04); // Push right and slightly upward
```

Coordinates start at the canvas's top-left corner. For pointer gestures, normalize the pointer position and movement by the canvas's CSS width and height, then call `disturb()` on pointer down and drag. The two movement arguments default to 0. The component does not install pointer handlers or pause playback for you.

Each affected procedural lobe moves with the gesture, spreads out, and springs back to its original position and radius. Recovery continues while cloud time is paused and stops drawing once settled. It uses the same shape uniforms in both renderers, preserving the camera, scene, and seed. Temporary spring buffers add 480 B of known CPU memory while recovering and are released afterward. Calling `destroy()` stops recovery and releases these buffers immediately.

### Rendering and sizing options

**All options are optional.** Complete type definitions are in [`src/index.d.ts`](src/index.d.ts), and parameter defaults are defined in [`src/options.js`](src/options.js).

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `renderer` | `'webgl2' \| 'webgpu'` | `'webgl2'` | Backend failures are reported directly; there is no automatic switch to another backend |
| `scene` | Scene name | `'Daylight'` | Applies a scene preset |
| `animate` | boolean | `true` | Whether time advances continuously |
| `speed` / `time` | number | `1` / `0` | Animation speed multiplier / initial time in seconds |
| `width` / `height` | number | `0` / `0` | 0 reads the canvas CSS dimensions; positive values override rendering calculations but **do not set CSS** |
| `pixelRatio` | number | `1` | Pixel density multiplier; must be greater than 0 |
| `resolution` | number | `0.75` | Additional resolution multiplier; must be greater than 0 |
| `maxPixels` | integer | `360000` | Rendering pixel budget; at least 1 |
| `steps` / `lightSteps` | integer | `112` / `7` | Ray steps, 1–192 / shadow steps, 1–12 |
| `lightDistance` / `jitter` | number | `3.6` / `0.4` | Shadow sampling distance / jitter amount, 0–1 |

**Switching backends requires a fresh canvas.** Browsers do not allow a canvas with a WebGL context to acquire a WebGPU context, or vice versa. Save the state, destroy the instance, replace the canvas, and create a new instance:

```js
const options = cloud.options;
cloud.destroy();
const nextCanvas = canvas.cloneNode(false); // Preserve CSS and dimension attributes
canvas.replaceWith(nextCanvas);
canvas = nextCanvas;
cloud = await createCloud(canvas, { ...options, renderer: 'webgpu' });
// Reattach any onRender / onError callbacks and DOM event listeners.
```

Declare `canvas` and `cloud` with `let` in this example. The playground handles backend switching, error messages, and retries.

### Cloud shape, lighting, colors, and camera

| Group | Options and defaults |
| --- | --- |
| Cloud shape | `scale: [1,1,1]`, `density: 9`, `coverage: 0.28`, `softness: 0.12`, `baseHeight: -0.57`, `baseSoftness: 0.14`, `blend: 0.32` |
| Texture | `noiseScale: 0.5`, `billow: 0.3`, `erosion: 0.11`, `detail: 0.08`, `turbulence: 0.4`, `seed: 7` |
| Direct light | `lightDirection: [-1,1,0.2]`, `sunIntensity: 2.2`, `exposure: 1.1` |
| Ambient light and scattering | `ambient: 0.48`, `ambientGradient: 0.18`, `absorption: 1`, `shadowStrength: 0.9`, `scattering: 0.13`, `anisotropy: 0.45`, `powder: 0.35`, `silverLining: 1.2` |
| Colors | `lightColor: [1,0.97,0.91]`, `cloudColor: [1,1,1]`, `shadowColor: [0.43,0.47,0.56]`, `skyTop: [0.018,0.17,0.4]`, `skyBottom: [0.3,0.43,0.66]` |
| Background | `skyGradient: 0.25`, `sunGlow: 0.05`, `transparent: false`, `opacity: 1` |
| Camera | `yaw: 0.12`, `pitch: 0.06` (radians), `distance: 6.6`, `fov: 42` (degrees), `target: [0,0.55,0]`, `offset: [0,0]` |
| Animation | `wind: [0.2,-0.04,0.07]`, used with `animate`, `time`, and `speed` |

Numeric values must be finite. Colors use sRGB RGB arrays with components from 0 to 1. Each `scale` component must be positive, the light direction must be nonzero, and `anisotropy` must be strictly between -1 and 1. `opacity`, `powder`, `ambientGradient`, and `jitter` use 0–1. Divisors such as softness, camera distance, and noise scale must be positive. Panel ranges are convenient editing ranges; full API validation is in `src/validation.js`.

## Procedural generation and shaders

`src/shape.js` generates three groups of spherical density regions for the base, crown, and foreground: 12 `[x, y, z, radius]` entries in total. It uses deterministic randomness and arc distribution formulas rather than stored geometry tables, base64, or binary data. Results are written directly into the end of the shared uniform array. The same seed produces the same cloud shape.

```js
cloud.update({ seed: 42 }); // Regenerate the shape and shift shader noise sampling
```

The shape is only regenerated when `seed` changes. Continuous cloud motion is driven by `time` and `wind` in the shaders. The noise lookup texture is also generated procedurally in JavaScript, without image downloads.

Shaders are stored as native source files, rather than JavaScript string wrappers or syntax translated at runtime:

- WebGL2: `src/shaders/cloud.vert.glsl` + `src/shaders/cloud.frag.glsl`, using GLSL ES 3.00.
- WebGPU: `src/shaders/cloud.wgsl`, using native WGSL with vertex and fragment entry points.
- Each renderer loads and compiles only its own source files. Both use the same uniform layout and generated shape data.

## Size and memory accounting

The playground's `SHADERS` metric shows `cloud.sourceBytes`: the UTF-8 byte count of the shader sources loaded by the active backend. For WebGL2, this is the sum of both GLSL files; for WebGPU, it is the single WGSL file. This is the uncompressed response body size, not total network traffic accounting for compression, headers, JavaScript, CSS, and fonts.

`memory` reports known persistent rendering resources in bytes:

| Field | Contents |
| --- | --- |
| `shapeBytes` | Procedurally generated shape data, 192 B; **already included in cpu**, not an extra allocation or download |
| `cpu` | Shared uniform array, 512 B; the shape shares 192 B through a subarray view. Active deformation adds 480 B for rest positions, offsets, and velocities |
| `gpu` | Uniform payload and an 8 × 8 × 8 R8 noise texture, totaling 1,024 B |
| `surface` | One RGBA8 drawing surface: `canvas.width × canvas.height × 4` |
| `total` | `cpu + gpu + surface` |
| `estimated` | Always `true` |

Both backends use the same accounting method, updated with the drawing dimensions. **This is not total tab or GPU process memory.** The JavaScript heap, including shader strings, compiled shaders, driver allocations and alignment, swap chains, compositor resources, and hidden copies are excluded because an exact measurement API is unavailable. The playground labels the value as an estimate. KB = 1,000 B.

## Playground and local development

```sh
npm run dev       # http://localhost:5173
npm run build     # Generate dist/
npm run preview   # Serve dist/ on the same port; stop the dev server first
npm test          # Build and check resource budgets, output integrity, and transitions
```

Requires Node.js 20+. There are no npm runtime dependencies, and no bundler is needed.

The interface uses black, white, gray, and the Cousine monospace font, with the playground label in the upper-right corner. The parameter panel appears on the right on desktop and is hidden at viewport widths of 780px or less. Below the carousel are a copyable component example that follows scene and parameter changes, plus shader and component props tables listing types, accepted values, and defaults. Copied examples start animation at time 0.

Only one scene card is rendered in the center. Its six indicators appear as dots, with the active indicator expanding into a short bar showing the nine-second carousel progress. Page numbers, previous / next buttons, and playback controls sit below. Drag the card's lower-right corner to resize it, use arrow keys while the resize button is focused, or enter dimensions in the panel. Drag the cloud to orbit and scroll over it to adjust camera distance. Arrow keys retain their native behavior in parameter inputs without switching scenes.

The hand icon next to playback toggles disperse mode. Entering this mode automatically pauses cloud time and the carousel. Drag or touch the cloud to push and scatter it; release it to let it recover. The hand icon has a small active-state dot. Toggling it off returns to orbit controls and leaves playback paused; pressing Play exits disperse mode and resumes playback.

During playback, scenes advance every nine seconds. Focusing the parameter panel or code / props section suspends automatic scene changes while cloud animation continues. Pausing stops both cloud animation and the carousel, preserving progress for resumption. Scene changes smoothly interpolate sky, lighting, and cloud parameters over 1.4 seconds on the same canvas, preserving animation time and camera state. Rapid selections continue from the current appearance, and manual scene changes still transition while paused. Reduced-motion preferences start playback paused and disable scene and indicator transitions; playback can be started manually.

## Deploying to Vercel

Import this repository and **set Root Directory to the project root**. The included `vercel.json` requires no server, Functions, environment variables, or API key:

- Framework Preset: Other (`null` in the configuration)
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: empty; zero dependencies

You can also run `vercel` from the project root using the Vercel CLI. Vercel serves the HTML, ES modules, and native `.glsl` / `.wgsl` files in `dist/` directly. HTTPS satisfies WebGPU's secure-context requirement, but browser and hardware support are still necessary. WebGL2 is the default; if WebGPU is selected but unavailable, the playground provides a button to switch back to WebGL2 manually.

This SPA has only the `/` route, with no additional client-side routes or catch-all rewrite requirement. Publish `dist/`; uploading only `website/` would omit the component assets.

See [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build). Local builds, output checks, and HTTP rendering can verify deployment readiness; this repository does not contain a published Vercel deployment ID.

## Project structure

The separation between an independent rendering component and a showcase website follows [cobe](https://github.com/shuding/cobe), without adding its runtime dependencies:

```text
src/
  index.js            Component lifecycle, API, camera, and uniform handling
  index.d.ts          Complete option types
  webgl.js            WebGL2 initialization, drawing, and cleanup
  webgpu.js           WebGPU initialization, drawing, and cleanup
  shaders/
    cloud.vert.glsl   WebGL2 vertex shader
    cloud.frag.glsl   WebGL2 fragment shader
    cloud.wgsl        WebGPU vertex / fragment shader
  load-shader.js      Native shader loading and UTF-8 byte counts
  shape.js            Seeded procedural cloud shape written into uniforms
  deformation.js      Pointer impulses and spring recovery for cloud lobes
  resources.js        Shared noise, pixel budgets, and memory accounting
  options.js          Parameter defaults, uniform offsets, and color fields
  validation.js       Composed field rules and atomic option updates
  scenes.js           Six scene presets
website/
  index.html          Playground page
  app.js              Carousel, resizing, backend switching, and page state
  controls.js         Parameter panel
  transition.js       Scene parameter interpolation
  docs.js             Live component example, copying, and props tables
  style.css           Cousine typography, cards, and minimal geek styling
scripts/
  dev.js              Local HTTP server
  build.js            Static dist/ generation
tests/
  core.test.js        Memory, examples, and deployment output checks
  validation.test.js  Option boundaries, atomic updates, and renderer locking
  transition.test.js  Scene interpolation and interrupted transition checks
  deformation.test.js Dispersal, exact recovery, stability, and memory checks
  browser.html        Real WebGL2 / WebGPU lifecycle checks
  serve.js            HTTP server for local tests only
vercel.json           Vercel static deployment configuration
```

Only the selected backend and its shader sources are loaded dynamically. The natural cloud density and lighting shaders are adapted from the supplied `preview.html`, with cloud geometry replaced by seeded procedural generation. Natural lighting is preserved, without a Shader style system. The parameter panel layout references [Paper Halftone CMYK](https://shaders.paper.design/halftone-cmyk).

To run the actual GPU tests, execute `node tests/serve.js`, open `http://localhost:5175/tests/browser.html`, and click Run. The test page is excluded from the Vercel build output.
