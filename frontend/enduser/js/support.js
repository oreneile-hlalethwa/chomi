// ===== SUPPORT =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.dir-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const name = btn.closest('.nearby-card')?.querySelector('.nearby-name')?.textContent?.trim();
      if (name) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`, '_blank');
    });
  });
});