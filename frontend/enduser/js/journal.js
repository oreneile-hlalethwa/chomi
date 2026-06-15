// ===== JOURNAL =====
document.addEventListener('DOMContentLoaded', () => {

  let currentEntryId = null;
  let allEntries     = [];
  let currentEntry   = null;

  // ── SET TODAY'S DATE ──
  const dateEl = document.getElementById('journalDate');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-ZA', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // ── LOAD PROMPT ──
  window.loadPrompt = async function() {
    try {
      const res  = await fetch('/api/journal/prompt/');
      const data = await res.json();
      document.getElementById('promptText').textContent = data.prompt;

      // Show mood badge
      if (data.mood) {
        const wrap = document.getElementById('moodBadgeWrap');
        const labels = { calm: 'Calm', good: 'Good', stressed: 'Stressed', low: 'Low', sad: 'Sad' };
        wrap.innerHTML = `<span class="mood-badge ${data.mood}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
          Feeling ${labels[data.mood] || data.mood} today
        </span>`;
      }
    } catch(e) {
      document.getElementById('promptText').textContent = "What's on your mind today?";
    }
  };
  loadPrompt();

  // ── WORD COUNT ──
  window.updateWordCount = function() {
    const text  = document.getElementById('journalTextarea').value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    document.getElementById('wordCount').textContent = `${words} word${words !== 1 ? 's' : ''}`;
  };

  // ── SAVE ENTRY ──
  window.saveEntry = async function() {
    const content = document.getElementById('journalTextarea').value.trim();
    if (!content) { showStatus('Nothing to save yet.', false); return; }

    try {
      const res  = await fetch('/api/journal/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ content, id: currentEntryId }),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        currentEntryId = data.id;
        showStatus('Saved ✓', true);
      }
    } catch(e) { showStatus('Could not save. Try again.', false); }
  };

  // ── CLEAR ──
  window.clearEntry = function() {
    if (!document.getElementById('journalTextarea').value.trim()) return;
    if (confirm('Clear this entry?')) {
      document.getElementById('journalTextarea').value = '';
      updateWordCount();
      currentEntryId = null;
    }
  };

  // ── SHOW STATUS ──
  function showStatus(msg, success) {
    const el = document.getElementById('saveStatus');
    el.textContent  = msg;
    el.style.color  = success ? 'var(--accent, #2d7a5f)' : '#c0392b';
    el.style.opacity = '1';
    setTimeout(() => el.style.opacity = '0', 2500);
  }

  // ── SHOW ENTRIES ──
  window.showEntries = async function() {
    document.getElementById('writeView').classList.add('hidden');
    document.getElementById('detailView').classList.add('hidden');
    document.getElementById('entriesView').classList.remove('hidden');
    await loadEntries();
  };

  window.showWrite = function() {
    document.getElementById('entriesView').classList.add('hidden');
    document.getElementById('detailView').classList.add('hidden');
    document.getElementById('writeView').classList.remove('hidden');
    currentEntryId = null;
    document.getElementById('journalTextarea').value = '';
    updateWordCount();
    loadPrompt();
  };

  // ── LOAD ENTRIES ──
  async function loadEntries() {
    try {
      const res  = await fetch('/api/journal/entries/');
      const data = await res.json();
      allEntries = data.entries || [];
      renderEntries(allEntries);
      renderStreak(allEntries);
    } catch(e) {
      document.getElementById('entriesList').innerHTML = '<p style="text-align:center;color:var(--text-light);font-size:0.82rem;padding:2rem 0">Could not load entries.</p>';
    }
  }

  function renderEntries(entries) {
    const list = document.getElementById('entriesList');
    if (!entries.length) {
      list.innerHTML = `
        <div class="entries-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>No journal entries yet.<br>Write your first one!</p>
        </div>`;
      return;
    }

    const moodColors = { calm: '#2d7a5f', good: '#4a7ac8', stressed: '#e8b96a', low: '#7b6ab0', sad: '#c0392b' };

    list.innerHTML = entries.map(e => `
      <div class="entry-card" onclick="openEntry(${e.id})">
        <div class="entry-card-top">
          <span class="entry-card-date">${e.date}</span>
          ${e.mood ? `<span class="mood-badge ${e.mood} entry-card-mood">
            ${e.mood.charAt(0).toUpperCase() + e.mood.slice(1)}
          </span>` : ''}
        </div>
        <p class="entry-card-preview">${e.content}</p>
        <div class="entry-card-words">${e.word_count} words</div>
      </div>`).join('');
  }

  function renderStreak(entries) {
    const bar = document.getElementById('streakBar');
    if (!bar) return;
    let streak = 0;
    const today = new Date();
    const dates = new Set(entries.map(e => e.date));
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const label = d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
      if (dates.has(label)) streak++;
      else break;
    }
    bar.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#2d7a5f)" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="var(--accent,#2d7a5f)"/></svg>
      <div><span class="streak-num">${streak}</span></div>
      <div style="font-size:0.78rem;color:var(--text-muted)">day journaling streak</div>`;
  }

  // ── OPEN ENTRY ──
  window.openEntry = function(id) {
    currentEntry = allEntries.find(e => e.id === id);
    if (!currentEntry) return;

    document.getElementById('detailDate').textContent    = currentEntry.date;
    document.getElementById('detailContent').textContent = currentEntry.content;
    document.getElementById('detailWords').textContent   = `${currentEntry.word_count} words`;

    const moodEl = document.getElementById('detailMood');
    moodEl.innerHTML = currentEntry.mood
      ? `<span class="mood-badge ${currentEntry.mood}">${currentEntry.mood.charAt(0).toUpperCase() + currentEntry.mood.slice(1)}</span>`
      : '';

    document.getElementById('deleteEntryBtn').onclick = () => deleteEntry(id);

    document.getElementById('entriesView').classList.add('hidden');
    document.getElementById('detailView').classList.remove('hidden');
  };

  // ── EDIT ENTRY ──
  window.editEntry = function() {
    if (!currentEntry) return;
    document.getElementById('journalTextarea').value = currentEntry.content;
    currentEntryId = currentEntry.id;
    updateWordCount();
    document.getElementById('detailView').classList.add('hidden');
    document.getElementById('writeView').classList.remove('hidden');
  };

  // ── DELETE ENTRY ──
  async function deleteEntry(id) {
    if (!confirm('Delete this journal entry? This cannot be undone.')) return;
    try {
      await fetch(`/api/journal/${id}/delete/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': getCookie('csrftoken') },
      });
      showEntries();
    } catch(e) { alert('Could not delete entry.'); }
  }

  // ── HELPER ──
  function getCookie(name) {
    let value = `; ${document.cookie}`;
    let parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }
});