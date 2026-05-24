// ══════════════════════════════════════════
// THEME TOGGLE
// ══════════════════════════════════════════
(function () {
  const btn  = document.getElementById('themeToggle');
  const sun  = document.getElementById('sunIcon');
  const moon = document.getElementById('moonIcon');
  const html = document.documentElement;

  function setTheme(dark) {
    html.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (sun)  sun.style.display  = dark ? 'none' : '';
    if (moon) moon.style.display = dark ? '' : 'none';
    localStorage.setItem('chomi-dash-theme', dark ? 'dark' : 'light');
  }

  const saved = localStorage.getItem('chomi-dash-theme');
  const hour  = new Date().getHours();
  if (saved) { setTheme(saved === 'dark'); }
  else { setTheme(hour >= 19 || hour < 7); }

  if (btn) btn.addEventListener('click', () => {
    setTheme(html.getAttribute('data-theme') !== 'dark');
  });
})();

// ══════════════════════════════════════════
// MOBILE SIDEBAR DRAWER
// ══════════════════════════════════════════
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('mobileOverlay').classList.add('visible');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobileOverlay').classList.remove('visible');
}

// ══════════════════════════════════════════
// DATE RANGE BUTTONS
// ══════════════════════════════════════════
function setRange(days, btn) {
  document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('customRangeBtn').classList.remove('active');
  btn.classList.add('active');
  updateTitle(days + ' days');
}

function updateTitle(label) {
  const t = document.getElementById('topbarTitle');
  if (t) t.textContent = 'Overview — ' + label;
}

// ══════════════════════════════════════════
// CUSTOM DATE PICKER
// ══════════════════════════════════════════
function toggleDatePicker() {
  const popup   = document.getElementById('datePickerPopup');
  const overlay = document.getElementById('datePickerOverlay');
  if (popup.classList.contains('hidden')) {
    const today = new Date();
    const from  = new Date(); from.setDate(today.getDate() - 30);
    document.getElementById('dateFrom').value = from.toISOString().split('T')[0];
    document.getElementById('dateTo').value   = today.toISOString().split('T')[0];
    updateRangeDisplay();
    popup.classList.remove('hidden');
    overlay.classList.add('visible');
  } else {
    closeDatePicker();
  }
}

function closeDatePicker() {
  document.getElementById('datePickerPopup').classList.add('hidden');
  document.getElementById('datePickerOverlay').classList.remove('visible');
}

function updateRangeDisplay() {
  const from    = document.getElementById('dateFrom').value;
  const to      = document.getElementById('dateTo').value;
  const display = document.getElementById('dpRangeDisplay');
  if (!from || !to) return;
  const diff = Math.round((new Date(to) - new Date(from)) / 86400000);
  if (diff < 0) {
    display.textContent  = 'End date must be after start date';
    display.style.color  = 'var(--red)';
  } else {
    display.textContent = diff + ' day' + (diff === 1 ? '' : 's') + ' selected';
    display.style.color = 'var(--text-muted)';
  }
}

function applyQuick(days) {
  const today = new Date();
  const from  = new Date(); from.setDate(today.getDate() - days);
  document.getElementById('dateFrom').value = from.toISOString().split('T')[0];
  document.getElementById('dateTo').value   = today.toISOString().split('T')[0];
  updateRangeDisplay();
}

