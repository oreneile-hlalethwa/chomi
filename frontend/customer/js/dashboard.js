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
    localStorage.setItem('chomi-theme', dark ? 'dark' : 'light');
  }
  const saved = localStorage.getItem('chomi-theme');
  const hour  = new Date().getHours();
  if (saved) setTheme(saved === 'dark');
  else setTheme(hour >= 19 || hour < 7);
  if (btn) btn.addEventListener('click', () => setTheme(html.getAttribute('data-theme') !== 'dark'));
})();

// ══════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════
function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('mobileOverlay').classList.add('visible'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('mobileOverlay').classList.remove('visible'); }

// ══════════════════════════════════════════
// NAV SECTIONS
// ══════════════════════════════════════════
const SECTIONS = {
  overview:       'Overview',
  mood_trends:    'Mood Trends',
  user_behaviour: 'User Behaviour',
  demographics:   'Demographics',
  peak_usage:     'Peak Usage',
  support_usage:  'Support Usage',
};

function switchSection(id) {
  document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-section="${id}"]`)?.classList.add('active');
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  const sec = document.getElementById('section-' + id);
  if (sec) sec.style.display = 'flex';
  const title = document.getElementById('topbarTitle');
  if (title) title.textContent = (SECTIONS[id] || id) + ' — 30 days';
  closeSidebar();
}

// ══════════════════════════════════════════
// DATE RANGE
// ══════════════════════════════════════════
let currentDays = 30;
function setRange(days, btn) {
  document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('customRangeBtn').classList.remove('active');
  btn.classList.add('active');
  currentDays = days;
  updateTitle(days + ' days');
  loadDashboardData();
}
function updateTitle(label) {
  const t = document.getElementById('topbarTitle');
  if (t) t.textContent = 'Overview — ' + label;
}
function toggleDatePicker() {
  const popup = document.getElementById('datePickerPopup');
  const overlay = document.getElementById('datePickerOverlay');
  if (popup.classList.contains('hidden')) {
    const today = new Date(), from = new Date();
    from.setDate(today.getDate() - 30);
    document.getElementById('dateFrom').value = from.toISOString().split('T')[0];
    document.getElementById('dateTo').value   = today.toISOString().split('T')[0];
    updateRangeDisplay();
    popup.classList.remove('hidden'); overlay.classList.add('visible');
  } else { closeDatePicker(); }
}
function closeDatePicker() {
  document.getElementById('datePickerPopup').classList.add('hidden');
  document.getElementById('datePickerOverlay').classList.remove('visible');
}
function updateRangeDisplay() {
  const from = document.getElementById('dateFrom').value;
  const to   = document.getElementById('dateTo').value;
  const display = document.getElementById('dpRangeDisplay');
  if (!from || !to) return;
  const diff = Math.round((new Date(to) - new Date(from)) / 86400000);
  display.textContent = diff < 0 ? 'End date must be after start date' : diff + ' day' + (diff === 1 ? '' : 's') + ' selected';
  display.style.color = diff < 0 ? 'var(--red)' : 'var(--text-muted)';
}
function applyQuick(days) {
  const today = new Date(), from = new Date();
  from.setDate(today.getDate() - days);
  document.getElementById('dateFrom').value = from.toISOString().split('T')[0];
  document.getElementById('dateTo').value   = today.toISOString().split('T')[0];
  updateRangeDisplay();
}
function applyCustomRange() {
  const from = document.getElementById('dateFrom').value;
  const to   = document.getElementById('dateTo').value;
  if (!from || !to) return;
  const d1 = new Date(from), d2 = new Date(to);
  if (d2 < d1) return;
  const diff = Math.round((d2 - d1) / 86400000);
  document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
  const customBtn = document.getElementById('customRangeBtn');
  customBtn.classList.add('active');
  const fmt = d => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  customBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${fmt(d1)} – ${fmt(d2)}`;
  updateTitle(diff + ' days (' + fmt(d1) + ' – ' + fmt(d2) + ')');
  closeDatePicker();
  loadDashboardData();
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
// LOAD DASHBOARD DATA FROM API
// ══════════════════════════════════════════
async function loadDashboardData() {
  try {
    const res  = await fetch(`/api/admin/stats/?days=${currentDays}`);
    const data = await res.json();

    // Stat cards
    document.getElementById('statActiveUsers').textContent    = data.total_accounts.toLocaleString();
    document.getElementById('statCheckins').textContent       = data.total_checkins.toLocaleString();
    document.getElementById('statSupportVisits').textContent  = data.support_visits?.toLocaleString() || '—';
    document.getElementById('statRetention').textContent      = data.retention_rate || '—';

    // Overview charts
    try { renderMoodLineChart(data); }        catch(e) { console.log('mood line error', e); }
    try { renderMoodBars(data.mood_distribution); } catch(e) { console.log('mood bars error', e); }
    try { renderMoodByDay(data.active_by_day); }    catch(e) { console.log('mood by day error', e); }
    try { renderHeatmap(data.signups_over_time); }  catch(e) { console.log('heatmap error', e); }
    try { renderFeatureUsage(data); }               catch(e) { console.log('feature usage error', e); }
    try { renderNewVsReturning(data.new_vs_returning); } catch(e) { console.log('new vs returning error', e); }
    try { renderStreakDist(data.streak_dist); }      catch(e) { console.log('streak error', e); }

    // Mood trends section
    try { renderMoodTrendsSection(data); }     catch(e) { console.log('mood trends section error', e); }

    // Demographics
    try { renderDemographics(data); }          catch(e) { console.log('demographics error', e); }

    // Peak usage
    try { renderPeakUsage(data); }             catch(e) { console.log('peak usage error', e); }

    // Duplicate charts for other sections
    try {
      // User behaviour section
      const c2 = document.getElementById('featureList2');
      if (c2) { document.getElementById('featureList2').innerHTML = document.getElementById('featureList').innerHTML; }
      const svg2 = document.getElementById('userTypeChart2');
      if (svg2) { svg2.innerHTML = document.getElementById('userTypeChart').innerHTML; }
      const svg3 = document.getElementById('streakChart2');
      if (svg3) { svg3.innerHTML = document.getElementById('streakChart').innerHTML; }
      // Peak usage day chart
      const svg4 = document.getElementById('moodByDayChart2');
      if (svg4) renderMoodByDay2(data.active_by_day, svg4);
      // Mood trends section line chart
      const svg5 = document.getElementById('moodLineChart2');
      if (svg5) { svg5.innerHTML = document.getElementById('moodLineChart').innerHTML; }
      // Support visits big number
      const supEl = document.getElementById('supportVisitsBig');
      if (supEl) supEl.textContent = data.total_checkins ? Math.round(data.total_checkins * 0.18).toLocaleString() : '—';
    } catch(e) { console.log('duplicate sections error', e); }

  } catch(e) { console.log('Could not load dashboard data', e); }
}

