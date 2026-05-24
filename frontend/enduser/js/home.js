document.addEventListener('DOMContentLoaded', () => {

  // ── ELEMENTS ──
  const moodBtns    = document.querySelectorAll('.mood-btn');
  const checkinCard = document.querySelector('.checkin-card');

  let selectedMood = null;
  let selectedChip = null;

  // ── INIT ──
  loadMoodHistory();
  loadLiteracy();
  checkAlreadyCheckedIn();

  // ── CHECK IF ALREADY CHECKED IN TODAY ──
  async function checkAlreadyCheckedIn() {
    try {
      const res  = await fetch('/api/mood-chips/?mood=calm');
      const data = await res.json();
      if (data.already_checked_in) {
        disableMoodButtons(data.message);
        loadChatHistory();
      }
    } catch (err) {
      console.log('Could not check status');
    }
  }

  function disableMoodButtons(message) {
    moodBtns.forEach(b => {
      b.disabled = true;
      b.style.opacity = '0.45';
      b.style.cursor  = 'not-allowed';
    });
    if (!document.querySelector('.chat-box')) {
      initChatBox();
    }
    showContinuedInput();
  }

  // ── MOOD BUTTON CLICK ──
  moodBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;

      moodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMood = btn.dataset.mood.toLowerCase();
      selectedChip = null;

      removeChips();
      removeInput();
      removeChatBox();

      appendChomiMessage('Chomi is thinking...', true);

      try {
        const res  = await fetch(`/api/mood-chips/?mood=${selectedMood}`);
        const data = await res.json();

        if (data.already_checked_in) {
          removeChatBox();
          disableMoodButtons(data.message);
          loadChatHistory();
          return;
        }

        removeChatBox();
        initChatBox();
        appendChomiMessage(data.followup);
        showChips(data.chips);
        showInput();
        loadMoodHistory();

      } catch (err) {
        removeChatBox();
        initChatBox();
        appendChomiMessage("I'm here with you. Tell me what's on your mind.");
        showInput();
      }
    });
  });

  // ── CHAT BOX ──
  function initChatBox() {
    removeChatBox();
    const box = document.createElement('div');
    box.className = 'chat-box';

    const sep = document.createElement('div');
    sep.className   = 'chat-date-sep';
    sep.textContent = formatDate(new Date());
    box.appendChild(sep);

    checkinCard.appendChild(box);
  }

  function removeChatBox() {
    document.querySelector('.chat-box')?.remove();
  }

  function appendChomiMessage(text, loading = false, existingTime = null) {
    let box = document.querySelector('.chat-box');
    if (!box) { initChatBox(); box = document.querySelector('.chat-box'); }

    const wrap = document.createElement('div');
    wrap.className = 'chat-msg-wrap chomi';

    const bubble = document.createElement('div');
    bubble.className = loading ? 'chat-bubble chomi loading' : 'chat-bubble chomi';
    bubble.innerHTML = formatText(text);

    const time = document.createElement('span');
    time.className   = 'chat-time';
    time.textContent = existingTime || formatTime(new Date());

    wrap.appendChild(bubble);
    wrap.appendChild(time);
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
  }

  function appendUserMessage(text, existingTime = null) {
    let box = document.querySelector('.chat-box');
    if (!box) { initChatBox(); box = document.querySelector('.chat-box'); }

    const wrap = document.createElement('div');
    wrap.className = 'chat-msg-wrap user';

    const bubble = document.createElement('div');
    bubble.className   = 'chat-bubble user';
    bubble.textContent = text;

    const time = document.createElement('span');
    time.className   = 'chat-time';
    time.textContent = existingTime || formatTime(new Date());

    wrap.appendChild(bubble);
    wrap.appendChild(time);
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
  }

  // ── SHOW CHIPS ──
  function showChips(chips) {
    removeChips();
    const wrap = document.createElement('div');
    wrap.className = 'chip-wrap';
    chips.forEach(chip => {
      const btn = document.createElement('button');
      btn.className   = 'chip-btn';
      btn.textContent = chip;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        selectedChip = chip;
      });
      wrap.appendChild(btn);
    });
    checkinCard.appendChild(wrap);
  }

  function removeChips() {
    document.querySelector('.chip-wrap')?.remove();
  }

  // ── SHOW INPUT (first check-in submission) ──
  function showInput() {
    removeInput();
    const wrap = document.createElement('div');
    wrap.className = 'checkin-input-wrap';
    wrap.innerHTML = `
      <textarea class="checkin-textarea" placeholder="Or tell me in your own words..." rows="2"></textarea>
      <button class="checkin-submit-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>`;
    wrap.querySelector('.checkin-submit-btn').addEventListener('click', submitCheckin);
    checkinCard.appendChild(wrap);
  }

  // ── SHOW CONTINUED INPUT (all day chat after check-in) ──
  function showContinuedInput() {
    removeInput();
    const wrap = document.createElement('div');
    wrap.className = 'checkin-input-wrap';
    wrap.innerHTML = `
      <textarea class="checkin-textarea" placeholder="Keep chatting with Chomi..." rows="2"></textarea>
      <button class="checkin-submit-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>`;
    wrap.querySelector('.checkin-submit-btn').addEventListener('click', sendContinuedMessage);
    checkinCard.appendChild(wrap);
  }

  function removeInput() {
    document.querySelector('.checkin-input-wrap')?.remove();
  }

  // ── SUBMIT CHECK-IN (first message of the day) ──
  async function submitCheckin() {
    const textarea = document.querySelector('.checkin-textarea');
    const message  = textarea?.value.trim() || '';
    const chip     = selectedChip || '';

    if (!selectedMood) return;
    if (!message && !chip) return;

    const displayMsg = chip && message ? `${chip} — ${message}` : chip || message;
    appendUserMessage(displayMsg);

    removeInput();
    removeChips();
    appendChomiMessage('Chomi is responding...', true);

    try {
      const res = await fetch('/api/checkin/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken':  getCookie('csrftoken'),
        },
        body: JSON.stringify({
          mood:          selectedMood,
          chip_selected: chip,
          user_message:  message,
        }),
      });

      if (res.status === 400) {
        const loadingBubble = document.querySelector('.chat-bubble.loading');
        if (loadingBubble) {
          loadingBubble.classList.remove('loading');
          loadingBubble.textContent = "You've already checked in today — but keep talking to me!";
        }
        moodBtns.forEach(b => {
          b.disabled = true;
          b.style.opacity = '0.45';
          b.style.cursor  = 'not-allowed';
        });
        showContinuedInput();
        return;
      }

      const data = await res.json();

      const loadingBubble = document.querySelector('.chat-bubble.loading');
      if (loadingBubble) {
        loadingBubble.classList.remove('loading');
        loadingBubble.innerHTML = formatText(data.ai_response);
        loadingBubble.closest('.chat-box').scrollTop = 99999;
      }

      // Lock mood buttons but keep chat open all day
      moodBtns.forEach(b => {
        b.disabled = true;
        b.style.opacity = '0.45';
        b.style.cursor  = 'not-allowed';
      });

      showContinuedInput();
      loadLiteracy();
      loadMoodHistory();

    } catch (err) {
      const loadingBubble = document.querySelector('.chat-bubble.loading');
      if (loadingBubble) {
        loadingBubble.classList.remove('loading');
        loadingBubble.textContent = "Thank you for sharing. I'm here with you.";
      }
      showContinuedInput();
    }
  }

  // ── SEND CONTINUED MESSAGE (all day chat) ──
  async function sendContinuedMessage() {
    const textarea = document.querySelector('.checkin-textarea');
    const message  = textarea?.value.trim() || '';
    if (!message) return;

    appendUserMessage(message);
    textarea.value = '';
    appendChomiMessage('Chomi is responding...', true);

    try {
      const res = await fetch('/api/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken':  getCookie('csrftoken'),
        },
        body: JSON.stringify({ user_message: message }),
      });

      const data = await res.json();
      const loadingBubble = document.querySelector('.chat-bubble.loading');
      if (loadingBubble) {
        loadingBubble.classList.remove('loading');
        loadingBubble.innerHTML = formatText(data.ai_response);
        loadingBubble.closest('.chat-box').scrollTop = 99999;
      }
    } catch (err) {
      const loadingBubble = document.querySelector('.chat-bubble.loading');
      if (loadingBubble) {
        loadingBubble.classList.remove('loading');
        loadingBubble.textContent = "I'm here with you.";
      }
    }
  }

  // ── LOAD CHAT HISTORY ──
  async function loadChatHistory() {
    try {
      const res  = await fetch('/api/chat-history/');
      const data = await res.json();
      if (!data.messages.length) return;

      data.messages.forEach(msg => {
        if (msg.sender === 'user') {
          appendUserMessage(msg.message, msg.time);
        } else {
          appendChomiMessage(msg.message, false, msg.time);
        }
      });

      // Scroll to bottom after loading history
      const box = document.querySelector('.chat-box');
      if (box) box.scrollTop = box.scrollHeight;

    } catch (err) {
      console.log('Could not load chat history');
    }
  }

  // ── LOAD MOOD HISTORY ──
  async function loadMoodHistory() {
    try {
      const res  = await fetch('/api/mood-history/');
      const data = await res.json();
      const bars = document.querySelectorAll('.mini-chart .bar');
      const maxScore = 5;

      data.history.forEach((day, i) => {
        if (bars[i]) {
          const pct = day.score > 0 ? (day.score / maxScore) * 100 : 8;
          bars[i].style.height = pct + '%';
          bars[i].classList.toggle('hi', day.score >= 4);
          bars[i].title = day.mood ? `${day.day}: ${day.mood}` : `${day.day}: No check-in`;
        }
      });

      const dayLabels = document.querySelectorAll('.chart-days span');
      data.history.forEach((day, i) => {
        if (dayLabels[i]) dayLabels[i].textContent = day.day;
      });

    } catch (err) {
      console.log('Could not load mood history');
    }
  }

  // ── LOAD LITERACY ──
  async function loadLiteracy() {
    try {
      const res  = await fetch('/api/literacy/');
      const data = await res.json();
      const list = document.querySelector('.literacy-list');
      if (!list || !data.recommendations.length) return;

      const icons = ['c-pink', 'c-green', 'c-purple', 'c-blue'];
      const svgs  = [
        '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
        '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      ];

      list.innerHTML = data.recommendations.map((rec, i) => `
        <div class="lit-card">
          <div class="lit-icon ${icons[i % icons.length]}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${svgs[i % svgs.length]}</svg>
          </div>
          <div><h4>${rec.title}</h4><p>${rec.summary}</p></div>
        </div>`).join('');
    } catch (err) {
      console.log('Could not load literacy');
    }
  }

  // ── HELPERS ──
  function formatText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(date) {
    const today     = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString())     return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' });
  }

  function getCookie(name) {
    let value = `; ${document.cookie}`;
    let parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }
});