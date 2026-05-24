// ── SPLASH → LOADING → AUTH ──
function startLoading() {
  const splash  = document.getElementById('splash');
  const loading = document.getElementById('loading');
  const auth    = document.getElementById('auth');
  const bar     = document.getElementById('progressBar');

  splash.classList.add('exit');

  setTimeout(() => {
    splash.style.display = 'none';
    loading.classList.add('visible');

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 18 + 4;
      if (progress >= 100) {
        progress = 100;
        bar.style.width = '100%';
        clearInterval(interval);
        setTimeout(() => {
          loading.classList.add('exit');
          auth.classList.add('visible');
        }, 400);
      } else {
        bar.style.width = progress + '%';
      }
    }, 120);
  }, 500);
}

// ── TAB SWITCHING ──
// Syncs both mobile and desktop tab bars
function switchTab(tab) {
  // All tab buttons across both tab bars
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

  // Activate matching tabs in both bars
  document.querySelectorAll(`.auth-tab[onclick="switchTab('${tab}')"]`).forEach(t => {
    t.classList.add('active');
  });

  document.getElementById(`form-${tab}`).classList.add('active');
}

// ── PASSWORD VISIBILITY ──
function togglePw(inputId, eyeEl) {
  const input    = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type     = isHidden ? 'text' : 'password';
  eyeEl.innerHTML = isHidden
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
       </svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
       </svg>`;
}

// ── FORGOT PASSWORD ──
function showForgot() {
  document.getElementById('forgotOverlay').classList.add('visible');
}
function hideForgot(e, force) {
  if (force || (e && e.target === document.getElementById('forgotOverlay'))) {
    document.getElementById('forgotOverlay').classList.remove('visible');
  }
}