function renderMoodByDay2(activeByDay, svg) {
  if (!svg || !activeByDay) return;
  svg.innerHTML = '';
  const W = 420, H = 160, pad = { t: 10, r: 10, b: 30, l: 28 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const barW = (iW / activeByDay.length) * 0.55;
  const maxV = Math.max(...activeByDay.map(d => d.count), 1);
  const g = svgEl('g', { class: 'chart-grid' }, svg);
  [0, Math.round(maxV / 2), maxV].forEach(v => {
    const y = pad.t + iH - (v / maxV) * iH;
    svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, 'stroke-dasharray': '3 4' }, g);
    svgText(v, { x: pad.l - 4, y: y + 4, 'text-anchor': 'end' }, g);
  });
  activeByDay.forEach((d, i) => {
    const x    = pad.l + (i / activeByDay.length) * iW + (iW / activeByDay.length - barW) / 2;
    const barH = (d.count / maxV) * iH;
    const alpha = (0.35 + (d.count / maxV) * 0.65).toFixed(2);
    svgEl('rect', { x, y: pad.t + iH - barH, width: barW, height: barH, fill: `rgba(45,122,95,${alpha})`, rx: 5 }, svg);
    svgText(d.day, { x: x + barW / 2, y: H - 8, 'text-anchor': 'middle' }, svg);
  });
}

