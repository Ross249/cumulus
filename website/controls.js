const groups = {
  'Cloud form': [
    ['density', 0, 20, .1], ['coverage', -.25, .8, .01], ['softness', .02, .4, .01],
    ['scale.0', .2, 2, .01], ['scale.1', .2, 2, .01], ['scale.2', .2, 2, .01],
    ['baseHeight', -1, .1, .01], ['baseSoftness', .02, .5, .01], ['blend', .01, .8, .01],
  ],
  'Light': [
    ['sunIntensity', 0, 5, .05], ['ambient', 0, 1.5, .01], ['exposure', .2, 3, .05],
    ['lightDirection.0', -1, 1, .01], ['lightDirection.1', -1, 1, .01], ['lightDirection.2', -1, 1, .01],
    ['absorption', .1, 3, .05], ['shadowStrength', 0, 3, .05], ['scattering', 0, 1, .01],
    ['anisotropy', -.9, .9, .01], ['powder', 0, 1, .01], ['silverLining', 0, 6, .1], ['ambientGradient', 0, 1, .01],
  ],
  'Colors': ['lightColor', 'cloudColor', 'shadowColor', 'skyTop', 'skyBottom'],
  'Noise': [
    ['noiseScale', .15, 1.2, .01], ['billow', 0, .9, .01], ['erosion', 0, .5, .01],
    ['detail', 0, .3, .01], ['turbulence', 0, 1.5, .01], ['seed', 0, 1000, 1],
  ],
  'Camera & motion': [
    ['speed', 0, 3, .05], ['distance', 3, 30, .1], ['yaw', -3.14, 3.14, .01], ['pitch', -1.4, 1.4, .01],
    ['fov', 25, 85, 1], ['target.0', -2, 2, .05], ['target.1', -2, 2, .05], ['target.2', -2, 2, .05],
    ['offset.0', -1, 1, .01], ['offset.1', -1, 1, .01],
    ['wind.0', -1, 1, .01], ['wind.1', -1, 1, .01], ['wind.2', -1, 1, .01],
    ['opacity', 0, 1, .01], ['skyGradient', .05, 1, .01], ['sunGlow', 0, 1, .01],
    ['transparent', 'boolean'],
  ],
  'Quality': [
    ['maxPixels', 10000, 1000000, 10000], ['resolution', .25, 1, .05], ['pixelRatio', .5, 2, .1],
    ['steps', 16, 192, 1], ['lightSteps', 1, 12, 1], ['lightDistance', .2, 8, .1], ['jitter', 0, 1, .01],
  ],
};
const hex = (value) => '#' + value.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

export function createPanel(root, onChange) {
  let current = {}, disabled = true;
  const fields = [];
  for (const [group, definitions] of Object.entries(groups)) {
    const section = document.createElement('details');
    section.className = 'control-group';
    section.open = ['Cloud form', 'Light'].includes(group);
    const title = document.createElement('summary');
    title.textContent = group;
    section.append(title);
    const list = document.createElement('div');
    list.className = 'control-fields';
    for (const definition of definitions) {
      const color = typeof definition === 'string';
      const [path, min, max, step] = color ? [definition] : definition;
      const boolean = min === 'boolean';
      const [key, axis] = path.split('.');
      const label = axis === undefined ? key : `${key}.${'xyz'[axis]}`;
      const row = document.createElement('div'); row.className = 'control-row';
      const name = document.createElement('label'); name.className = 'control-label'; name.textContent = label;
      const inputs = document.createElement('div'); inputs.className = 'control-inputs';
      const primary = document.createElement('input');
      primary.id = `prop-${path}`;
      primary.setAttribute('aria-label', label);
      name.htmlFor = primary.id;
      primary.type = color ? 'color' : boolean ? 'checkbox' : 'range';
      if (boolean) primary.className = 'check-input';
      let number;
      if (!boolean) {
        number = document.createElement('input');
        number.type = color ? 'text' : 'number';
        number.setAttribute('aria-label', `${label} value`);
        if (color) { number.className = 'hex-input'; number.maxLength = 7; }
        else for (const input of [primary, number]) { input.min = min; input.max = max; input.step = step; }
        inputs.append(primary, number);
      } else inputs.append(primary);
      function edit(raw) {
        let value;
        if (color) {
          if (!/^#[0-9a-f]{6}$/i.test(raw)) return;
          value = [1, 3, 5].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255);
        } else if (boolean) value = primary.checked;
        else {
          if (raw === '' || !Number.isFinite(+raw)) return;
          value = Math.max(min, Math.min(max, +raw));
          if (step >= 1) value = Math.round(value);
        }
        if (axis !== undefined) { const vector = [...current[key]]; vector[+axis] = value; value = vector; }
        onChange({ [key]: value });
      }
      primary.addEventListener('input', () => edit(primary.value));
      number?.addEventListener('input', () => edit(number.value));
      number?.addEventListener('blur', () => sync(current));
      row.append(name, inputs); list.append(row);
      fields.push({ key, axis, primary, number, color, boolean, step });
    }
    section.append(list); root.append(section);
  }
  function sync(options) {
    current = options;
    for (const field of fields) {
      const { key, axis, primary, number, color, boolean, step } = field;
      let value = axis === undefined ? options[key] : options[key]?.[axis];
      if (value === undefined) continue;
      if (boolean) primary.checked = value;
      else {
        primary.value = color ? hex(value) : value;
        if (document.activeElement !== number) number.value = color ? hex(value) : Number(value).toFixed(step >= 1 ? 0 : 2);
      }
      primary.disabled = disabled;
      if (number) number.disabled = primary.disabled;
    }
  }
  return { sync, setDisabled(value) { disabled = value; sync(current); } };
}
