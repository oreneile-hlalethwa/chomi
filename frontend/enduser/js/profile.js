// ===== PROFILE =====
// Replace with Django session user on real build

document.addEventListener('DOMContentLoaded', () => {
  const anonToggle    = document.getElementById('anonToggle');
  const profileName   = document.getElementById('profileName');
  const profileSub    = document.getElementById('profileSub');
  const profileAvatar = document.getElementById('profileAvatar');
  const anonSubText   = document.getElementById('anonSubText');

  const personSVG = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>`;

  function setAnonymous() {
    profileName.textContent   = 'Anonymous';
    profileSub.textContent    = 'Private mode · Identity hidden';
    profileAvatar.innerHTML   = personSVG;
    anonSubText.textContent   = 'Your identity is hidden from everyone';
  }

  function setRealName() {
    const full    = `${LOGGED_IN_USER.first} ${LOGGED_IN_USER.last}`;
    const initials= `${LOGGED_IN_USER.first[0]}${LOGGED_IN_USER.last[0]}`;
    profileName.textContent = full;
    profileSub.textContent  = 'Public profile · Identity visible';
    profileAvatar.innerHTML = `<span style="font-family:var(--font-display);font-size:1.5rem;font-weight:400;color:var(--accent);">${initials}</span>`;
    anonSubText.textContent = 'Your real name is visible to others';
  }

  setAnonymous();

  anonToggle.addEventListener('change', () => {
    if (anonToggle.checked) { setAnonymous(); } else { setRealName(); }
  });
});