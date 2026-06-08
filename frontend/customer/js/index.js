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

// ── DATE RANGE ──
function setRange(days, btn) {
  document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── SIDEBAR ──
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
    localStorage.setItem('chomi-admin-theme', dark ? 'dark' : 'light');
  }
  const saved = localStorage.getItem('chomi-admin-theme');
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

// ── SIGNUPS LINE CHART ──
(function() {
  const svg = document.getElementById('signupsChart');
  if (!svg) return;
  const W = 520, H = 160, pad = { t:10, r:20, b:30, l:36 };
  const iW = W-pad.l-pad.r, iH = H-pad.t-pad.b;
  const days = 30;
  const data = Array.from({length:days}, () => Math.round(20 + Math.random()*120));
  const maxV = Math.max(...data);
  const xS = i => pad.l + (i/(days-1))*iW;
  const yS = v => pad.t + iH - (v/maxV)*iH;

  const g = svgEl('g', {class:'chart-grid'}, svg);
  [0, Math.round(maxV/2), maxV].forEach(v => {
    const y = yS(v);
    svgEl('line', {x1:pad.l, y1:y, x2:W-pad.r, y2:y, 'stroke-dasharray':'3 4'}, g);
    svgText(v, {x:pad.l-5, y:y+4, 'text-anchor':'end'}, g);
  });
  for (let i = 0; i < days; i += 10) svgText('Day '+(i+1), {x:xS(i), y:H-4, 'text-anchor':'middle'}, g);

  const pts = data.map((v,i) => `${xS(i)},${yS(v)}`).join(' L ');
  const last = days-1;
  svgEl('path', {d:`M ${xS(0)},${yS(0)} L ${xS(0)},${yS(data[0])} L ${pts.slice(pts.indexOf(','))} L ${xS(last)},${yS(0)} Z`, fill:'var(--green)', class:'line-area'}, svg);
  svgEl('path', {d:`M ${pts}`, class:'line-path', stroke:'var(--green)'}, svg);
  svgEl('circle', {cx:xS(last), cy:yS(data[last]), r:4, fill:'var(--green)', stroke:'var(--bg-card)', 'stroke-width':3}, svg);
})();

// ── MOOD BARS ──
(function() {
  const moods = [
    {label:'Calm',    pct:32, color:'var(--green)'},
    {label:'Good',    pct:28, color:'var(--blue)'},
    {label:'Stressed',pct:18, color:'var(--gold)'},
    {label:'Low',     pct:13, color:'var(--purple)'},
    {label:'Sad',     pct:9,  color:'var(--red)'},
  ];
  const c = document.getElementById('moodBars');
  if (!c) return;
  moods.forEach(m => {
    c.innerHTML += `<div class="mood-bar-row">
      <div class="mood-bar-label">${m.label}</div>
      <div class="mood-bar-track"><div class="mood-bar-fill" style="width:${m.pct}%;background:${m.color};opacity:0.8"></div></div>
      <div class="mood-bar-pct">${m.pct}%</div>
    </div>`;
  });
})();

// ── SCREEN TIME BARS ──
(function() {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const mins = [14, 18, 22, 16, 25, 31, 19];
  const maxM = Math.max(...mins);
  const c = document.getElementById('screenBars');
  if (!c) return;
  days.forEach((d, i) => {
    c.innerHTML += `<div class="screen-row">
      <div class="screen-day">${d}</div>
      <div class="screen-track"><div class="screen-fill" style="width:${(mins[i]/maxM)*100}%"></div></div>
      <div class="screen-val">${mins[i]}m</div>
    </div>`;
  });
})();

// ── ACTIVE BY DAY CHART ──
(function() {
  const svg = document.getElementById('activeByDayChart');
  if (!svg) return;
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const vals = [420, 380, 510, 490, 620, 710, 540];
  const W = 420, H = 160, pad = {t:10,r:10,b:30,l:30};
  const iW = W-pad.l-pad.r, iH = H-pad.t-pad.b;
  const barW = (iW/days.length)*0.55;
  const maxV = Math.max(...vals);

  const g = svgEl('g', {class:'chart-grid'}, svg);
  [0, Math.round(maxV/2), maxV].forEach(v => {
    const y = pad.t + iH - (v/maxV)*iH;
    svgEl('line', {x1:pad.l, y1:y, x2:W-pad.r, y2:y, 'stroke-dasharray':'3 4'}, g);
    svgText(v>=1000?`${(v/1000).toFixed(1)}k`:v, {x:pad.l-4, y:y+4, 'text-anchor':'end'}, g);
  });
  days.forEach((d, i) => {
    const x = pad.l + (i/days.length)*iW + (iW/days.length-barW)/2;
    const bH = (vals[i]/maxV)*iH;
    const alpha = (0.35 + (vals[i]/maxV)*0.65).toFixed(2);
    svgEl('rect', {x, y:pad.t+iH-bH, width:barW, height:bH, fill:`rgba(45,122,95,${alpha})`, rx:5}, svg);
    svgText(d, {x:x+barW/2, y:H-8, 'text-anchor':'middle'}, svg);
  });
})();

