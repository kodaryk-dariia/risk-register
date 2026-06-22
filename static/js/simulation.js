// ── Field guide toggle ───────────────────────────────────────────────────
function toggleGuide(id) {
  const body = document.getElementById(id);
  const chevron = document.getElementById(id + '-chevron');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chevron) chevron.textContent = open ? '▾' : '▴';
}

// ── State ─────────────────────────────────────────────────────────────────
let threatCount = 0, mitCount = 0, mapCount = 0;
let lastResults = null;
let currentMode = 'design';

// ── ID counter helpers ────────────────────────────────────────────────────
// Read the highest numeric suffix already in the table so new rows continue
// from the correct number even after loadExample() pre-fills rows.
function nextThreatNum() {
  const ids = Array.from(document.querySelectorAll('[id^="t-id-"]'))
    .map(el => parseInt(el.id.split('-')[2]) || 0);
  const maxUsed = ids.length ? Math.max(...ids) : 0;
  threatCount = Math.max(threatCount, maxUsed);
  return ++threatCount;
}
function nextMitNum() {
  const ids = Array.from(document.querySelectorAll('[id^="m-id-"]'))
    .map(el => parseInt(el.id.split('-')[2]) || 0);
  const maxUsed = ids.length ? Math.max(...ids) : 0;
  mitCount = Math.max(mitCount, maxUsed);
  return ++mitCount;
}
function nextMapNum() {
  const ids = Array.from(document.querySelectorAll('[id^="map-t-"]'))
    .map(el => parseInt(el.id.split('-')[2]) || 0);
  const maxUsed = ids.length ? Math.max(...ids) : 0;
  mapCount = Math.max(mapCount, maxUsed);
  return ++mapCount;
}

// ── Auto-suggest next threat ID value ────────────────────────────────────
function nextThreatIdValue() {
  const vals = Array.from(document.querySelectorAll('[id^="t-id-"]'))
    .map(el => el.value).filter(v => /^T-\d+$/.test(v))
    .map(v => parseInt(v.replace('T-', '')));
  return vals.length ? `T-${Math.max(...vals) + 1}` : 'T-1';
}
function nextMitIdValue() {
  const vals = Array.from(document.querySelectorAll('[id^="m-id-"]'))
    .map(el => el.value).filter(v => /^M-\d+$/.test(v))
    .map(v => parseInt(v.replace('M-', '')));
  return vals.length ? `M-${Math.max(...vals) + 1}` : 'M-1';
}

// ── Mode switching ──────────────────────────────────────────────────────
function setMode(mode) {
  currentMode = mode;
  document.getElementById('mode-design-label').classList.toggle('selected', mode === 'design');
  document.getElementById('mode-baseline-label').classList.toggle('selected', mode === 'baseline');

  const note = document.getElementById('implemented-col-note');
  const thControlsCol = document.getElementById('th-controls-col');
  if (mode === 'baseline') {
    note.style.display = 'inline';
    thControlsCol.textContent = 'New controls added';
    document.querySelectorAll('.mit-implemented-col').forEach(el => el.style.display = '');
    document.querySelectorAll('.threat-isnew-col').forEach(el => el.style.display = '');
  } else {
    note.style.display = 'none';
    thControlsCol.textContent = 'Controls';
    document.querySelectorAll('.mit-implemented-col').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.threat-isnew-col').forEach(el => el.style.display = 'none');
  }
}

