// ===== INBOX =====
document.addEventListener('DOMContentLoaded', () => {

  // ── STATE ──
  let activeConvoId   = null;
  let activeUserId    = null;
  let activeMode      = null;
  let profileUserId   = null;
  let searchTimeout   = null;

  // ── VOICE STATE ──
  let recognition     = null;
  let isListening     = false;
  let isSpeaking      = false;
  let selectedVoice   = 'feminine';
  let availableVoices = [];
  let mouthTimer      = null;
  let typeTimer       = null;
  const synth         = window.speechSynthesis;

  const chatWindow     = document.getElementById('chatWindow');
  const chatEmpty      = document.getElementById('chatEmpty');
  const chatHeader     = document.getElementById('chatHeader');
  const chatMessages   = document.getElementById('chatMessages');
  const chatInputArea  = document.getElementById('chatInputArea');
  const chatTextarea   = document.getElementById('chatTextarea');
  const chatSendBtn    = document.getElementById('chatSendBtn');
  const chatWinName    = document.getElementById('chatWinName');
  const chatWinSub     = document.getElementById('chatWinSub');
  const chatWinAvatar  = document.getElementById('chatWinAvatar');
  const chatProfileBtn = document.getElementById('chatProfileBtn');
  const voicePanel     = document.getElementById('voicePanel');

  // ── BLUE CHECK SVG ──
  const blueCheckSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01" stroke="white" stroke-width="2.5"/></svg>`;

  // ── INIT ──
  loadConversations();
  setupSpeechRecognition();
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }

  // ════════════════════════════════════════
  // VOICE
  // ════════════════════════════════════════
  function loadVoices() { availableVoices = synth.getVoices(); }

  function setupSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    recognition = new SR();
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-ZA';
    recognition.onstart  = () => { isListening = true; setVoiceState('listening'); };
    recognition.onresult = (e) => { const t = e.results[0][0].transcript; isListening = false; addTranscript(t, 'me'); sendToChomi(t); };
    recognition.onerror  = () => { isListening = false; setVoiceState('idle'); };
    recognition.onend    = () => { if (isListening) { isListening = false; setVoiceState('idle'); } };
  }

  window.openChomiVoice = function() {
    activeMode = 'voice';
    setActiveItem(document.getElementById('chomiItem'));
    chatEmpty.style.display     = 'none';
    chatHeader.style.display    = 'none';
    chatMessages.style.display  = 'none';
    chatInputArea.style.display = 'none';
    voicePanel.style.display    = 'flex';
    voicePanel.classList.add('open');
    chatWindow.classList.add('open');
    setVoiceState('idle');
    setTimeout(() => speakChomi("Hey! I'm Chomi, your mental wellness companion. How are you feeling today? Tap the mic and talk to me."), 600);
  };

  window.closeVoice = function() {
    synth?.cancel(); stopTalking(); isListening = false; recognition?.stop();
    voicePanel.classList.remove('open'); voicePanel.style.display = 'none';
    chatWindow.classList.remove('open'); chatEmpty.style.display = 'flex';
  };

  window.toggleMic = function() {
    if (isSpeaking) return;
    if (isListening) { recognition?.stop(); isListening = false; setVoiceState('idle'); }
    else {
      if (!recognition) { alert('Voice not supported. Please use Chrome.'); return; }
      recognition.start();
    }
  };

  async function sendToChomi(text) {
    setVoiceState('thinking');
    try {
      const res  = await fetch('/api/inbox-chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      const reply = data.response || "I'm here with you.";
      addTranscript(reply, 'them');
      speakChomi(reply);
    } catch { speakChomi("Sorry, I had trouble connecting. Please try again."); }
  }

  function speakChomi(text) {
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*/g, '').replace(/\n/g, ' ')
      .replace(/[\u{1F300}-\u{1FFFF}]/gu, '').replace(/[\u2600-\u27BF]/gu, '').trim();
    isSpeaking = true; setVoiceState('speaking'); typeInBubble(clean);
    synth?.cancel();
    const utt = new SpeechSynthesisUtterance(clean);
    const v = pickVoice(selectedVoice); if (v) utt.voice = v;
    if (selectedVoice === 'feminine')       { utt.pitch = 1.3; utt.rate = 1.05; }
    else if (selectedVoice === 'masculine') { utt.pitch = 0.75; utt.rate = 0.95; }
    else                                    { utt.pitch = 1.0; utt.rate = 1.0; }
    utt.volume = 1;
    utt.onstart = () => startTalking();
    utt.onend   = () => { isSpeaking = false; stopTalking(); setVoiceState('idle'); };
    utt.onerror = () => { isSpeaking = false; stopTalking(); setVoiceState('idle'); };
    synth?.speak(utt);
  }

  function pickVoice(cat) {
    const pool = (availableVoices.filter(v => v.lang.startsWith('en')).length ? availableVoices.filter(v => v.lang.startsWith('en')) : availableVoices);
    if (cat === 'feminine')  { const f = pool.find(v => ['female','woman','samantha','karen','moira','tessa','fiona','zira','susan','allison','ava'].some(n => v.name.toLowerCase().includes(n))); if (f) return f; }
    if (cat === 'masculine') { const m = pool.find(v => ['male','man','daniel','alex','fred','tom','david','mark'].some(n => v.name.toLowerCase().includes(n))); if (m) return m; }
    return pool[0] || null;
  }

  const mouthShapes = ["M 88 78 Q 100 86 112 78","M 88 78 Q 100 90 112 78","M 88 80 Q 100 84 112 80","M 88 78 Q 100 88 112 78","M 90 80 Q 100 82 110 80"];
  function startTalking() {
    if (mouthTimer) clearInterval(mouthTimer); let i = 1;
    mouthTimer = setInterval(() => { const m = document.getElementById('botMouth'); if (m) m.setAttribute('d', mouthShapes[i++ % mouthShapes.length]); }, 120);
  }
  function stopTalking() {
    if (mouthTimer) { clearInterval(mouthTimer); mouthTimer = null; }
    const m = document.getElementById('botMouth'); if (m) m.setAttribute('d', mouthShapes[0]);
  }
  function typeInBubble(text) {
    const el = document.getElementById('speechText'); if (!el) return;
    if (typeTimer) clearTimeout(typeTimer); el.textContent = ''; let i = 0;
    function step() { if (i < text.length) { el.textContent += text[i++]; typeTimer = setTimeout(step, 30); } }
    step();
  }
  function setVoiceState(state) {
    const micBtn = document.getElementById('micBtn'); if (!micBtn) return;
    const micIcon = document.getElementById('micIcon'), stopIcon = document.getElementById('stopIcon');
    const dot = document.getElementById('statusDot'), label = document.getElementById('statusLabel');
    const micLabel = document.getElementById('micLabel'), bubble = document.getElementById('speechText');
    const botBody = document.getElementById('botBody'), botArm = document.getElementById('botArm');
    micBtn.className = 'mic-btn'; if (dot) dot.className = 'voice-status-dot';
    if (state === 'listening') {
      micBtn.classList.add('listening'); if (dot) dot.classList.add('listening');
      if (label) label.textContent = 'Listening...'; if (micLabel) micLabel.textContent = 'Tap to stop';
      if (bubble) bubble.textContent = '...'; micIcon.style.display = 'none'; stopIcon.style.display = '';
      if (botBody) botBody.style.animation = 'botListen 1s ease-in-out infinite';
      if (botArm)  botArm.style.animation  = 'none';
    } else if (state === 'speaking') {
      micBtn.classList.add('speaking'); if (dot) dot.classList.add('speaking');
      if (label) label.textContent = 'Chomi is speaking...'; if (micLabel) micLabel.textContent = 'Please wait';
      micIcon.style.display = ''; stopIcon.style.display = 'none';
      if (botBody) botBody.style.animation = 'botSpeak 0.4s ease-in-out infinite alternate';
      if (botArm)  botArm.style.animation  = 'botWave 1.4s ease-in-out infinite';
    } else if (state === 'thinking') {
      if (label) label.textContent = 'Thinking...'; if (micLabel) micLabel.textContent = 'Please wait';
      if (bubble) bubble.textContent = '...'; micIcon.style.display = ''; stopIcon.style.display = 'none';
    } else {
      if (dot) dot.classList.add('idle'); if (label) label.textContent = 'Ready';
      if (micLabel) micLabel.textContent = 'Tap to speak';
      if (bubble && bubble.textContent === '...') bubble.textContent = 'Tap the mic to start talking';
      micIcon.style.display = ''; stopIcon.style.display = 'none';
      if (botBody) botBody.style.animation = 'botIdle 3s ease-in-out infinite';
      if (botArm)  botArm.style.animation  = 'botWave 1.4s ease-in-out infinite';
    }
  }
  function addTranscript(text, sender) {
    const t = document.getElementById('voiceTranscript'); if (!t) return;
    const wrap = document.createElement('div'); wrap.className = `vt-wrap ${sender}`;
    const b    = document.createElement('div'); b.className = `vt-bubble ${sender}`; b.textContent = text;
    const tm   = document.createElement('div'); tm.className = 'vt-time'; tm.textContent = formatTime(new Date());
    wrap.appendChild(b); wrap.appendChild(tm); t.appendChild(wrap); t.scrollTop = t.scrollHeight;
  }
  document.querySelectorAll('.voice-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.voice-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); selectedVoice = btn.dataset.voice;
    });
  });

  // ════════════════════════════════════════
  // SEARCH — with verified badge
  // ════════════════════════════════════════
  const searchInput   = document.getElementById('inboxSearch');
  const searchClear   = document.getElementById('searchClear');
  const searchResults = document.getElementById('searchResults');

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    searchClear.style.display = q ? '' : 'none';
    clearTimeout(searchTimeout);
    if (q.length < 1) { searchResults.style.display = 'none'; return; }
    searchTimeout = setTimeout(() => searchUsers(q), 300);
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = ''; searchClear.style.display = 'none'; searchResults.style.display = 'none';
  });

  async function searchUsers(q) {
    try {
      const res  = await fetch(`/api/search-users/?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const list = document.getElementById('searchList');
      searchResults.style.display = '';
      if (!data.users.length) {
        list.innerHTML = `<div class="search-no-results">No account found matching "<strong>${q}</strong>"</div>`;
        return;
      }
      list.innerHTML = data.users.map(u => `
        <div class="search-result-item" onclick="openUserProfile(${u.id})">
          <div class="avatar ${avatarColor(u.id)}" style="width:38px;height:38px;font-size:0.8rem">${u.initials}</div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <div class="search-result-name" style="display:flex;align-items:center;gap:4px;">
              ${u.name}
              ${u.is_verified ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="var(--accent)" stroke="none"><circle cx="12" cy="12" r="10" fill="var(--accent)"/><polyline points="9 12 11 14 15 10" stroke="white" stroke-width="2" fill="none"/></svg>` : ''}
            </div>
            <div class="search-result-sub">${u.email || 'Chomi member'}</div>
          </div>
        </div>`).join('');
    } catch (err) { console.log('Search error', err); }
  }

  // ════════════════════════════════════════
  // CONVERSATIONS
  // ════════════════════════════════════════
  async function loadConversations() {
    try {
      const res  = await fetch('/api/conversations/');
      const data = await res.json();
      const container = document.getElementById('userConvos');
      if (!data.conversations.length) {
        container.innerHTML = '<p style="font-size:0.78rem;color:var(--text-light);padding:1rem 1.25rem">No conversations yet. Search for someone to start chatting!</p>';
        return;
      }
      container.innerHTML = data.conversations.map(c => `
        <div class="chat-item" onclick="openUserChat(${c.id}, ${c.other_id}, '${c.name}', '${c.initials}', ${c.is_anon})">
          <div class="avatar ${avatarColor(c.other_id)}">${c.initials}</div>
          <div class="chat-info">
            <p class="chat-name" style="display:flex;align-items:center;gap:4px;">
              ${c.name}
              ${c.is_verified ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="var(--accent)" stroke="none"><circle cx="12" cy="12" r="10" fill="var(--accent)"/><polyline points="9 12 11 14 15 10" stroke="white" stroke-width="2" fill="none"/></svg>` : ''}
            </p>
            <p class="chat-preview">${c.last_msg}</p>
          </div>
          <div class="chat-meta">
            <span class="chat-time">${c.time}</span>
            ${c.unread > 0 ? `<span class="badge">${c.unread}</span>` : ''}
          </div>
        </div>`).join('');
    } catch (err) { console.log('Could not load conversations', err); }
  }

  // ════════════════════════════════════════
  // USER CHAT
  // ════════════════════════════════════════
  window.openUserChat = function(convoId, userId, name, initials, isAnon) {
    activeMode = 'user'; activeConvoId = convoId; activeUserId = userId;
    if (voicePanel) { synth?.cancel(); voicePanel.style.display = 'none'; voicePanel.classList.remove('open'); }
    setActiveItem(document.querySelector(`[onclick*="openUserChat(${convoId}"]`));
    showChatWindow(name, isAnon ? 'Anonymous user' : 'Chomi member', getAvatarBg(userId), initials, !isAnon);
    chatMessages.innerHTML = ''; appendDateSep('Today'); loadMessages(convoId);
  };

  async function loadMessages(convoId) {
    try {
      const res  = await fetch(`/api/conversations/${convoId}/messages/`);
      const data = await res.json();
      data.messages.forEach(m => {
        if (m.is_me) appendMeBubble(m.content, m.time);
        else appendThemBubble(m.content, m.time);
      });
    } catch (err) { console.log('Could not load messages'); }
  }

  window.openUserProfile = function(userId) { profileUserId = userId; fetchAndShowProfile(userId); };

  async function fetchAndShowProfile(userId) {
    try {
      const res  = await fetch(`/api/user-profile/${userId}/`);
      const data = await res.json();
      document.getElementById('modalAvatar').style.background = getAvatarBg(data.id);
      document.getElementById('modalAvatar').textContent      = data.initials;

      // Name with verified badge
      const nameEl = document.getElementById('modalName');
      nameEl.innerHTML = data.is_verified
        ? `${data.name} <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--accent)" stroke="none" style="vertical-align:middle"><circle cx="12" cy="12" r="10" fill="var(--accent)"/><polyline points="9 12 11 14 15 10" stroke="white" stroke-width="2" fill="none"/></svg>`
        : data.name;

      document.getElementById('modalSub').textContent  = data.is_anon ? 'Anonymous · Identity hidden' : `Member since ${data.joined}`;
      document.getElementById('modalStats').innerHTML  = `
        <div class="user-stat"><div class="profile-stat-val">${data.checkins}</div><div class="profile-stat-lbl">Check-ins</div></div>
        <div class="user-stat"><div class="profile-stat-val">${data.joined}</div><div class="profile-stat-lbl">Joined</div></div>`;
      document.getElementById('modalMsgBtn').onclick   = () => startChatWithUser(data);
      document.getElementById('profileOverlay').classList.add('visible');
    } catch (err) { console.log('Could not load profile'); }
  }

  async function startChatWithUser(user) {
    closeProfileModal(null, true);
    searchInput.value = ''; searchClear.style.display = 'none'; searchResults.style.display = 'none';
    activeMode = 'user'; activeUserId = user.id; activeConvoId = null;
    showChatWindow(user.name, user.is_anon ? 'Anonymous user' : 'Chomi member', getAvatarBg(user.id), user.initials, !user.is_anon);
    chatMessages.innerHTML = ''; appendDateSep('Today');
  }

  chatSendBtn.addEventListener('click', sendMessage);
  chatTextarea.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

  async function sendMessage() {
    const content = chatTextarea.value.trim(); if (!content) return;
    appendMeBubble(content); chatTextarea.value = '';
    try {
      const res  = await fetch('/api/send-message/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ other_id: activeUserId, conversation_id: activeConvoId, content }),
      });
      const data = await res.json();
      if (!activeConvoId) { activeConvoId = data.conversation_id; loadConversations(); }
    } catch (err) { console.log('Could not send message'); }
  }

  window.openProfileModal  = function() { if (activeUserId) fetchAndShowProfile(activeUserId); };
  window.closeProfileModal = function(e, force) {
    if (force || (e && e.target === document.getElementById('profileOverlay')))
      document.getElementById('profileOverlay').classList.remove('visible');
  };
  window.closeChat = function() { chatWindow.classList.remove('open'); };

  function showChatWindow(name, sub, avatarBg, initials, showProfile) {
    chatEmpty.style.display = 'none';
    if (voicePanel) { voicePanel.style.display = 'none'; voicePanel.classList.remove('open'); }
    chatWinAvatar.style.background = avatarBg || '#2d7a5f';
    chatWinAvatar.textContent      = initials  || '?';
    chatWinName.textContent        = name      || '';
    chatWinSub.textContent         = sub       || '';
    chatProfileBtn.style.display   = showProfile ? 'flex' : 'none';
    chatHeader.removeAttribute('style'); chatHeader.style.display    = 'flex';
    chatMessages.removeAttribute('style'); chatMessages.style.display  = 'flex';
    chatInputArea.removeAttribute('style'); chatInputArea.style.display = 'flex';
    chatWindow.classList.add('open');
    setTimeout(() => chatTextarea.focus(), 300);
  }

  function setActiveItem(el) {
    document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
  }
  function appendDateSep(label) {
    const sep = document.createElement('div'); sep.className = 'msg-date-sep'; sep.textContent = label;
    chatMessages.appendChild(sep);
  }
  function appendMeBubble(text, time) {
    const wrap = document.createElement('div'); wrap.className = 'msg-wrap me';
    const bubble = document.createElement('div'); bubble.className = 'msg-bubble me'; bubble.innerHTML = formatText(text);
    const t = document.createElement('div'); t.className = 'msg-time'; t.textContent = time || formatTime(new Date());
    wrap.appendChild(bubble); wrap.appendChild(t); chatMessages.appendChild(wrap);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  function appendThemBubble(text, time, loading = false) {
    const wrap = document.createElement('div'); wrap.className = 'msg-wrap them';
    const bubble = document.createElement('div'); bubble.className = `msg-bubble them${loading ? ' loading' : ''}`; bubble.innerHTML = formatText(text);
    const t = document.createElement('div'); t.className = 'msg-time'; t.textContent = time || formatTime(new Date());
    wrap.appendChild(bubble); wrap.appendChild(t); chatMessages.appendChild(wrap);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  function formatText(text) { return String(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'); }
  function formatTime(date) { return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }); }
  const COLORS = ['#2d7a5f','#4a7ac8','#7b6ab0','#c0392b','#c99840','#1a7a6e'];
  function getAvatarBg(id)  { return COLORS[id % COLORS.length]; }
  function avatarColor(id)  { const cls = ['c-green','c-blue','c-purple','c-pink','c-gold']; return cls[id % cls.length]; }
  function getCookie(name)  {
    let value = `; ${document.cookie}`;
    let parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }
});