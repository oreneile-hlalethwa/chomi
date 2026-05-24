// Injects topbar and bottom nav into every page
document.addEventListener('DOMContentLoaded', () => {

  // ── TOP BAR ──
  const topbar = document.createElement('header');
  topbar.className = 'topbar';
  topbar.innerHTML = `
    <div class="topbar-inner">
      <span class="logo">chomi<span class="logo-dot">.</span></span>
      <div class="topbar-actions">
        <button class="icon-btn" aria-label="Notifications">
          <span class="notif-dot"></span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </button>
        <button class="icon-btn" id="themeToggle" aria-label="Toggle dark mode">
          <svg id="sunIcon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg id="moonIcon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </div>`;

  document.body.prepend(topbar);

  // ── BOTTOM NAV ──
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.innerHTML = `
    <a class="nav-item" href="/home/">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      <span class="nav-label">Home</span>
    </a>
    <a class="nav-item" href="/inbox/">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="nav-label">Inbox</span>
    </a>
    <a class="nav-item" href="/reels/">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
      <span class="nav-label">Reels</span>
    </a>
    <a class="nav-item" href="/support/">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.58 1.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.75a16 16 0 0 0 6.29 6.29l.87-1.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 15.42z"/></svg>
      <span class="nav-label">Support</span>
    </a>
    <a class="nav-item" href="/profile/">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <span class="nav-label">Profile</span>
    </a>`;
  document.body.appendChild(nav);

  // Highlight current page
  const current = window.location.pathname.split('/').pop() || 'home.html';
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('href') === current) item.classList.add('active');
  });

  // Init theme after nav is injected
  const themeBtn = document.getElementById('themeToggle');
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
  if (saved) { setTheme(saved === 'dark'); }
  else { setTheme(hour >= 19 || hour < 7); }

  themeBtn.addEventListener('click', () => {
    setTheme(html.getAttribute('data-theme') !== 'dark');
  });
});