// ── Row builders ─────────────────────────────────────────────────────────
function addThreat(vals = {}) {
  const c = nextThreatNum();
  const id = vals.id || nextThreatIdValue();
  const showNew = currentMode === 'baseline';
  const div = document.createElement('div');
  div.className = 'data-row threat-row';
  div.id = `threat-row-${c}`;
  div.innerHTML = `
    <div><div class="row-label">ID</div>
      <input class="row-input" id="t-id-${c}" value="${id}" placeholder="T-1" title="A short unique code for this threat, e.g. T-1" /></div>
    <div><div class="row-label">Label</div>
      <input class="row-input" id="t-label-${c}" value="${vals.label||''}" placeholder="Spoofing – Sensor" title="A short human-readable name for this threat" /></div>
    <div><div class="row-label">Likelihood</div>
      <input class="row-input" id="t-lh-${c}" type="number" step="0.01" min="0.01" max="0.99" value="${vals.likelihood||0.6}" title="How often this would happen, 0 (rare) to 1 (almost certain)" /></div>
    <div><div class="row-label">Harm Mean</div>
      <input class="row-input" id="t-hm-${c}" type="number" step="0.01" min="0.01" max="0.99" value="${vals.harm_mean||0.85}" title="Best-guess severity if it happens, 0 (none) to 1 (worst case)" /></div>
    <div><div class="row-label">Harm Var</div>
      <input class="row-input" id="t-hv-${c}" type="number" step="0.001" min="0.001" value="${vals.harm_variance||0.01}" title="How uncertain that harm guess is — small number = confident, larger = unsure" /></div>
    <div class="threat-isnew-col" style="display:${showNew?'':'none'}"><div class="row-label">New?</div>
      <div class="row-check"><input type="checkbox" id="t-isnew-${c}" ${vals.is_new?'checked':''} /></div></div>
    <button class="row-del" onclick="removeRow('threat-row-${c}')" title="Remove">✕</button>`;
  document.getElementById('threats-container').appendChild(div);
}

function addMitigation(vals = {}) {
  const c = nextMitNum();
  const id = vals.id || nextMitIdValue();
  const showImpl = currentMode === 'baseline';
  const div = document.createElement('div');
  div.className = 'data-row mit-row';
  div.id = `mit-row-${c}`;
  div.innerHTML = `
    <div><div class="row-label">ID</div>
      <input class="row-input" id="m-id-${c}" value="${id}" placeholder="M-1" title="A short unique code for this control, e.g. M-1" /></div>
    <div><div class="row-label">Label</div>
      <input class="row-input" id="m-label-${c}" value="${vals.label||''}" placeholder="AES-128 BLE" title="A short human-readable name for this control" /></div>
    <div><div class="row-label">Cost Min $</div>
      <input class="row-input" id="m-cmin-${c}" type="number" step="1" min="1" value="${vals.cost_min||100}" title="Lowest realistic implementation cost in $" /></div>
    <div><div class="row-label">Cost Max $</div>
      <input class="row-input" id="m-cmax-${c}" type="number" step="1" min="1" value="${vals.cost_max||1000}" title="Highest realistic implementation cost in $" /></div>
    <div><div class="row-label">Eff Mean</div>
      <input class="row-input" id="m-em-${c}" type="number" step="0.01" min="0.01" max="0.99" value="${vals.eff_mean||0.85}" title="How much risk this removes when active, 0 (none) to 1 (perfect)" /></div>
    <div><div class="row-label">Eff Var</div>
      <input class="row-input" id="m-ev-${c}" type="number" step="0.001" min="0.001" value="${vals.eff_variance||0.01}" title="How much that effectiveness could vary — small = confident, larger = unsure" /></div>
    <div class="mit-implemented-col" style="display:${showImpl?'':'none'}"><div class="row-label">Implemented</div>
      <div class="row-check"><input type="checkbox" id="m-impl-${c}" ${vals.already_implemented?'checked':''} /></div></div>
    <button class="row-del" onclick="removeRow('mit-row-${c}')" title="Remove">✕</button>`;
  document.getElementById('mitigations-container').appendChild(div);
}

function addMapping(vals = {}) {
  const c = nextMapNum();
  const div = document.createElement('div');
  div.className = 'data-row map-row';
  div.id = `map-row-${c}`;
  div.innerHTML = `
    <div><div class="row-label">Threat ID</div>
      <input class="row-input" id="map-t-${c}" value="${vals.threat||''}" placeholder="T-1" /></div>
    <div><div class="row-label">Control ID</div>
      <input class="row-input" id="map-m-${c}" value="${vals.mitigation||''}" placeholder="M-1" /></div>
    <button class="row-del" onclick="removeRow('map-row-${c}')" title="Remove">✕</button>`;
  document.getElementById('mapping-container').appendChild(div);
}

