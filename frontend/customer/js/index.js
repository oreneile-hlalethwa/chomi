// ===== ADMIN PORTAL =====

// ── SECTION SWITCHING ──
function switchSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  btn.classList.add('active');
  const titles = { stats: 'Platform Stats', users: 'Users' };
  document.getElementById('topbarTitle').textContent = titles[id] || id;
  document.getElementById('dateRange').style.display = id === 'stats' ? 'flex' : 'none';
  closeSidebar();
}

let currentDays = 30;
function setRange(days, btn) {
  document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentDays = days;
  loadStats();
}

function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('mobileOverlay').classList.add('visible'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('mobileOverlay').classList.remove('visible'); }

// ── THEME ──
(function() {
  const btn  = document.getElementById('themeToggle');
  const sun  = document.getElementById('sunIcon');
  const moon = document.getElementById('moonIcon');
  const html = document.documentElement;
  function setTheme(dark) {
    html.setAttribute('data-theme', dark ? 'dark' : 'light');
    sun.style.display  = dark ? 'none' : '';
    moon.style.display = dark ? '' : 'none';
    localStorage.setItem('chomi-theme', dark ? 'dark' : 'light');
  }
  const saved = localStorage.getItem('chomi-theme');
  const hour  = new Date().getHours();
  setTheme(saved ? saved === 'dark' : hour >= 19 || hour < 7);
  btn.addEventListener('click', () => setTheme(html.getAttribute('data-theme') !== 'dark'));
})();

// ── SVG HELPERS ──
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs || {}).forEach(([k,v]) => e.setAttribute(k,v));
  if (parent) parent.appendChild(e);
  return e;
}
function svgText(content, attrs, parent) {
  const t = svgEl('text', attrs, parent);
  t.textContent = content;
  t.style.fontFamily = 'DM Sans, sans-serif';
  return t;
}

// ── LINE CHART HELPER ──
function renderLineChart(svgEl2, data, color, W, H, pad, labelKey, valueKey, maxOverride) {
  svgEl2.innerHTML = '';
  if (!data || !data.length) return;
  const iW   = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const vals = data.map(d => d[valueKey]);
  const maxV = maxOverride || Math.max(...vals, 1);
  const xS   = i => pad.l + (i / (data.length - 1 || 1)) * iW;
  const yS   = v => pad.t + iH - (v / maxV) * iH;

  const g = svgEl('g', { class: 'chart-grid' }, svgEl2);
  [0, Math.round(maxV / 2), maxV].forEach(v => {
    const y = yS(v);
    svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, 'stroke-dasharray': '3 4' }, g);
    svgText(v, { x: pad.l - 5, y: y + 4, 'text-anchor': 'end' }, g);
  });
  data.forEach((d, i) => {
    if (i % Math.ceil(data.length / 5) === 0)
      svgText(d[labelKey], { x: xS(i), y: H - 4, 'text-anchor': 'middle' }, g);
  });

  if (data.length > 1) {
    const pts  = vals.map((v, i) => `${xS(i)},${yS(v)}`).join(' L ');
    const last = data.length - 1;
    svgEl('path', { d: `M ${xS(0)},${yS(0)} L ${xS(0)},${yS(vals[0])} L ${pts.slice(pts.indexOf(','))} L ${xS(last)},${yS(0)} Z`, fill: color, class: 'line-area' }, svgEl2);
    svgEl('path', { d: `M ${pts}`, class: 'line-path', stroke: color }, svgEl2);
    svgEl('circle', { cx: xS(last), cy: yS(vals[last]), r: 4, fill: color, stroke: 'var(--bg-card)', 'stroke-width': 3 }, svgEl2);
  }
}

// ── BAR CHART HELPER ──
function renderBarChart(svg, data, labelKey, valueKey, W, H, pad, colorFn) {
  svg.innerHTML = '';
  if (!data || !data.length) return;
  const iW   = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const maxV = Math.max(...data.map(d => d[valueKey]), 1);
  const barW = (iW / data.length) * 0.55;

  const g = svgEl('g', { class: 'chart-grid' }, svg);
  [0, Math.round(maxV / 2), maxV].forEach(v => {
    const y = pad.t + iH - (v / maxV) * iH;
    svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, 'stroke-dasharray': '3 4' }, g);
    svgText(v >= 1000 ? `${(v/1000).toFixed(1)}k` : v, { x: pad.l - 4, y: y + 4, 'text-anchor': 'end' }, g);
  });

  data.forEach((d, i) => {
    const x    = pad.l + (i / data.length) * iW + (iW / data.length - barW) / 2;
    const bH   = (d[valueKey] / maxV) * iH;
    const fill = colorFn ? colorFn(i, d) : `rgba(45,122,95,${(0.35 + (d[valueKey]/maxV)*0.65).toFixed(2)})`;
    svgEl('rect', { x, y: pad.t + iH - bH, width: barW, height: bH, fill, rx: 5 }, svg);
    svgText(d[labelKey], { x: x + barW / 2, y: H - 8, 'text-anchor': 'middle' }, svg);
  });
}

