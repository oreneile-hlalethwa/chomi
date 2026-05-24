// ===== REELS =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.follow-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const following = btn.classList.toggle('following');
      btn.textContent = following ? 'Following' : 'Follow';
    });
  });

  document.querySelectorAll('.vid-action').forEach(btn => {
    if (btn.querySelector('svg path[d*="20.84"]')) {
      btn.addEventListener('click', () => btn.classList.toggle('liked'));
    }
  });
});