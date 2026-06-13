// ===== PROFILE =====
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

  // ── AVATAR COLORS ──
  const COLORS = ['#2d7a5f','#4a7ac8','#7b6ab0','#c0392b','#c99840','#1a7a6e'];
  function avatarBg(id) { return COLORS[id % COLORS.length]; }

  // ── ANONYMOUS TOGGLE ──
  function setAnonymous() {
    profileName.textContent = 'Anonymous';
    profileSub.textContent  = 'Private mode · Identity hidden';
    profileAvatar.innerHTML = personSVG;
    anonSubText.textContent = 'Your identity is hidden from everyone';
  }
  function setRealName() {
    const full     = `${LOGGED_IN_USER.first} ${LOGGED_IN_USER.last}`;
    const initials = `${LOGGED_IN_USER.first[0]}${LOGGED_IN_USER.last[0]}`;
    const verifiedBadge = LOGGED_IN_USER.is_verified
      ? ` <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none" style="vertical-align:middle"><circle cx="12" cy="12" r="10" fill="var(--accent)"/><polyline points="9 12 11 14 15 10" stroke="white" stroke-width="2" fill="none"/></svg>`
      : '';
    profileName.innerHTML   = full + verifiedBadge;
    profileSub.textContent  = 'Public profile · Identity visible';
    profileAvatar.innerHTML = `<span style="font-family:var(--font-display);font-size:1.5rem;font-weight:400;color:var(--accent);">${initials}</span>`;
    anonSubText.textContent = 'Your real name is visible to others';
  }

  if (LOGGED_IN_USER.is_anonymous) { anonToggle.checked = true; setAnonymous(); }
  else { anonToggle.checked = false; setRealName(); }

  anonToggle.addEventListener('change', async () => {
    const isAnonymous = anonToggle.checked;
    if (isAnonymous) setAnonymous(); else setRealName();
    try {
      await fetch('/api/toggle-anonymous/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ is_anonymous: isAnonymous }),
      });
    } catch { console.log('Could not save anonymous preference'); }
  });

  // ── MOOD HISTORY ──
  async function loadMoodHistory() {
    try {
      const res  = await fetch('/api/mood-history/');
      const data = await res.json();
      const bars = document.querySelectorAll('#historyBars .hbar');
      const days = document.querySelectorAll('#chartDays span');
      const maxScore = 5;
      const moodClass = { good:'good', calm:'calm', stressed:'stressed', low:'low', sad:'sad' };

      let checkinCount = 0, streakCount = 0, topMoodMap = {};
      let inStreak = true;

      data.history.forEach((day, i) => {
        if (bars[i]) {
          const pct = day.score > 0 ? (day.score / maxScore) * 100 : 8;
          bars[i].style.height = pct + '%';
          bars[i].className = `hbar ${moodClass[day.mood] || 'calm'}`;
          if (day.mood) {
            checkinCount++;
            topMoodMap[day.mood] = (topMoodMap[day.mood] || 0) + 1;
          }
        }
        if (days[i]) days[i].textContent = day.day;
      });

      // Calculate streak (consecutive days from today backwards)
      const reversed = [...data.history].reverse();
      for (const day of reversed) {
        if (day.score > 0) streakCount++;
        else { inStreak = false; break; }
        if (!inStreak) break;
      }

      // Top mood
      const topMood = Object.entries(topMoodMap).sort((a,b) => b[1]-a[1])[0]?.[0] || null;

      // Update stats
      document.getElementById('statStreak').textContent  = streakCount || '0';
      document.getElementById('statCheckins').textContent = checkinCount || '0';
      if (topMood) {
        const moodEmoji = { good:'😊', calm:'😌', stressed:'😰', low:'😔', sad:'😢' };
        document.getElementById('statMood').textContent = moodEmoji[topMood] || topMood;
      }
    } catch { console.log('Could not load mood history'); }
  }
  loadMoodHistory();

  // ── NOTIFICATIONS ──
  async function loadNotifications() {
    try {
      const res  = await fetch('/api/conversations/');
      const data = await res.json();
      const list   = document.getElementById('notifList');
      const badge  = document.getElementById('notifBadge');
      const convos = data.conversations || [];

      const totalUnread = convos.reduce((sum, c) => sum + (c.unread || 0), 0);

      if (totalUnread > 0) {
        badge.textContent    = totalUnread;
        badge.style.display  = '';
      } else {
        badge.style.display  = 'none';
      }

      if (!convos.length) {
        list.innerHTML = '<p style="font-size:0.82rem;color:var(--text-muted);text-align:center;padding:1rem 0">No conversations yet</p>';
        return;
      }

      list.innerHTML = convos.map(c => `
        <a class="notif-item" href="/inbox/">
          <div class="notif-avatar" style="background:${avatarBg(c.other_id)}">${c.initials}</div>
          <div>
            <p class="notif-name">${c.name}</p>
            <p class="notif-preview">${c.last_msg}</p>
          </div>
          ${c.unread > 0 ? `<span class="notif-count">${c.unread}</span>` : ''}
        </a>`).join('');
    } catch { console.log('Could not load notifications'); }
  }
  loadNotifications();

  // ── SHEETS ──
  window.openSheet = function(id) {
    document.getElementById('sheetOverlay').classList.add('visible');
    document.getElementById(id).classList.add('open');
    if (id === 'privacySheet') prefillPrivacy();
    if (id === 'clearSheet')   loadConvoList();
    if (id === 'notifSheet')   loadNotifications();
  };

  window.closeAllSheets = function() {
    document.getElementById('sheetOverlay').classList.remove('visible');
    document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('open'));
    showClearStep1();
  };

  // ── PRIVACY / EDIT PROFILE ──
  function prefillPrivacy() {
    document.getElementById('editFirst').value = LOGGED_IN_USER.first || '';
    document.getElementById('editLast').value  = LOGGED_IN_USER.last  || '';
    document.getElementById('editEmail').value = LOGGED_IN_USER.email || '';
    document.getElementById('editPhone').value = LOGGED_IN_USER.phone || '';
    document.getElementById('privacyMsg').textContent = '';
  }

  window.saveProfile = async function() {
    const first = document.getElementById('editFirst').value.trim();
    const last  = document.getElementById('editLast').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const msg   = document.getElementById('privacyMsg');

    if (!first || !last || !email) { msg.textContent = 'First name, last name and email are required.'; msg.style.color = '#c0392b'; return; }

    try {
      const res  = await fetch('/api/update-profile/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ first_name: first, last_name: last, email, phone_number: phone }),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        LOGGED_IN_USER.first = first;
        LOGGED_IN_USER.last  = last;
        LOGGED_IN_USER.email = email;
        LOGGED_IN_USER.phone = phone;
        if (!LOGGED_IN_USER.is_anonymous) setRealName();
        msg.textContent  = 'Saved!';
        msg.style.color  = 'var(--accent)';
        setTimeout(() => closeAllSheets(), 1000);
      } else {
        msg.textContent = data.error || 'Could not save. Try again.';
        msg.style.color = '#c0392b';
      }
    } catch { document.getElementById('privacyMsg').textContent = 'Network error. Try again.'; }
  };

  // ── CLEAR DATA ──
  let conversations = [];

  async function loadConvoList() {
    try {
      const res  = await fetch('/api/conversations/');
      const data = await res.json();
      conversations = data.conversations || [];
      const list = document.getElementById('convoList');
      list.innerHTML = conversations.map(c => `
        <label class="check-row sub-check">
          <input type="checkbox" class="convo-check" data-id="${c.id}" />
          <div>
            <p class="check-label">${c.name}</p>
            <p class="check-sub">${c.last_msg}</p>
          </div>
        </label>`).join('');
    } catch { console.log('Could not load conversations'); }
  }

  window.toggleConvoList = function() {
    const checked = document.getElementById('clearChats').checked;
    document.getElementById('convoSelect').style.display = checked ? 'flex' : 'none';
  };

  window.toggleAllConvos = function() {
    const all     = document.getElementById('selectAllConvos').checked;
    document.querySelectorAll('.convo-check').forEach(c => c.checked = all);
  };

  window.showClearConfirm = function() {
    const mood    = document.getElementById('clearMood').checked;
    const chats   = document.getElementById('clearChats').checked;
    const selected = [...document.querySelectorAll('.convo-check:checked')].map(c => c.dataset.id);

    if (!mood && !chats) { alert('Please select at least one option.'); return; }
    if (chats && selected.length === 0 && !document.getElementById('selectAllConvos').checked) {
      alert('Please select at least one conversation to delete.'); return;
    }

    let desc = 'You are about to permanently delete: ';
    const parts = [];
    if (mood) parts.push('all your mood check-ins and AI responses');
    if (chats) {
      const all = document.getElementById('selectAllConvos').checked;
      parts.push(all ? 'all your chat conversations' : `${selected.length} selected conversation(s)`);
    }
    desc += parts.join(' and ') + '. This cannot be undone.';

    document.getElementById('confirmDesc').textContent = desc;
    document.getElementById('clearStep1').style.display = 'none';
    document.getElementById('clearStep2').style.display = 'flex';
  };

  window.showClearStep1 = function() {
    document.getElementById('clearStep1').style.display = 'flex';
    document.getElementById('clearStep2').style.display = 'none';
  };

  window.executeDelete = async function() {
    const mood     = document.getElementById('clearMood').checked;
    const allConvo = document.getElementById('selectAllConvos').checked;
    const selected = allConvo ? conversations.map(c => c.id) : [...document.querySelectorAll('.convo-check:checked')].map(c => c.dataset.id);
    const chats    = document.getElementById('clearChats').checked;

    try {
      const res = await fetch('/api/clear-data/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({
          clear_mood:  mood,
          clear_chats: chats,
          convo_ids:   chats ? selected : [],
        }),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        closeAllSheets();
        loadMoodHistory();
        loadNotifications();
        alert('Data deleted successfully.');
      }
    } catch { alert('Something went wrong. Please try again.'); }
  };

  // ── HELPERS ──
  function getCookie(name) {
    let value = `; ${document.cookie}`;
    let parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }
});