function removeRow(id) { document.getElementById(id)?.remove(); }

function clearAll() {
  document.getElementById('threats-container').innerHTML = '';
  document.getElementById('mitigations-container').innerHTML = '';
  document.getElementById('mapping-container').innerHTML = '';
  threatCount = 0; mitCount = 0; mapCount = 0;
  document.getElementById('results-panel').style.display = 'none';
}

// ── Collect form data ─────────────────────────────────────────────────────
function collectThreats() {
  return Array.from(document.querySelectorAll('[id^="t-id-"]')).map(el => {
    const n = el.id.split('-')[2];
    const isNewEl = document.getElementById(`t-isnew-${n}`);
    return {
      id:             document.getElementById(`t-id-${n}`).value.trim(),
      label:          document.getElementById(`t-label-${n}`)?.value || '',
      likelihood:     document.getElementById(`t-lh-${n}`).value,
      harm_mean:      document.getElementById(`t-hm-${n}`).value,
      harm_variance:  document.getElementById(`t-hv-${n}`).value,
      is_new:         isNewEl ? isNewEl.checked : false,
    };
  }).filter(r => r.id);
}

function collectMitigations() {
  return Array.from(document.querySelectorAll('[id^="m-id-"]')).map(el => {
    const n = el.id.split('-')[2];
    const implEl = document.getElementById(`m-impl-${n}`);
    return {
      id:                   document.getElementById(`m-id-${n}`).value.trim(),
      label:                document.getElementById(`m-label-${n}`)?.value || '',
      cost_min:             document.getElementById(`m-cmin-${n}`).value,
      cost_max:             document.getElementById(`m-cmax-${n}`).value,
      eff_mean:             document.getElementById(`m-em-${n}`).value,
      eff_variance:         document.getElementById(`m-ev-${n}`).value,
      already_implemented:  (currentMode === 'baseline') && implEl ? implEl.checked : false,
    };
  }).filter(r => r.id);
}

function collectMapping() {
  return Array.from(document.querySelectorAll('[id^="map-t-"]')).map(el => {
    const n = el.id.split('-')[2];
    return {
      threat:     document.getElementById(`map-t-${n}`).value.trim(),
      mitigation: document.getElementById(`map-m-${n}`).value.trim(),
    };
  }).filter(r => r.threat && r.mitigation);
}