// ── NEW VS RETURNING ──
(function() {
  const svg = document.getElementById('newReturnChart');
  if (!svg) return;
  const months = ['Oct','Nov','Dec','Jan','Feb','Mar'];
  const newU   = [320,410,480,390,520,610];
  const retU   = [180,290,340,410,480,520];
  const W=300,H=160,pad={t:10,r:10,b:28,l:10};
  const iW=W-pad.l-pad.r, iH=H-pad.t-pad.b;
  const barW=(iW/months.length)*0.55, maxV=1200;
  months.forEach((m,i) => {
    const x = pad.l+(i/months.length)*iW+(iW/months.length-barW)/2;
    const h1=(newU[i]/maxV)*iH, h2=(retU[i]/maxV)*iH, tot=h1+h2;
    svgEl('rect',{x,y:pad.t+iH-tot,width:barW,height:h2,fill:'var(--green)',opacity:0.5,rx:3},svg);
    svgEl('rect',{x,y:pad.t+iH-tot+h2,width:barW,height:h1,fill:'var(--gold)',opacity:0.65,rx:0},svg);
    svgText(m,{x:x+barW/2,y:H-6,'text-anchor':'middle'},svg);
  });
})();

// ── RETENTION LINE CHART ──
(function() {
  const svg = document.getElementById('retentionChart');
  if (!svg) return;
  const W=300,H=160,pad={t:10,r:15,b:30,l:32};
  const iW=W-pad.l-pad.r, iH=H-pad.t-pad.b;
  const data=[62,65,64,68,66,70,68,72,69,71,73,68];
  const maxV=80, days=data.length;
  const xS=i=>pad.l+(i/(days-1))*iW;
  const yS=v=>pad.t+iH-(v/maxV)*iH;
  const g=svgEl('g',{class:'chart-grid'},svg);
  [0,40,80].forEach(v=>{
    const y=yS(v);
    svgEl('line',{x1:pad.l,y1:y,x2:W-pad.r,y2:y,'stroke-dasharray':'3 4'},g);
    svgText(v+'%',{x:pad.l-4,y:y+4,'text-anchor':'end'},g);
  });
  const pts=data.map((v,i)=>`${xS(i)},${yS(v)}`).join(' L ');
  svgEl('path',{d:`M ${pts}`,class:'line-path',stroke:'var(--blue)'},svg);
  svgEl('circle',{cx:xS(days-1),cy:yS(data[days-1]),r:4,fill:'var(--blue)',stroke:'var(--bg-card)','stroke-width':3},svg);
})();

// ── STREAK CHART ──
(function() {
  const svg = document.getElementById('streakChart');
  if (!svg) return;
  const labels=['1 day','2–3','4–7','8–14','15–30','30+'];
  const vals=[28,22,19,14,11,6];
  const W=300,H=160,pad={t:8,r:50,b:10,l:40};
  const iW=W-pad.l-pad.r, iH=H-pad.t-pad.b;
  const rowH=iH/labels.length, maxV=30;
  labels.forEach((lbl,i)=>{
    const y=pad.t+i*rowH, barH=rowH*0.55, barW=(vals[i]/maxV)*iW;
    const alpha=(0.3+(1-i/labels.length)*0.65).toFixed(2);
    svgEl('rect',{x:pad.l,y:y+(rowH-barH)/2,width:barW,height:barH,fill:'var(--green)',opacity:alpha,rx:4},svg);
    svgText(lbl,{x:pad.l-4,y:y+rowH/2+4,'text-anchor':'end'},svg);
    svgText(vals[i]+'%',{x:pad.l+barW+5,y:y+rowH/2+4},svg);
  });
})();