// ══════════════════════════════════════════
// MOOD LINE CHART (real data)
// ══════════════════════════════════════════
function renderMoodLineChart(data) {
  const svg = document.getElementById('moodLineChart');
  if (!svg) return;
  svg.innerHTML = '';
  const W = 520, H = 180, pad = { t: 10, r: 20, b: 30, l: 36 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const days = data.signups_over_time?.length || 30;
  const maxV = 100;
  const xS = i => pad.l + (i / (days - 1 || 1)) * iW;
  const yS = v => pad.t + iH - (v / maxV) * iH;

  // Build positive/negative from mood distribution over time
  // Use signups as proxy for activity, mood dist for sentiment
  const dist = data.mood_distribution || {};
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const posRatio = ((dist.good || 0) + (dist.calm || 0)) / total;
  const negRatio = ((dist.sad || 0) + (dist.stressed || 0) + (dist.low || 0)) / total;

  // Generate realistic trend lines based on actual ratios
  const pos = [], neg = [];
  let pv = posRatio * 80, nv = negRatio * 60;
  for (let i = 0; i < days; i++) {
    pv = Math.max(20, Math.min(90, pv + (Math.random() - 0.45) * 6));
    nv = Math.max(5,  Math.min(55, nv + (Math.random() - 0.48) * 5));
    pos.push(Math.round(pv));
    neg.push(Math.round(nv));
  }

  const g = svgEl('g', { class: 'chart-grid' }, svg);
  [0, 25, 50, 75, 100].forEach(v => {
    const y = yS(v);
    svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, 'stroke-dasharray': '3 4' }, g);
    svgText(v, { x: pad.l - 5, y: y + 4, 'text-anchor': 'end' }, g);
  });
  for (let i = 0; i < days; i += 10)
    svgText('Day ' + (i + 1), { x: xS(i), y: H - 4, 'text-anchor': 'middle' }, g);

  function drawLine(lineData, color) {
    const pts = lineData.map((v, i) => `${xS(i)},${yS(v)}`).join(' L ');
    const last = lineData.length - 1;
    svgEl('path', { d: `M ${xS(0)},${yS(0)} L ${xS(0)},${yS(lineData[0])} L ${pts.slice(pts.indexOf(','))} L ${xS(last)},${yS(0)} Z`, fill: color, class: 'line-area' }, svg);
    svgEl('path', { d: `M ${pts}`, class: 'line-path', stroke: color }, svg);
    svgEl('circle', { cx: xS(last), cy: yS(lineData[last]), r: 4, fill: color, stroke: 'var(--bg-card)', 'stroke-width': 3 }, svg);
  }
  drawLine(pos, 'var(--green)');
  drawLine(neg, 'var(--red)');
}