// ── Validation ────────────────────────────────────────────────────────────
function validateAll() {
  const threats    = collectThreats();
  const mitigations = collectMitigations();
  const mapping    = collectMapping();
  const errors = [];

  if (threats.length === 0) {
    errors.push('Add at least one threat.');
    return errors;
  }
  if (mitigations.length === 0) {
    errors.push('Add at least one control.');
    return errors;
  }

  // Check all numeric fields are valid
  threats.forEach(t => {
    const L = parseFloat(t.likelihood), hm = parseFloat(t.harm_mean), hv = parseFloat(t.harm_variance);
    if (isNaN(L) || L <= 0 || L >= 1) errors.push(`Threat ${t.id}: Likelihood must be between 0 and 1.`);
    if (isNaN(hm) || hm <= 0 || hm >= 1) errors.push(`Threat ${t.id}: Harm Mean must be between 0 and 1.`);
    if (isNaN(hv) || hv <= 0) errors.push(`Threat ${t.id}: Harm Variance must be greater than 0.`);
  });
  mitigations.forEach(m => {
    const cmin = parseFloat(m.cost_min), cmax = parseFloat(m.cost_max);
    const em = parseFloat(m.eff_mean), ev = parseFloat(m.eff_variance);
    if (isNaN(cmin) || cmin <= 0) errors.push(`Control ${m.id}: Cost Min must be greater than 0.`);
    if (isNaN(cmax) || cmax <= cmin) errors.push(`Control ${m.id}: Cost Max must be greater than Cost Min.`);
    if (isNaN(em) || em <= 0 || em >= 1) errors.push(`Control ${m.id}: Effectiveness Mean must be between 0 and 1.`);
    if (isNaN(ev) || ev <= 0) errors.push(`Control ${m.id}: Effectiveness Variance must be greater than 0.`);
  });

  if (errors.length) return errors;

  // Check every threat appears at least once in the mapping
  const mappedThreats = new Set(mapping.map(r => r.threat));
  const unmappedThreats = threats.filter(t => !mappedThreats.has(t.id)).map(t => t.id);
  if (unmappedThreats.length) {
    errors.push(`These threats are not linked to any control: ${unmappedThreats.join(', ')}. Add a row in the Mapping section below.`);
  }

  // Check mapping doesn't reference IDs that don't exist
  const threatIds  = new Set(threats.map(t => t.id));
  const mitIds     = new Set(mitigations.map(m => m.id));
  mapping.forEach(r => {
    if (!threatIds.has(r.threat))     errors.push(`Mapping references unknown threat ID "${r.threat}".`);
    if (!mitIds.has(r.mitigation))   errors.push(`Mapping references unknown control ID "${r.mitigation}".`);
  });

  return errors;
}

