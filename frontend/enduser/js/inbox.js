// ===== INBOX =====
document.addEventListener('DOMContentLoaded', () => {
  // Mark as read on click
  document.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      const badge = item.querySelector('.badge');
      if (badge) badge.remove();
    });
  });

  // Compose button — hook to your chat view on real build
  document.querySelector('.fab')?.addEventListener('click', () => {
    console.log('Open new message — wire to Django view');
  });
});