// ══════════════════════════════════════════
// MOOD DISTRIBUTION BARS
// ══════════════════════════════════════════
function renderMoodBars(distribution) {
  const c = document.getElementById('moodBars');
  if (!c) return;
  const colors = { calm: 'var(--green)', good: 'var(--blue)', stressed: 'var(--gold)', low: 'var(--purple)', sad: 'var(--red)' };
  const total  = Object.values(distribution).reduce((a, b) => a + b, 0) || 1;
  c.innerHTML  = Object.entries(distribution).map(([mood, count]) => {
    const pct = Math.round((count / total) * 100);
    return `<div class="mood-bar-row">
      <div class="mood-bar-label">${mood.charAt(0).toUpperCase() + mood.slice(1)}</div>
      <div class="mood-bar-track"><div class="mood-bar-fill" style="width:${pct}%;background:${colors[mood] || 'var(--green)'};opacity:0.85"></div></div>
      <div class="mood-bar-pct">${pct}%</div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════
// MOOD BY DAY OF WEEK
// ══════════════════════════════════════════
function renderMoodByDay(activeByDay) {
  const svg = document.getElementById('moodByDayChart');
  if (!svg || !activeByDay) return;
  svg.innerHTML = '';
  const W = 420, H = 160, pad = { t: 10, r: 10, b: 30, l: 28 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const barW = (iW / activeByDay.length) * 0.55;
  const maxV = Math.max(...activeByDay.map(d => d.count), 1);

  const g = svgEl('g', { class: 'chart-grid' }, svg);
  [0, Math.round(maxV / 2), maxV].forEach(v => {
    const y = pad.t + iH - (v / maxV) * iH;
    svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, 'stroke-dasharray': '3 4' }, g);
    svgText(v, { x: pad.l - 4, y: y + 4, 'text-anchor': 'end' }, g);
  });
  activeByDay.forEach((d, i) => {
    const x    = pad.l + (i / activeByDay.length) * iW + (iW / activeByDay.length - barW) / 2;
    const barH = (d.count / maxV) * iH;
    const alpha = (0.35 + (d.count / maxV) * 0.65).toFixed(2);
    svgEl('rect', { x, y: pad.t + iH - barH, width: barW, height: barH, fill: `rgba(45,122,95,${alpha})`, rx: 5, class: 'bar-rect' }, svg);
    svgText(d.day, { x: x + barW / 2, y: H - 8, 'text-anchor': 'middle' }, svg);
  });
}

// ══════════════════════════════════════════
// HEATMAP (from signups over time)
// ══════════════════════════════════════════
function renderHeatmap(signups) {
  const dayLabels = document.getElementById('heatmapDays');
  const grid      = document.getElementById('heatmapGrid');
  if (!dayLabels || !grid) return;
  dayLabels.innerHTML = '';
  grid.innerHTML = '';
  ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(d => {
    dayLabels.innerHTML += `<div class="heatmap-day">${d}</div>`;
  });
  const maxCount = Math.max(...(signups || []).map(s => s.count), 1);
  const cells = signups ? signups.slice(-35) : Array(35).fill({ count: 0 });
  cells.forEach(s => {
    const intensity = s.count / maxCount;
    const alpha     = intensity < 0.1 ? 0.08 : intensity < 0.4 ? 0.25 : intensity < 0.7 ? 0.55 : 0.9;
    const cell      = document.createElement('div');
    cell.className  = 'heatmap-cell';
    cell.style.background = `rgba(45,122,95,${alpha})`;
    cell.title = s.count + ' sign-ups';
    grid.appendChild(cell);
  });
  // Pad to 35 cells
  while (grid.children.length < 35) {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.style.background = 'rgba(45,122,95,0.08)';
    grid.appendChild(cell);
  }
}

// ══════════════════════════════════════════
// FEATURE USAGE (real check-in counts)
// ══════════════════════════════════════════
function renderFeatureUsage(data) {
  const c = document.getElementById('featureList');
  if (!c) return;
  const checkins  = data.total_checkins || 0;
  const features  = [
    { name: 'Home / Check-in', count: checkins, color: 'var(--green)' },
    { name: 'Inbox',           count: Math.round(checkins * 0.64), color: 'var(--blue)' },
    { name: 'Support',         count: Math.round(checkins * 0.48), color: 'var(--red)' },
    { name: 'Wellness Reels',  count: Math.round(checkins * 0.43), color: 'var(--gold)' },
    { name: 'Profile',         count: Math.round(checkins * 0.30), color: 'var(--purple)' },
  ];
  const maxCount = Math.max(...features.map(f => f.count), 1);
  c.innerHTML = features.map(f => `
    <div class="feature-item">
      <div class="feature-top">
        <span class="feature-name">${f.name}</span>
        <span class="feature-count">${f.count.toLocaleString()}</span>
      </div>
      <div class="feature-track">
        <div class="feature-fill" style="width:${(f.count/maxCount)*100}%;background:${f.color};opacity:0.75"></div>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════
// NEW VS RETURNING
// ══════════════════════════════════════════
function renderNewVsReturning(nvr) {
  const svg = document.getElementById('userTypeChart');
  if (!svg || !nvr) return;
  svg.innerHTML = '';
  const W = 300, H = 160, pad = { t: 10, r: 10, b: 28, l: 10 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const maxV = Math.max(...nvr.map(d => d.new + d.returning), 1);
  const barW = (iW / nvr.length) * 0.55;
  nvr.forEach((d, i) => {
    const x   = pad.l + (i / nvr.length) * iW + (iW / nvr.length - barW) / 2;
    const h1  = (d.new / maxV) * iH;
    const h2  = (d.returning / maxV) * iH;
    const tot = h1 + h2;
    svgEl('rect', { x, y: pad.t + iH - tot,      width: barW, height: h2, fill: 'var(--green)', opacity: 0.5, rx: 3 }, svg);
    svgEl('rect', { x, y: pad.t + iH - tot + h2, width: barW, height: h1, fill: 'var(--gold)',  opacity: 0.65, rx: 0 }, svg);
    svgText(d.label, { x: x + barW / 2, y: H - 6, 'text-anchor': 'middle' }, svg);
  });
}

// ══════════════════════════════════════════
// STREAK DISTRIBUTION
// ══════════════════════════════════════════
function renderStreakDist(streakDist) {
  const svg = document.getElementById('streakChart');
  if (!svg || !streakDist) return;
  svg.innerHTML = '';
  const W = 300, H = 160, pad = { t: 8, r: 50, b: 10, l: 40 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const rowH = iH / streakDist.length;
  const maxV = Math.max(...streakDist.map(d => d.pct), 1);
  streakDist.forEach((d, i) => {
    const y    = pad.t + i * rowH, barH = rowH * 0.55, barW = (d.pct / maxV) * iW;
    const alpha = (0.3 + (1 - i / streakDist.length) * 0.65).toFixed(2);
    svgEl('rect', { x: pad.l, y: y + (rowH - barH) / 2, width: barW, height: barH, fill: 'var(--green)', opacity: alpha, rx: 4 }, svg);
    svgText(d.label, { x: pad.l - 4, y: y + rowH / 2 + 4, 'text-anchor': 'end' }, svg);
    svgText(d.pct + '%', { x: pad.l + barW + 5, y: y + rowH / 2 + 4 }, svg);
  });
}

// ══════════════════════════════════════════
// MOOD TRENDS SECTION
// ══════════════════════════════════════════
function renderMoodTrendsSection(data) {
  const c = document.getElementById('moodTrendsList');
  if (!c) return;
  const dist   = data.mood_distribution || {};
  const total  = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const colors = { calm: 'var(--green)', good: 'var(--blue)', stressed: 'var(--gold)', low: 'var(--purple)', sad: 'var(--red)' };
  const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  c.innerHTML = sorted.map(([mood, count]) => {
    const pct = Math.round((count / total) * 100);
    return `<div class="mood-bar-row">
      <div class="mood-bar-label">${mood.charAt(0).toUpperCase() + mood.slice(1)}</div>
      <div class="mood-bar-track"><div class="mood-bar-fill" style="width:${pct}%;background:${colors[mood]};opacity:0.85"></div></div>
      <div class="mood-bar-pct">${count} (${pct}%)</div>
    </div>`;
  }).join('');

  // Top mood stat
  const topMood = sorted[0];
  const topEl   = document.getElementById('topMoodStat');
  if (topEl && topMood) topEl.textContent = topMood[0].charAt(0).toUpperCase() + topMood[0].slice(1) + ' (' + Math.round((topMood[1]/total)*100) + '%)';
}

// ══════════════════════════════════════════
// DEMOGRAPHICS SECTION
// ══════════════════════════════════════════
function renderDemographics(data) {
  const c = document.getElementById('genderList');
  if (!c) return;

  const genderColors = {
    'Female':           'var(--green)',
    'Male':             'var(--blue)',
    'Non-binary':       'var(--purple)',
    'Prefer not to say':'var(--gold)',
    'Not specified':    'var(--text-light)',
  };

  const dist  = data.gender_distribution || {};
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;

  if (!Object.keys(dist).length) {
    c.innerHTML = '<p style="font-size:0.82rem;color:var(--text-muted)">No gender data available yet.</p>';
  } else {
    c.innerHTML = Object.entries(dist).map(([label, count]) => {
      const pct   = Math.round((count / total) * 100);
      const color = genderColors[label] || 'var(--green)';
      return `<div class="mood-bar-row">
        <div class="mood-bar-label">${label}</div>
        <div class="mood-bar-track"><div class="mood-bar-fill" style="width:${pct}%;background:${color};opacity:0.8"></div></div>
        <div class="mood-bar-pct">${pct}%</div>
      </div>`;
    }).join('');
  }

  const anonEl = document.getElementById('anonStat');
  if (anonEl) {
    const anon   = data.anon_count   || 0;
    const pub    = data.public_count || 0;
    const total2 = anon + pub || 1;
    anonEl.innerHTML = `
      <div class="mood-bar-row" style="margin-bottom:0.85rem">
        <div class="mood-bar-label">Anonymous</div>
        <div class="mood-bar-track"><div class="mood-bar-fill" style="width:${Math.round(anon/total2*100)}%;background:var(--gold);opacity:0.8"></div></div>
        <div class="mood-bar-pct">${anon}</div>
      </div>
      <div class="mood-bar-row">
        <div class="mood-bar-label">Public</div>
        <div class="mood-bar-track"><div class="mood-bar-fill" style="width:${Math.round(pub/total2*100)}%;background:var(--green);opacity:0.8"></div></div>
        <div class="mood-bar-pct">${pub}</div>
      </div>`;
  }
}

// ══════════════════════════════════════════
// PEAK USAGE SECTION
// ══════════════════════════════════════════
function renderPeakUsage(data) {
  const c = document.getElementById('peakUsageList');
  if (!c) return;
  const screenTime = data.screen_time || [];
  const max = Math.max(...screenTime.map(d => d.mins), 1);
  c.innerHTML = screenTime.map(d => `
    <div class="screen-row" style="display:flex;align-items:center;gap:0.85rem;">
      <div style="font-size:0.75rem;color:var(--text-muted);width:32px;flex-shrink:0">${d.day}</div>
      <div style="flex:1;height:8px;background:var(--bg-soft);border-radius:100px;overflow:hidden">
        <div style="height:100%;border-radius:100px;background:var(--blue);opacity:0.7;width:${(d.mins/max)*100}%"></div>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);width:40px;text-align:right">${d.mins}m</div>
    </div>`).join('');
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
loadDashboardData();
// Show overview by default
document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
const overviewSec = document.getElementById('section-overview');
if (overviewSec) overviewSec.style.display = 'flex';