// ── Run simulation ────────────────────────────────────────────────────────
async function runSimulation() {
  // Validate first
  const errors = validateAll();
  if (errors.length) {
    showValidationErrors(errors);
    return;
  }
  clearValidationErrors();
  const btn = document.getElementById('run-btn');
  const label = document.getElementById('run-label');
  btn.disabled = true;
  label.textContent = '⟳ Running…';

  const payload = {
    threshold:   parseFloat(document.getElementById('threshold').value) || 0.07,
    mode:        currentMode,
    threats:     collectThreats(),
    mitigations: collectMitigations(),
    mapping:     collectMapping(),
  };

  try {
    const resp = await fetch('/api/simulate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) { showToast(data.error || 'Simulation error'); return; }
    lastResults = data;
    renderResults(data);
  } catch(e) {
    showToast('Network error: ' + e.message);
  } finally {
    btn.disabled = false;
    label.textContent = '▶ Run Simulation';
  }
}

// ── Render ────────────────────────────────────────────────────────────────
function renderResults(data) {
  const panel = document.getElementById('results-panel');
  panel.style.display = 'block';
  panel.scrollIntoView({behavior:'smooth', block:'start'});

  const modeNote = data.mode === 'baseline'
    ? `<strong>Mode:</strong> existing system — costs below exclude controls already implemented<br>`
    : '';

  document.getElementById('results-summary').innerHTML =
    modeNote +
    `<strong>Threshold:</strong> ${data.threshold} &nbsp;|&nbsp;
     <strong>Combinations tested:</strong> ${data.total_subsets.toLocaleString()} &nbsp;|&nbsp;
     <strong>Accepted:</strong> ${data.accepted}<br>
     ${data.accepted === 0
       ? '<span style="color:var(--red)">No combination satisfies the threshold. Try raising it, or add a more effective control.</span>'
       : `<strong>Best RSI:</strong> <span style="color:var(--green)">${data.results[0]?.rsi}</span>
          &nbsp;|&nbsp; <strong>${data.mode === 'baseline' ? 'New controls' : 'Controls'}:</strong> ${data.mode === 'baseline' ? data.results[0]?.new_controls_str : data.results[0]?.subset_str}`}`;

  renderTable(data.results, data.mode);
  renderPlotly3D(data.results);
  renderTop5(data.results);
}

function rsiClass(rsi) {
  if (rsi < 2) return 'rsi-best';
  if (rsi < 4) return 'rsi-mid';
  return 'rsi-high';
}

function renderTable(results, mode) {
  const tbody = document.getElementById('results-tbody');
  tbody.innerHTML = '';
  results.forEach((r, i) => {
    const bd = r.breakdown;
    const dots = [
      {cls:'dot-low', n:bd.low}, {cls:'dot-lowmed', n:bd['low-medium']},
      {cls:'dot-medium', n:bd.medium}, {cls:'dot-medhigh', n:bd['medium-high']}, {cls:'dot-high', n:bd.high},
    ].map(d => Array(d.n).fill(`<div class="risk-dot ${d.cls}" title="${d.cls}"></div>`).join('')).join('');

    const displaySet = mode === 'baseline' ? (r.new_controls_str || 'None new') : (r.subset_str || 'None');

    tbody.innerHTML += `<tr>
      <td style="color:var(--text-dim);font-family:var(--font-mono)">${i+1}</td>
      <td style="font-family:var(--font-mono);font-size:.77rem;color:var(--cyan)">${displaySet}</td>
      <td style="font-family:var(--font-mono)">$${r.total_cost.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
      <td style="font-family:var(--font-mono)">${r.total_risk}</td>
      <td><span class="rsi-val ${rsiClass(r.rsi)}">${r.rsi}</span></td>
      <td><div class="risk-mini">${dots}</div></td>
    </tr>`;
  });
}

// ── 3D Plotly chart: Cost × Risk × RSI ──────────────────────────────────
function renderPlotly3D(results) {
  const el = document.getElementById('plotly-3d');
  if (!el) return;

  if (!window.Plotly) {
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-dim);font-size:.85rem;border:1px dashed var(--line);border-radius:8px">3D chart library didn\'t load — check your network connection and refresh. The ranking table and Top 5 tabs still have the full results.</div>';
    return;
  }

  const x = results.map(r => r.total_cost);
  const y = results.map(r => r.total_risk);
  const z = results.map(r => r.rsi);
  const text = results.map((r,i) => `Rank ${i+1}<br>Controls: ${r.subset_str || 'None'}<br>Cost: $${r.total_cost.toLocaleString()}<br>Risk: ${r.total_risk}<br>RSI: ${r.rsi}`);

  const trace = {
    x, y, z,
    mode: 'markers',
    type: 'scatter3d',
    text,
    hovertemplate: '%{text}<extra></extra>',
    marker: {
      size: 5,
      color: z,
      colorscale: [[0, '#4FCB91'], [0.4, '#E8A33D'], [1, '#F0556B']],
      colorbar: { title: 'RSI', titlefont: {color:'#93A0BD'}, tickfont: {color:'#93A0BD'}, len: 0.7 },
      opacity: 0.88,
      line: { color: '#0E1525', width: 0.5 }
    }
  };

  const layout = {
    margin: { l: 0, r: 0, t: 10, b: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    scene: {
      xaxis: { title: 'Total Cost ($)', color: '#93A0BD', gridcolor: '#263150', backgroundcolor: 'rgba(0,0,0,0)' },
      yaxis: { title: 'Total Risk', color: '#93A0BD', gridcolor: '#263150', backgroundcolor: 'rgba(0,0,0,0)' },
      zaxis: { title: 'RSI', color: '#93A0BD', gridcolor: '#263150', backgroundcolor: 'rgba(0,0,0,0)' },
      camera: { eye: { x: 1.5, y: 1.5, z: 1.1 } }
    },
    font: { family: 'Inter, sans-serif', color: '#EAEEF7' },
  };

  Plotly.newPlot(el, [trace], layout, { responsive: true, displayModeBar: false });
}

function renderTop5(results) {
  const el = document.getElementById('top5-breakdown');
  el.innerHTML = '';
  const top = results.slice(0, 5);
  const levelColors = { low:'#4FCB91', 'low-medium':'#8FCB6B', medium:'#E8A33D', 'medium-high':'#E8823D', high:'#F0556B' };
  const maxCount = Math.max(...top.flatMap(r => Object.values(r.breakdown)), 1);

  top.forEach((r, i) => {
    const bd = r.breakdown;
    const bars = Object.entries(bd).map(([lvl, cnt]) => `
      <div class="top5-bar-row">
        <div class="top5-bar-label">${lvl}</div>
        <div class="top5-bar-outer"><div class="top5-bar-inner" style="width:${(cnt/maxCount)*100}%;background:${levelColors[lvl]}"></div></div>
        <div class="top5-bar-count">${cnt}</div>
      </div>`).join('');

    el.innerHTML += `
      <div class="top5-card">
        <div class="top5-header">
          <span class="top5-rank">RANK ${i+1}</span>
          <span class="top5-subset">${r.subset_str || 'No controls'}</span>
        </div>
        <div class="top5-meta">
          <span>RSI <strong style="color:var(--cyan)">${r.rsi}</strong></span>
          <span>Cost <strong>$${r.total_cost.toLocaleString(undefined,{maximumFractionDigits:0})}</strong></span>
          <span>Risk <strong>${r.total_risk}</strong></span>
        </div>
        <div style="margin-top:.8rem">${bars}</div>
      </div>`;
  });
}

// ── Export ────────────────────────────────────────────────────────────────
async function exportCSV() {
  if (!lastResults) return;
  const resp = await fetch('/api/export', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({results: lastResults.results}),
  });
  if (!resp.ok) { showToast('Export failed'); return; }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'risk_results.csv';
  a.click(); URL.revokeObjectURL(url);
}