// ── LOAD STATS ──
async function loadStats() {
  try {
    const res  = await fetch(`/api/admin/stats/?days=${currentDays}`);
    const data = await res.json();

    document.getElementById('statTotalAccounts').textContent = data.total_accounts.toLocaleString();
    document.getElementById('statActiveUsers').textContent   = data.active_users.toLocaleString();
    document.getElementById('statTotalCheckins').textContent = data.total_checkins.toLocaleString();
    document.getElementById('statAvgSession').textContent    = data.avg_session_mins + 'm';

    // Real percentage changes
    function setChange(id, text, isUp) {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = 'stat-change ' + (isUp ? 'up' : 'down');
      el.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="${isUp ? '18 15 12 9 6 15' : '18 9 12 15 6 9'}"/></svg>${text} vs prev period`;
    }
    setChange('statAccountsChange', data.accounts_change, data.accounts_up);
    setChange('statActiveChange',   data.active_change,   data.active_up);
    setChange('statCheckinsChange', data.checkins_change, data.checkins_up);
    setChange('statSessionChange',  data.session_change,  data.session_up);

    // Mood distribution bars
    try {
      const c      = document.getElementById('moodBars');
      const colors = { calm:'var(--green)', good:'var(--blue)', stressed:'var(--gold)', low:'var(--purple)', sad:'var(--red)' };
      const total  = Object.values(data.mood_distribution).reduce((a,b) => a+b, 0) || 1;
      c.innerHTML  = Object.entries(data.mood_distribution).map(([mood, count]) => {
        const pct = Math.round((count/total)*100);
        return `<div class="mood-bar-row">
          <div class="mood-bar-label">${mood.charAt(0).toUpperCase()+mood.slice(1)}</div>
          <div class="mood-bar-track"><div class="mood-bar-fill" style="width:${pct}%;background:${colors[mood]||'var(--green)'};opacity:0.8"></div></div>
          <div class="mood-bar-pct">${pct}%</div>
        </div>`;
      }).join('');
    } catch(e) { console.log('mood bars error', e); }

    // Signups chart
    try {
      const svg = document.getElementById('signupsChart');
      renderLineChart(svg, data.signups_over_time, 'var(--green)', 520, 160, {t:10,r:20,b:30,l:36}, 'label', 'count');
    } catch(e) { console.log('signups chart error', e); }

    // Screen time bars
    try {
      const c   = document.getElementById('screenBars');
      const max = Math.max(...data.screen_time.map(d => d.mins), 1);
      c.innerHTML = data.screen_time.map(d => `
        <div class="screen-row">
          <div class="screen-day">${d.day}</div>
          <div class="screen-track"><div class="screen-fill" style="width:${(d.mins/max)*100}%"></div></div>
          <div class="screen-val">${d.mins}m</div>
        </div>`).join('');
    } catch(e) { console.log('screen time error', e); }

    // Active by day chart
    try {
      const svg = document.getElementById('activeByDayChart');
      renderBarChart(svg, data.active_by_day, 'day', 'count', 420, 160, {t:10,r:10,b:30,l:30}, null);
    } catch(e) { console.log('active by day error', e); }

    // New vs returning
    try {
      const svg = document.getElementById('newReturnChart');
      svg.innerHTML = '';
      const W=300, H=160, pad={t:10,r:10,b:28,l:10};
      const iW=W-pad.l-pad.r, iH=H-pad.t-pad.b;
      const maxV = Math.max(...data.new_vs_returning.map(d => d.new + d.returning), 1);
      const barW = (iW / data.new_vs_returning.length) * 0.55;
      data.new_vs_returning.forEach((d, i) => {
        const x   = pad.l + (i/data.new_vs_returning.length)*iW + (iW/data.new_vs_returning.length - barW)/2;
        const h1  = (d.new/maxV)*iH, h2=(d.returning/maxV)*iH, tot=h1+h2;
        svgEl('rect',{x,y:pad.t+iH-tot,width:barW,height:h2,fill:'var(--green)',opacity:0.5,rx:3},svg);
        svgEl('rect',{x,y:pad.t+iH-tot+h2,width:barW,height:h1,fill:'var(--gold)',opacity:0.65,rx:0},svg);
        svgText(d.label,{x:x+barW/2,y:H-6,'text-anchor':'middle'},svg);
      });
    } catch(e) { console.log('new vs returning error', e); }

    // Retention chart
    try {
      const svg = document.getElementById('retentionChart');
      renderLineChart(svg, data.retention, 'var(--blue)', 300, 160, {t:10,r:15,b:30,l:32}, 'label', 'rate', 100);
    } catch(e) { console.log('retention chart error', e); }

    // Streak distribution
    try {
      const svg  = document.getElementById('streakChart');
      svg.innerHTML = '';
      const W=300, H=160, pad={t:8,r:50,b:10,l:40};
      const iW=W-pad.l-pad.r, iH=H-pad.t-pad.b;
      const rowH = iH / data.streak_dist.length;
      const maxV = Math.max(...data.streak_dist.map(d => d.pct), 1);
      data.streak_dist.forEach((d, i) => {
        const y    = pad.t + i*rowH, barH=rowH*0.55, barW=(d.pct/maxV)*iW;
        const alpha= (0.3+(1-i/data.streak_dist.length)*0.65).toFixed(2);
        svgEl('rect',{x:pad.l,y:y+(rowH-barH)/2,width:barW,height:barH,fill:'var(--green)',opacity:alpha,rx:4},svg);
        svgText(d.label,{x:pad.l-4,y:y+rowH/2+4,'text-anchor':'end'},svg);
        svgText(d.pct+'%',{x:pad.l+barW+5,y:y+rowH/2+4},svg);
      });
    } catch(e) { console.log('streak chart error', e); }

  } catch(e) { console.log('Could not load stats', e); }
}

// ── USERS ──
const AVATARS_BG = ['#2d7a5f','#2980b9','#7b6ab0','#c0392b','#d4851a','#1a7a6e'];
let allUsers      = [];
let currentFilter = 'all';

function avatarBg(first, last) {
  return AVATARS_BG[(first.charCodeAt(0) + last.charCodeAt(0)) % AVATARS_BG.length];
}
function getCookie(name) {
  let value = `; ${document.cookie}`;
  let parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

async function loadUsers() {
  try {
    const res  = await fetch('/api/admin/users/');
    const data = await res.json();
    allUsers   = data.users || [];
    applyFilter();
  } catch(e) {
    const grid = document.getElementById('usersGrid');
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);font-size:0.88rem;">Could not load users.</div>';
  }
}

function renderUsers(list) {
  const grid = document.getElementById('usersGrid');
  if (!grid) return;
  document.getElementById('usersCount').textContent = `Showing ${list.length} user${list.length !== 1 ? 's' : ''}`;
  if (!list.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);font-size:0.88rem;">No users found</div>';
    return;
  }
  grid.innerHTML = list.map((u, i) => `
    <div class="user-card" style="animation-delay:${i*0.04}s">
      <div class="user-card-top">
        <div class="user-avatar" style="background:${avatarBg(u.first_name, u.last_name)}">
          ${u.initials}
          ${u.is_verified ? `<div class="verified-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>` : ''}
        </div>
        <div class="user-info">
          <div class="user-name">
            ${u.is_anonymous ? 'Anonymous' : u.first_name + ' ' + u.last_name}
            ${u.is_verified ? `<svg class="blue-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01" stroke="white" stroke-width="2.5"/></svg>` : ''}
          </div>
          <div class="user-email">${u.is_anonymous ? '••••@••••.com' : u.email}</div>
        </div>
      </div>
      <div class="user-meta">
        <span class="user-tag ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span>
        ${u.is_anonymous ? '<span class="user-tag anon">Anonymous</span>' : ''}
        <span style="font-size:0.65rem;color:var(--text-light);margin-left:auto">Joined ${u.date_joined}</span>
      </div>
      <div class="user-stats">
        <div class="user-stat"><div class="user-stat-val">${u.checkins}</div><div class="user-stat-lbl">Check-ins</div></div>
        <div class="user-stat"><div class="user-stat-val">${u.streak}</div><div class="user-stat-lbl">Streak</div></div>
        <div class="user-stat"><div class="user-stat-val">${u.last_active}</div><div class="user-stat-lbl">Last Active</div></div>
      </div>
      <div class="user-card-actions">
        <button class="verify-btn ${u.is_verified ? 'verified' : ''}" onclick="toggleVerify(${u.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          ${u.is_verified ? 'Verified' : 'Verify'}
        </button>
        <button class="view-btn">View Profile</button>
      </div>
    </div>`).join('');
}

async function toggleVerify(userId) {
  try {
    const res  = await fetch(`/api/admin/users/${userId}/verify/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCookie('csrftoken') },
    });
    const data = await res.json();
    const user = allUsers.find(u => u.id === userId);
    if (user) user.is_verified = data.is_verified;
    applyFilter();
  } catch(e) { console.log('Could not toggle verification'); }
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}
function filterUsers() { applyFilter(); }
function applyFilter() {
  const search = document.getElementById('userSearch').value.toLowerCase();
  const list   = allUsers.filter(u => {
    const name        = `${u.first_name} ${u.last_name}`.toLowerCase();
    const matchSearch = !search || name.includes(search) || u.email.toLowerCase().includes(search);
    const matchFilter =
      currentFilter === 'all'      ? true :
      currentFilter === 'active'   ? u.is_active :
      currentFilter === 'verified' ? u.is_verified :
      currentFilter === 'anon'     ? u.is_anonymous : true;
    return matchSearch && matchFilter;
  });
  renderUsers(list);
}

// ── INIT ──
loadStats();
loadUsers();