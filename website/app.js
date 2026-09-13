import createCloud, { scenes, defaultOptions } from './src/index.js';
import { createPanel } from './controls.js';
import { createDocs } from './docs.js';
import { interpolateScene } from './transition.js';

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const card = $('scene-card'), stage = document.querySelector('.stage');
const sceneDuration = 9000, transitionDuration = 1400, indicatorButtons = [];
const bytes = (value) => value < 1000 ? `${value} B` : value < 1e6 ? `${(value / 1000).toFixed(2)} KB` : `${(value / 1e6).toFixed(2)} MB`;
let canvas = $('cloud'), cloud, current = 0, revision = 0, busy = true, autoFit = true;
let playing = !reducedMotion.matches, elapsed = 0, drag, resizing, lastMetrics = 0;
let sceneTransition;
let interacting = false;
let lastCpuBytes = 0;
let settings = { ...defaultOptions(), animate: playing,
  pixelRatio: Math.min(devicePixelRatio || 1, 2), resolution: 1, maxPixels: 650000, speed: .65 };
const panel = createPanel($('controls'), (patch) => {
  if (patch.distance !== undefined) autoFit = false;
  update(patch);
  resetProgress();
});

const docs = createDocs();
panel.sync(settings);
docs.sync(settings, card.offsetWidth, card.offsetHeight);