// ── Excel upload ──────────────────────────────────────────────────────────
async function handleFileUpload(file) {
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const resp = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await resp.json();
    if (!resp.ok) { showToast(data.error || 'Could not read file'); return; }

    clearAll();
    (data.threats || []).forEach(t => addThreat(t));
    (data.mitigations || []).forEach(m => addMitigation(m));
    (data.mapping || []).forEach(r => addMapping(r));
    showToast(`Loaded ${data.threats.length} threats, ${data.mitigations.length} controls, ${data.mapping.length} mappings.`);
  } catch(e) {
    showToast('Upload failed: ' + e.message);
  }
}

const uploadZone = document.getElementById('upload-zone');
if (uploadZone) {
  ['dragover','dragenter'].forEach(evt => uploadZone.addEventListener(evt, e => { e.preventDefault(); uploadZone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(evt => uploadZone.addEventListener(evt, e => { e.preventDefault(); uploadZone.classList.remove('dragover'); }));
  uploadZone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────
function showTab(name) {
  ['table','chart','breakdown'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = (t === name) ? 'block' : 'none';
  });
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', ['table','chart','breakdown'][i] === name);
  });
  if (name === 'chart' && lastResults) {
    setTimeout(() => renderPlotly3D(lastResults.results), 50);
  }
}

// ── Toast & validation errors ─────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 4500);
}

