// ===== LANDING =====
(function() {
  const btn  = document.getElementById('themeBtn');
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