function cameraFrame() {
  const fov = cloud?.options.fov || settings.fov;
  const aspect = card.clientWidth / card.clientHeight;
  return { distance: Math.max(6.8, 3.1 / (aspect * Math.tan(fov * Math.PI / 360))) };
}
function sync() {
  if (!cloud) return;
  settings = cloud.options;
  const memory = cloud.memory, stats = cloud.stats;
  lastCpuBytes = memory.cpu;
  $('shader-size').textContent = bytes(cloud.sourceBytes);
  $('memory-size').textContent = bytes(memory.total);
  for (const key of ['cpu', 'gpu', 'surface']) $(key + '-size').textContent = bytes(memory[key]);
  $('render-size').textContent = `${stats.width} × ${stats.height} px`;
  panel.sync(settings);
  docs.sync(settings, card.offsetWidth, card.offsetHeight);
}
function setBusy(value) {
  busy = value;
  panel.setDisabled(value || !cloud);
  $('renderer').disabled = value;
  document.querySelectorAll('.carousel button, #reset').forEach((button) => { button.disabled = value || !cloud; });
  card.setAttribute('aria-busy', String(value));
}
function paintProgress() {
  indicatorButtons[current]?.style.setProperty('--progress', String(Math.min(1, elapsed / sceneDuration)));
}
function resetProgress() { elapsed = 0; paintProgress(); }
function finishTransition() {
  if (sceneTransition && cloud) cloud.update(sceneTransition.to);
  sceneTransition = null;
}
function fail(error) {
  $('loading').hidden = true;
  $('error').hidden = false;
  $('error-message').textContent = error.message || String(error);
  sceneTransition = null;
  cloud?.destroy(); cloud = null;
  setBusy(false);
}
function update(patch) {
  if (!cloud || busy) return;
  try {
    cloud.update(patch);
    if (patch.scene) sceneTransition = null;
    // A user edit takes control of that field while the other fields keep blending.
    else if (sceneTransition) for (const key of Object.keys(patch)) {
      delete sceneTransition.from[key]; delete sceneTransition.to[key];
    }
    cloud.render(); sync();
  }
  catch (error) { $('announcement').textContent = error.message; panel.sync(cloud.options); }
}
function selectScene(index, manual = true) {
  if (!cloud || busy) return;
  const next = (index + scenes.length) % scenes.length;
  if (next === current) { resetProgress(); return; }
  indicatorButtons[current].style.setProperty('--progress', '0');
  current = next;
  resetProgress();
  const scene = scenes[current];
  const state = cloud.options;
  const from = Object.fromEntries(Object.keys(scene.values).map(key => [key, state[key]]));
  sceneTransition = reducedMotion.matches ? null : {
    from, to: structuredClone(scene.values), elapsed: 0, lastTime: performance.now(),
  };
  // Set the preset name without jumping its uniforms to the destination.
  cloud.update({ scene: scene.name, ...(sceneTransition ? from : scene.values) });
  sync();
  $('scene-name').textContent = scene.name;
  const count = `${String(current + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
  $('scene-count').textContent = $('card-index').textContent = count;
  card.setAttribute('aria-label', `${scene.name} scene`);
  document.title = `Cumulus — ${scene.name}`;
  document.querySelectorAll('.indicator').forEach((button, i) => button.setAttribute('aria-current', String(i === current)));
  if (manual) $('announcement').textContent = `${scene.name}, ${current + 1} of ${scenes.length}`;
}
function setPlaying(value) {
  if (value && interacting) setInteraction(false);
  playing = value;
  cloud?.update({ animate: value });
  $('pause-icon').toggleAttribute('hidden', !value);
  $('play-icon').toggleAttribute('hidden', value);
  const label = `${value ? 'Pause' : 'Play'} cloud and carousel`;
  $('play').setAttribute('aria-label', label); $('play').title = label;
  sync();
}
function setInteraction(value) {
  interacting = value;
  drag = null;
  $('interact').setAttribute('aria-pressed', String(value));
  $('interact').title = value ? 'Exit disperse mode' : 'Disperse cloud';
  card.classList.toggle('is-interacting', value);
  canvas.setAttribute('aria-label', value ? 'Cloud preview. Drag to disperse; release to restore.' : 'Cloud preview. Drag to rotate; scroll to zoom.');
  if (value) setPlaying(false);
  $('announcement').textContent = value ? 'Disperse mode. Drag the cloud; release to restore.' : 'Orbit mode.';
}
function onRender(time, delta) {
  if (!cloud || busy) return;
  if (sceneTransition) {
    const now = performance.now();
    sceneTransition.elapsed += Math.min(100, now - sceneTransition.lastTime);
    sceneTransition.lastTime = now;
    const progress = Math.min(1, sceneTransition.elapsed / transitionDuration);
    // update schedules the next frame even when cloud time is paused.
    cloud.update(interpolateScene(sceneTransition.from, sceneTransition.to, progress));
    if (progress === 1) { sceneTransition = null; sync(); }
  }
  if (playing && !drag && !resizing && !document.activeElement.closest('.panel, .documentation')) elapsed += delta * 1000;
  paintProgress();
  if (elapsed >= sceneDuration) selectScene(current + 1, false);
  // Keep uniforms/animation independent of DOM update frequency.
  if (performance.now() - lastMetrics > 1000 || cloud.memory.cpu !== lastCpuBytes) { sync(); lastMetrics = performance.now(); }
}
async function start() {
  const ownRevision = ++revision;
  finishTransition();
  settings = { ...(cloud?.options || settings), renderer: $('renderer').value, animate: playing };
  cloud?.destroy(); cloud = null;
  setBusy(true); $('error').hidden = true; $('loading').hidden = false;
  const fresh = canvas.cloneNode(false); canvas.replaceWith(fresh); canvas = fresh;
  bindCanvas(canvas);
  try {
    const instance = await createCloud(canvas, { ...settings, ...(autoFit ? cameraFrame() : {}), onRender,
      onError: (error) => { if (ownRevision === revision) fail(error); } });
    if (ownRevision !== revision) { instance.destroy(); return; }
    cloud = instance;
    $('loading').hidden = true;
    setBusy(false); setPlaying(playing); sync();
  } catch (error) { if (ownRevision === revision) fail(error); }
}

for (const [index, scene] of scenes.entries()) {
  const button = document.createElement('button');
  button.className = 'indicator'; button.type = 'button'; button.disabled = true;
  button.setAttribute('aria-label', `${String(index + 1).padStart(2, '0')} ${scene.name}`);
  button.setAttribute('aria-current', String(index === 0));
  const track = document.createElement('span'); track.className = 'indicator-track';
  track.setAttribute('aria-hidden', 'true'); button.append(track);
  const tooltip = document.createElement('span'); tooltip.className = 'indicator-label';
  tooltip.textContent = scene.name; tooltip.setAttribute('aria-hidden', 'true'); button.append(tooltip);
  button.onclick = () => selectScene(index); $('indicators').append(button);
  indicatorButtons.push(button);
}
$('previous').onclick = () => selectScene(current - 1);
$('next').onclick = () => selectScene(current + 1);
$('play').onclick = () => setPlaying(!playing);
$('interact').onclick = () => setInteraction(!interacting);
$('renderer').onchange = start;
$('retry').onclick = start;
$('use-webgl').onclick = () => { $('renderer').value = 'webgl2'; start(); };
$('reset').onclick = () => {
  autoFit = true;
  update({ ...defaultOptions(), ...scenes[current].values, scene: scenes[current].name, renderer: $('renderer').value,
    pixelRatio: Math.min(devicePixelRatio || 1, 2), resolution: 1, maxPixels: 650000,
    speed: .65, animate: playing, ...cameraFrame() });
  resetProgress();
};
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) { finishTransition(); setPlaying(false); }
});
$('indicators').addEventListener('focusin', (event) => {
  if (event.target.matches(':focus-visible')) setPlaying(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') $('memory-details').open = false;
  if (!cloud || busy || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest('input, select, summary, #resize-handle')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); selectScene(current + (event.key === 'ArrowLeft' ? -1 : 1));
  }
  if (event.code === 'Space' && (event.target === canvas || event.target === document.body)) {
    event.preventDefault(); setPlaying(!playing);
  }
});
document.addEventListener('pointerdown', (event) => {
  if (!$('memory-details').contains(event.target)) $('memory-details').open = false;
});
function bindCanvas(element) {
  const pointer = (event) => {
    const rect = element.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
  };
  element.onpointerdown = (event) => {
    if (!cloud || busy || !event.isPrimary || event.button !== 0) return;
    if (interacting) {
      drag = pointer(event);
      cloud.disturb(drag.x, drag.y);
    } else {
      const { yaw, pitch } = cloud.options;
      drag = { x: event.clientX, y: event.clientY, yaw, pitch };
      resetProgress();
    }
    element.setPointerCapture(event.pointerId);
  };
  element.onpointermove = (event) => {
    if (!drag || !cloud) return;
    if (interacting) {
      const next = pointer(event);
      cloud.disturb(next.x, next.y, next.x - drag.x, next.y - drag.y);
      drag = next;
      return;
    }
    cloud.update({ yaw: drag.yaw - (event.clientX - drag.x) * .005,
      pitch: Math.max(-1.4, Math.min(1.4, drag.pitch + (event.clientY - drag.y) * .005)) });
  };
  element.onpointerup = element.onpointercancel = element.onlostpointercapture = () => { drag = null; if (cloud) sync(); };
  element.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (cloud && !busy) { autoFit = false; update({ distance: Math.max(3, Math.min(30, cloud.options.distance * Math.exp(event.deltaY * .001))) }); }
    resetProgress();
  }, { passive: false });
}
function resizeTo(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  card.style.width = `${Math.min(stage.clientWidth, 1600, Math.max(240, width))}px`;
  card.style.height = `${Math.min(800, Math.max(220, height))}px`;
}
$('preview-width').onchange = () => { resizeTo(+$('preview-width').value, card.offsetHeight); refreshDimensions(); };
$('preview-height').onchange = () => { resizeTo(card.offsetWidth, +$('preview-height').value); refreshDimensions(); };
$('preview-width').oninput = () => {
  if ($('preview-width').value && $('preview-width').validity.valid) resizeTo(+$('preview-width').value, card.offsetHeight);
};
$('preview-height').oninput = () => {
  if ($('preview-height').value && $('preview-height').validity.valid) resizeTo(card.offsetWidth, +$('preview-height').value);
};
$('preview-width').onblur = $('preview-height').onblur = refreshDimensions;
const handle = $('resize-handle');
handle.onpointerdown = (event) => {
  event.preventDefault();
  resizing = { x: event.clientX, y: event.clientY, width: card.offsetWidth, height: card.offsetHeight };
  card.classList.add('resizing'); handle.setPointerCapture(event.pointerId);
};
handle.onpointermove = (event) => {
  if (resizing) resizeTo(resizing.width + (event.clientX - resizing.x) * 2, resizing.height + event.clientY - resizing.y);
};
handle.onpointerup = handle.onpointercancel = handle.onlostpointercapture = () => { resizing = null; card.classList.remove('resizing'); };
handle.onkeydown = (event) => {
  const keys = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
  if (keys[event.key]) { event.preventDefault(); const [x, y] = keys[event.key]; resizeTo(card.offsetWidth + x, card.offsetHeight + y); }
};
function refreshDimensions() {
  const width = card.offsetWidth, height = card.offsetHeight;
  if (document.activeElement !== $('preview-width')) $('preview-width').value = width;
  if (document.activeElement !== $('preview-height')) $('preview-height').value = height;
  $('preview-width').max = Math.floor(stage.clientWidth);
  $('preview-dimensions').textContent = `${width} × ${height}`;
  document.querySelector('.stage-heading').style.width = `${width}px`;
  document.querySelector('.preview-metrics').style.width = `${width}px`;
}
const observer = new ResizeObserver(() => {
  refreshDimensions();
  if (cloud && !busy) { if (autoFit) cloud.update(cameraFrame()); cloud.render(); sync(); }
});
observer.observe(card);
refreshDimensions();
await start();
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) { revision++; observer.disconnect(); cloud?.destroy(); }
});
