// ===== REELS =====
document.addEventListener('DOMContentLoaded', () => {

  const reels              = document.querySelectorAll('.reel');
  const videos             = Array.from(document.querySelectorAll('.reel .video-wrapper video'));
  const progressBars       = Array.from(document.querySelectorAll('.progress-fill'));
  const volumeBtns         = Array.from(document.querySelectorAll('.volume-btn'));
  const playPauseIndicators= Array.from(document.querySelectorAll('.play-pause-indicator'));
  const videoTimeDisplays  = Array.from(document.querySelectorAll('.video-time'));
  let currentReelIndex     = 0;
  let globalMuted          = true; // tracks mute state across reels

  // ── UNMUTE HINT (first reel only) ──
  const unmuteHint = document.getElementById('unmuteHint');
  if (unmuteHint) {
    setTimeout(() => {
      unmuteHint.classList.add('visible');
      setTimeout(() => unmuteHint.classList.remove('visible'), 3000);
    }, 1000);
  }

  // ── HELPERS ──
  function formatTime(s) {
    if (isNaN(s)) return '0:00';
    return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  }
  function updateTimeDisplay(video, el) {
    if (video && el) el.textContent = `${formatTime(video.currentTime||0)} / ${formatTime(video.duration||0)}`;
  }

  // ── UPDATE VOLUME BUTTON ICON ──
  function updateVolBtn(btn, muted) {
    if (!btn) return;
    btn.innerHTML = muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
    if (muted) btn.classList.add('muted-state');
    else btn.classList.remove('muted-state');
  }

  // ── PLAY / PAUSE ──
  function playVideo(video, progressBar, timeDisplay, indicator) {
    if (!video) return;
    video.muted = globalMuted;
    video.play().catch(() => {});
    if (indicator) indicator.classList.remove('show');
    video.addEventListener('timeupdate', () => {
      if (video.duration && progressBar) progressBar.style.width = `${(video.currentTime/video.duration)*100}%`;
      if (timeDisplay) updateTimeDisplay(video, timeDisplay);
    });
    video.addEventListener('ended', () => { video.currentTime = 0; video.play(); });
  }

  function pauseVideo(video, progressBar, timeDisplay, indicator) {
    if (!video || video.paused) return;
    video.pause();
    if (indicator) {
      indicator.classList.add('show');
      setTimeout(() => indicator.classList.remove('show'), 500);
    }
  }

  // ── CLICK TO PLAY/PAUSE ──
  videos.forEach((video, i) => {
    const wrapper = video.closest('.video-wrapper');
    if (wrapper) {
      wrapper.addEventListener('click', (e) => {
        if (e.target.closest('.volume-btn')) return;
        if (video.paused) playVideo(video, progressBars[i], videoTimeDisplays[i], playPauseIndicators[i]);
        else pauseVideo(video, progressBars[i], videoTimeDisplays[i], playPauseIndicators[i]);
      });
    }
  });

  // ── INTERSECTION OBSERVER ──
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = parseInt(entry.target.getAttribute('data-reel-index'));
        if (!isNaN(index)) {
          currentReelIndex = index;
          videos.forEach((video, i) => {
            if (i === index) {
              video.muted = globalMuted;
              updateVolBtn(volumeBtns[i], globalMuted);
              playVideo(video, progressBars[i], videoTimeDisplays[i], playPauseIndicators[i]);
            } else {
              pauseVideo(video, progressBars[i], videoTimeDisplays[i], playPauseIndicators[i]);
              if (progressBars[i]) progressBars[i].style.width = '0%';
            }
          });
        }
      }
    });
  }, { threshold: 0.6 });

  reels.forEach(reel => observer.observe(reel));

  // Play first video
  if (videos[0]) {
    videos[0].muted = true;
    playVideo(videos[0], progressBars[0], videoTimeDisplays[0], playPauseIndicators[0]);
  }

  // ── VOLUME — global mute state ──
  volumeBtns.forEach((btn, i) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      globalMuted = !globalMuted;

      // Apply to current video immediately
      if (videos[i]) videos[i].muted = globalMuted;
      updateVolBtn(btn, globalMuted);

      // Hide unmute hint when user interacts
      if (unmuteHint) unmuteHint.classList.remove('visible');
    });
  });

  // ── LIKE ──
  document.querySelectorAll('.like-btn').forEach(btn => {
    let liked = false;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      liked = !liked;
      btn.classList.toggle('liked', liked);
      const span = btn.querySelector('.action-count');
      let count = parseFloat(span.textContent.replace('K','')) * (span.textContent.includes('K') ? 1000 : 1);
      count = liked ? count + 1 : count - 1;
      span.textContent = count >= 1000 ? `${(count/1000).toFixed(1)}K` : count;
    });
  });

  // ── FOLLOW ──
  document.querySelectorAll('.follow-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const following = btn.classList.toggle('following');
      btn.textContent = following ? 'Following' : 'Follow';
    });
  });

  // ── DOUBLE TAP TO LIKE ──
  reels.forEach(reel => {
    let tapCount = 0, tapTimer;
    const wrapper = reel.querySelector('.video-wrapper');
    if (wrapper) {
      wrapper.addEventListener('click', (e) => {
        if (e.target.closest('.action-btn') || e.target.closest('.volume-btn') || e.target.closest('.follow-btn')) return;
        tapCount++;
        if (tapCount === 1) { tapTimer = setTimeout(() => tapCount = 0, 300); }
        else if (tapCount === 2) {
          clearTimeout(tapTimer); tapCount = 0;
          reel.querySelector('.like-btn')?.click();
          showHeart(e);
        }
      });
    }
  });

  function showHeart(e) {
    const h = document.createElement('div');
    h.textContent = '♥';
    h.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;font-size:50px;color:#ec4899;transform:translate(-50%,-50%) scale(0);transition:transform 0.3s ease;pointer-events:none;z-index:1000;`;
    document.body.appendChild(h);
    setTimeout(() => h.style.transform = 'translate(-50%,-50%) scale(1)', 10);
    setTimeout(() => { h.style.transform = 'translate(-50%,-50%) scale(1.5)'; h.style.opacity = '0'; }, 300);
    setTimeout(() => h.remove(), 600);
  }

  // ── SHARE ──
  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const caption = btn.closest('.reel')?.querySelector('.reel-caption')?.textContent || '';
      if (navigator.share) {
        try { await navigator.share({ title: 'Chomi Wellness Reel', text: caption, url: window.location.href }); }
        catch { /* cancelled */ }
      } else {
        navigator.clipboard.writeText(caption);
        alert('Caption copied to clipboard!');
      }
    });
  });

  // ── TIME DISPLAYS ──
  videos.forEach((video, i) => {
    if (video.readyState >= 1) updateTimeDisplay(video, videoTimeDisplays[i]);
    video.addEventListener('loadedmetadata', () => updateTimeDisplay(video, videoTimeDisplays[i]));
  });
});