function applyCustomRange() {
  const from = document.getElementById('dateFrom').value;
  const to   = document.getElementById('dateTo').value;
  if (!from || !to) return;
  const d1   = new Date(from), d2 = new Date(to);
  if (d2 < d1) return;
  const diff = Math.round((d2 - d1) / 86400000);
  document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
  const customBtn = document.getElementById('customRangeBtn');
  customBtn.classList.add('active');
  const fmt = d => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  customBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${fmt(d1)} – ${fmt(d2)}`;
  updateTitle(diff + ' days (' + fmt(d1) + ' – ' + fmt(d2) + ')');
  closeDatePicker();
}

document.getElementById('dateFrom')?.addEventListener('change', updateRangeDisplay);
document.getElementById('dateTo')?.addEventListener('change', updateRangeDisplay);

// ══════════════════════════════════════════
// SVG HELPERS
// ══════════════════════════════════════════
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
  if (parent) parent.appendChild(e);
  return e;
}
function svgText(content, attrs, parent) {
  const t = svgEl('text', attrs, parent);
  t.textContent = content;
  t.style.fontFamily = 'DM Sans, sans-serif';
  return t;
}

// ══════════════════════════════════════════
// MOOD LINE CHART
// ══════════════════════════════════════════
(function () {
  const svg = document.getElementById('moodLineChart');
  if (!svg) return;
  const W = 520, H = 180, pad = { t: 10, r: 20, b: 30, l: 36 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const days = 30;

  const pos = [], neg = [];
  let pv = 58, nv = 30;
  for (let i = 0; i < days; i++) {
    pv = Math.max(30, Math.min(85, pv + (Math.random() - 0.42) * 8));
    nv = Math.max(10, Math.min(50, nv + (Math.random() - 0.48) * 6));
    pos.push(Math.round(pv));
    neg.push(Math.round(nv));
  }

  const maxV = 100;
  const xS = i => pad.l + (i / (days - 1)) * iW;
  const yS = v => pad.t + iH - (v / maxV) * iH;

  const g = svgEl('g', { class: 'chart-grid' }, svg);
  [0, 25, 50, 75, 100].forEach(v => {
    const y = yS(v);
    svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, 'stroke-dasharray': '3 4' }, g);
    svgText(v, { x: pad.l - 5, y: y + 4, 'text-anchor': 'end' }, g);
  });
  for (let i = 0; i < days; i += 10) {
    svgText('Day ' + (i + 1), { x: xS(i), y: H - 4, 'text-anchor': 'middle' }, g);
  }

  function drawLine(data, color) {
    const pts = data.map((v, i) => `${xS(i)},${yS(v)}`).join(' L ');
    const last = data.length - 1;
    svgEl('path', {
      d: `M ${xS(0)},${yS(0)} L ${xS(0)},${yS(data[0])} L ${pts.slice(pts.indexOf(','))} L ${xS(last)},${yS(0)} Z`,
      fill: color, class: 'line-area'
    }, svg);
    svgEl('path', { d: `M ${pts}`, class: 'line-path', stroke: color }, svg);
    svgEl('circle', { cx: xS(last), cy: yS(data[last]), r: 4, fill: color, stroke: 'var(--bg-card)', 'stroke-width': 3 }, svg);
  }

  drawLine(pos, 'var(--green)');
  drawLine(neg, 'var(--red)');
})();

// ══════════════════════════════════════════
// MOOD DISTRIBUTION BARS
// ══════════════════════════════════════════
(function () {
  const moods = [
    { label: 'Calm',     pct: 32, color: 'var(--green)' },
    { label: 'Good',     pct: 28, color: 'var(--blue)' },
    { label: 'Stressed', pct: 18, color: 'var(--gold)' },
    { label: 'Low',      pct: 13, color: 'var(--purple)' },
    { label: 'Sad',      pct: 9,  color: 'var(--red)' },
  ];
  const c = document.getElementById('moodBars');
  if (!c) return;
  moods.forEach(m => {
    c.innerHTML += `<div class="mood-bar-row">
      <div class="mood-bar-label">${m.label}</div>
      <div class="mood-bar-track"><div class="mood-bar-fill" style="width:${m.pct}%;background:${m.color};opacity:0.85"></div></div>
      <div class="mood-bar-pct">${m.pct}%</div>
    </div>`;
  });
})();

// ══════════════════════════════════════════
// MOOD BY DAY OF WEEK
// ══════════════════════════════════════════
(function () {
  const svg = document.getElementById('moodByDayChart');
  if (!svg) return;
  const days   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const scores = [52, 48, 55, 61, 67, 72, 58];
  const W = 420, H = 160, pad = { t: 10, r: 10, b: 30, l: 28 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const barW = (iW / days.length) * 0.55;
  const maxV = 80;

  const g = svgEl('g', { class: 'chart-grid' }, svg);
  [0, 40, 80].forEach(v => {
    const y = pad.t + iH - (v / maxV) * iH;
    svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, 'stroke-dasharray': '3 4' }, g);
    svgText(v, { x: pad.l - 4, y: y + 4, 'text-anchor': 'end' }, g);
  });

  days.forEach((d, i) => {
    const x    = pad.l + (i / days.length) * iW + (iW / days.length - barW) / 2;
    const barH = (scores[i] / maxV) * iH;
    const y    = pad.t + iH - barH;
    const alpha = (0.35 + (scores[i] / maxV) * 0.65).toFixed(2);
    svgEl('rect', { x, y, width: barW, height: barH, fill: `rgba(45,122,95,${alpha})`, rx: 5, class: 'bar-rect' }, svg);
    svgText(d, { x: x + barW / 2, y: H - 8, 'text-anchor': 'middle' }, svg);
  });
})();

// ══════════════════════════════════════════
// CHECK-IN HEATMAP
// ══════════════════════════════════════════
(function () {
  const dayLabels = document.getElementById('heatmapDays');
  const grid = document.getElementById('heatmapGrid');
  if (!dayLabels || !grid) return;
  ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(d => {
    dayLabels.innerHTML += `<div class="heatmap-day">${d}</div>`;
  });
  for (let i = 0; i < 35; i++) {
    const intensity = Math.random();
    const alpha     = intensity < 0.15 ? 0.08 : intensity < 0.4 ? 0.25 : intensity < 0.7 ? 0.55 : 0.9;
    const cell      = document.createElement('div');
    cell.className  = 'heatmap-cell';
    cell.style.background = `rgba(45,122,95,${alpha})`;
    cell.title = Math.round(intensity * 120) + ' check-ins';
    grid.appendChild(cell);
  }
})();

// ══════════════════════════════════════════
// FEATURE USAGE
// ══════════════════════════════════════════
(function () {
  const c = document.getElementById('featureList');
  if (!c) return;
  const features = [
    { name: 'Home / Check-in',  count: '12,841', pct: 100, color: 'var(--green)' },
    { name: 'Inbox',            count: '8,203',  pct: 64,  color: 'var(--blue)' },
    { name: 'Support',          count: '6,102',  pct: 48,  color: 'var(--red)' },
    { name: 'Wellness Reels',   count: '5,490',  pct: 43,  color: 'var(--gold)' },
    { name: 'Profile',          count: '3,814',  pct: 30,  color: 'var(--purple)' },
  ];
  features.forEach(f => {
    c.innerHTML += `<div class="feature-item">
      <div class="feature-top">
        <span class="feature-name">${f.name}</span>
        <span class="feature-count">${f.count}</span>
      </div>
      <div class="feature-track">
        <div class="feature-fill" style="width:${f.pct}%;background:${f.color};opacity:0.75"></div>
      </div>
    </div>`;
  });
})();

// ══════════════════════════════════════════
// NEW vs RETURNING (stacked bars)
// ══════════════════════════════════════════
(function () {
  const svg = document.getElementById('userTypeChart');
  if (!svg) return;
  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const newU   = [320, 410, 480, 390, 520, 610];
  const retU   = [180, 290, 340, 410, 480, 520];
  const W = 300, H = 160, pad = { t: 10, r: 10, b: 28, l: 10 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const barW = (iW / months.length) * 0.55, maxV = 1200;

  months.forEach((m, i) => {
    const x  = pad.l + (i / months.length) * iW + (iW / months.length - barW) / 2;
    const h1 = (newU[i] / maxV) * iH;
    const h2 = (retU[i] / maxV) * iH;
    const tot = h1 + h2;
    svgEl('rect', { x, y: pad.t + iH - tot,      width: barW, height: h2, fill: 'var(--green)', opacity: 0.5, rx: 3 }, svg);
    svgEl('rect', { x, y: pad.t + iH - tot + h2, width: barW, height: h1, fill: 'var(--gold)',  opacity: 0.65, rx: 0 }, svg);
    svgText(m, { x: x + barW / 2, y: H - 6, 'text-anchor': 'middle' }, svg);
  });
})();

// ══════════════════════════════════════════
// STREAK DISTRIBUTION
// ══════════════════════════════════════════
(function () {
  const svg = document.getElementById('streakChart');
  if (!svg) return;
  const labels = ['1 day', '2–3', '4–7', '8–14', '15–30', '30+'];
  const vals   = [28, 22, 19, 14, 11, 6];
  const W = 300, H = 160, pad = { t: 8, r: 50, b: 10, l: 40 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const rowH = iH / labels.length, maxV = 30;

  labels.forEach((lbl, i) => {
    const y    = pad.t + i * rowH;
    const barH = rowH * 0.55;
    const barW = (vals[i] / maxV) * iW;
    const alpha = (0.3 + (1 - i / labels.length) * 0.65).toFixed(2);
    svgEl('rect', { x: pad.l, y: y + (rowH - barH) / 2, width: barW, height: barH, fill: 'var(--green)', opacity: alpha, rx: 4 }, svg);
    svgText(lbl, { x: pad.l - 4, y: y + rowH / 2 + 4, 'text-anchor': 'end' }, svg);
    svgText(vals[i] + '%', { x: pad.l + barW + 5, y: y + rowH / 2 + 4 }, svg);
  });
})();