function showValidationErrors(errors) {
  let el = document.getElementById('validation-errors');
  if (!el) {
    el = document.createElement('div');
    el.id = 'validation-errors';
    el.className = 'validation-errors';
    document.querySelector('.sim-actions').before(el);
  }
  el.innerHTML = '<strong>Please fix the following before running:</strong><ul>' +
    errors.map(e => `<li>${e}</li>`).join('') + '</ul>';
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearValidationErrors() {
  const el = document.getElementById('validation-errors');
  if (el) el.style.display = 'none';
}

// ── Example data ──────────────────────────────────────────────────────────
function loadExample() {
  clearAll();

  const threats = [
    {id:'T-1', label:'Spoofing Sensor',        likelihood:0.6,   harm_mean:0.85, harm_variance:0.008},
    {id:'T-3', label:'Spoofing Actuator',      likelihood:0.6,   harm_mean:0.9,  harm_variance:0.006},
    {id:'T-4', label:'Repudiation Actuator',   likelihood:0.55,  harm_mean:0.05, harm_variance:0.002},
    {id:'T-5', label:'App Spoofing BLE',       likelihood:0.75,  harm_mean:0.9,  harm_variance:0.006},
    {id:'T-6', label:'App Spoofing Server',    likelihood:0.75,  harm_mean:0.88, harm_variance:0.006},
    {id:'T-7', label:'App Tampering',          likelihood:0.75,  harm_mean:0.83, harm_variance:0.006},
    {id:'T-8', label:'App Repudiation',        likelihood:0.55,  harm_mean:0.05, harm_variance:0.002},
    {id:'T-9', label:'Info Disclosure App',    likelihood:0.75,  harm_mean:0.2,  harm_variance:0.015},
    {id:'T-10',label:'DoS Mobile App',         likelihood:0.6,   harm_mean:0.7,  harm_variance:0.01},
    {id:'T-12',label:'Server Spoofing',        likelihood:0.6,   harm_mean:0.7,  harm_variance:0.01},
    {id:'T-14',label:'Data Tampering Sensor',  likelihood:0.725, harm_mean:0.85, harm_variance:0.008},
    {id:'T-15',label:'Data Disclosure Sensor', likelihood:0.75,  harm_mean:0.2,  harm_variance:0.015},
    {id:'T-16',label:'BLE DoS Sensor',         likelihood:0.55,  harm_mean:0.78, harm_variance:0.01},
  ];
  threats.forEach(t => addThreat(t));

  const mits = [
    {id:'M-1', label:'Crypto Auth',        cost_min:500,  cost_max:6250,  eff_mean:0.9,  eff_variance:0.005},
    {id:'M-2', label:'Event Logging',      cost_min:375,  cost_max:2813,  eff_mean:0.85, eff_variance:0.01},
    {id:'M-3', label:'Secure Log Storage', cost_min:1250, cost_max:11250, eff_mean:0.88, eff_variance:0.008},
    {id:'M-4', label:'AES-128 BLE',        cost_min:338,  cost_max:2038,  eff_mean:0.85, eff_variance:0.01},
    {id:'M-5', label:'App Attestation',    cost_min:590,  cost_max:6325,  eff_mean:0.8,  eff_variance:0.02},
    {id:'M-6', label:'Server Cert Auth',   cost_min:130,  cost_max:3249,  eff_mean:0.92, eff_variance:0.004},
    {id:'M-7', label:'TLS v1.3',           cost_min:364,  cost_max:7000,  eff_mean:0.95, eff_variance:0.002},
    {id:'M-8', label:'Root Detection',     cost_min:750,  cost_max:3440,  eff_mean:0.8,  eff_variance:0.02},
    {id:'M-14',label:'BLE Status Display', cost_min:150,  cost_max:3000,  eff_mean:0.75, eff_variance:0.02},
  ];
  mits.forEach(m => addMitigation(m));

  const mapping = [
    {threat:'T-1', mitigation:'M-1'}, {threat:'T-3', mitigation:'M-1'},
    {threat:'T-4', mitigation:'M-2'}, {threat:'T-4', mitigation:'M-3'},
    {threat:'T-5', mitigation:'M-1'}, {threat:'T-5', mitigation:'M-4'}, {threat:'T-5', mitigation:'M-5'},
    {threat:'T-6', mitigation:'M-6'}, {threat:'T-6', mitigation:'M-7'},
    {threat:'T-7', mitigation:'M-8'},
    {threat:'T-8', mitigation:'M-2'}, {threat:'T-8', mitigation:'M-3'},
    {threat:'T-9', mitigation:'M-8'}, {threat:'T-10',mitigation:'M-8'},
    {threat:'T-12',mitigation:'M-6'},
    {threat:'T-14',mitigation:'M-4'}, {threat:'T-15',mitigation:'M-4'},
    {threat:'T-16',mitigation:'M-14'},
  ];
  mapping.forEach(r => addMapping(r));

  document.getElementById('threshold').value = '0.2';
}

// ── Init ──────────────────────────────────────────────────────────────────
loadExample();