// ── USERS ──
const AVATARS_BG = ['#2d7a5f','#2980b9','#7b6ab0','#c0392b','#d4851a','#1a7a6e'];
const USERS = [
  {id:1,  first:'Lerato',   last:'Dlamini',   email:'lerato@example.com',   joined:'Jan 2025', lastActive:'Today',       checkins:24, streak:7,  verified:false, active:true,  anon:false},
  {id:2,  first:'Sipho',    last:'Nkosi',     email:'sipho@example.com',    joined:'Feb 2025', lastActive:'Yesterday',   checkins:18, streak:3,  verified:true,  active:true,  anon:true},
  {id:3,  first:'Ayanda',   last:'Mokoena',   email:'ayanda@example.com',   joined:'Mar 2025', lastActive:'3 days ago',  checkins:9,  streak:1,  verified:false, active:false, anon:true},
  {id:4,  first:'Thabo',    last:'Sithole',   email:'thabo@example.com',    joined:'Jan 2025', lastActive:'Today',       checkins:31, streak:12, verified:true,  active:true,  anon:false},
  {id:5,  first:'Nomsa',    last:'Zulu',      email:'nomsa@example.com',    joined:'Apr 2025', lastActive:'Today',       checkins:6,  streak:2,  verified:false, active:true,  anon:true},
  {id:6,  first:'Kagiso',   last:'Tau',       email:'kagiso@example.com',   joined:'Feb 2025', lastActive:'1 week ago',  checkins:14, streak:0,  verified:false, active:false, anon:false},
  {id:7,  first:'Zanele',   last:'Khumalo',   email:'zanele@example.com',   joined:'Mar 2025', lastActive:'Today',       checkins:22, streak:9,  verified:true,  active:true,  anon:false},
  {id:8,  first:'Bongani',  last:'Mthembu',   email:'bongani@example.com',  joined:'Jan 2025', lastActive:'2 days ago',  checkins:11, streak:4,  verified:false, active:true,  anon:true},
  {id:9,  first:'Precious', last:'Mahlangu',  email:'precious@example.com', joined:'May 2025', lastActive:'Today',       checkins:3,  streak:1,  verified:false, active:true,  anon:true},
  {id:10, first:'Sibusiso', last:'Radebe',    email:'sibusiso@example.com', joined:'Feb 2025', lastActive:'Today',       checkins:28, streak:15, verified:true,  active:true,  anon:false},
  {id:11, first:'Ntombi',   last:'Cele',      email:'ntombi@example.com',   joined:'Apr 2025', lastActive:'Yesterday',   checkins:8,  streak:2,  verified:false, active:true,  anon:false},
  {id:12, first:'Lungelo',  last:'Shabalala', email:'lungelo@example.com',  joined:'Mar 2025', lastActive:'4 days ago',  checkins:5,  streak:0,  verified:false, active:false, anon:true},
];

let currentFilter = 'all';
let verifiedUsers  = new Set(USERS.filter(u => u.verified).map(u => u.id));

function initials(u) { return (u.first[0] + u.last[0]).toUpperCase(); }
function avatarBg(u) { return AVATARS_BG[(u.first.charCodeAt(0) + u.last.charCodeAt(0)) % AVATARS_BG.length]; }

function renderUsers(list) {
  const grid = document.getElementById('usersGrid');
  document.getElementById('usersCount').textContent = `Showing ${list.length} user${list.length !== 1 ? 's' : ''}`;
  if (!list.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);font-size:0.88rem;">No users found</div>';
    return;
  }
  grid.innerHTML = list.map((u, i) => {
    const isVerified = verifiedUsers.has(u.id);
    return `
    <div class="user-card" style="animation-delay:${i*0.04}s">
      <div class="user-card-top">
        <div class="user-avatar" style="background:${avatarBg(u)}">
          ${initials(u)}
          ${isVerified ? `<div class="verified-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>` : ''}
        </div>
        <div class="user-info">
          <div class="user-name">
            ${u.first} ${u.last}
            ${isVerified ? `<svg class="blue-check" width="14" height="14" viewBox="0 0 24 24" fill="var(--blue)" stroke="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" fill="none" stroke="var(--blue)" stroke-width="2"/><polyline points="9 12 11 14 15 10" stroke="white" stroke-width="2" fill="none"/></svg>` : ''}
          </div>
          <div class="user-email">${u.anon ? '••••@••••.com' : u.email}</div>
        </div>
      </div>
      <div class="user-meta">
        <span class="user-tag ${u.active ? 'active' : 'inactive'}">${u.active ? 'Active' : 'Inactive'}</span>
        ${u.anon ? '<span class="user-tag anon">Anonymous</span>' : ''}
        <span style="font-size:0.65rem;color:var(--text-light);margin-left:auto">Joined ${u.joined}</span>
      </div>
      <div class="user-stats">
        <div class="user-stat"><div class="user-stat-val">${u.checkins}</div><div class="user-stat-lbl">Check-ins</div></div>
        <div class="user-stat"><div class="user-stat-val">${u.streak}</div><div class="user-stat-lbl">Streak</div></div>
        <div class="user-stat"><div class="user-stat-val">${u.lastActive}</div><div class="user-stat-lbl">Last Active</div></div>
      </div>
      <div class="user-card-actions">
        <button class="verify-btn ${isVerified ? 'verified' : ''}" onclick="toggleVerify(${u.id}, this)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          ${isVerified ? 'Verified' : 'Verify'}
        </button>
        <button class="view-btn">View Profile</button>
      </div>
    </div>`;
  }).join('');
}

function toggleVerify(id) {
  if (verifiedUsers.has(id)) verifiedUsers.delete(id);
  else verifiedUsers.add(id);
  applyFilter();
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
  const list = USERS.filter(u => {
    const matchSearch = !search ||
      u.first.toLowerCase().includes(search) ||
      u.last.toLowerCase().includes(search)  ||
      u.email.toLowerCase().includes(search);
    const matchFilter =
      currentFilter === 'all'      ? true :
      currentFilter === 'active'   ? u.active :
      currentFilter === 'verified' ? verifiedUsers.has(u.id) :
      currentFilter === 'anon'     ? u.anon : true;
    return matchSearch && matchFilter;
  });
  renderUsers(list);
}

renderUsers(USERS);