// ===== SUPPORT =====
document.addEventListener('DOMContentLoaded', () => {

  // ── DIR BUTTONS ──
  document.querySelectorAll('.dir-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const name = btn.closest('.nearby-card')?.querySelector('.nearby-name')?.textContent?.trim();
      if (name) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`, '_blank');
    });
  });

  // ── PERSONAL CONTACTS ──
  const modal         = document.getElementById('contactModal');
  const openModalBtn  = document.getElementById('openModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const form          = document.getElementById('personalContactForm');
  const listContainer = document.getElementById('personalContactList');

  openModalBtn.addEventListener('click',  () => modal.style.display = 'flex');
  closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
  window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[tag]||tag));
  }

  function getCookie(name) {
    let value = `; ${document.cookie}`;
    let parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

  async function loadContacts() {
    try {
      const res  = await fetch('/api/emergency-contacts/');
      const data = await res.json();
      renderContacts(data.contacts || []);
    } catch { renderContacts([]); }
  }

  function renderContacts(contacts) {
    listContainer.innerHTML = '';
    if (!contacts.length) {
      listContainer.innerHTML = '<div class="no-contacts">No speed dial contacts yet. Use "Add Emergency Contact" below to save someone you trust.</div>';
      return;
    }
    contacts.forEach(contact => {
      const card = document.createElement('div');
      card.className = 'personal-contact-card';
      card.innerHTML = `
        <div class="h-icon h-blue">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div class="hotline-info">
          <p class="hotline-name">${escapeHTML(contact.name)}</p>
          <p class="hotline-desc">Personal speed-dial</p>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <a href="tel:${escapeHTML(contact.phone)}" class="call-btn">${escapeHTML(contact.phone)}</a>
          <button class="delete-btn" data-id="${contact.id}" title="Remove contact">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>`;
      listContainer.appendChild(card);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          await fetch(`/api/emergency-contacts/${id}/delete/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
          });
          loadContacts();
        } catch { console.log('Could not delete contact'); }
      });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name  = document.getElementById('contactName').value.trim();
    const phone = document.getElementById('contactPhone').value.trim();
    if (!name || !phone) return;
    try {
      await fetch('/api/emergency-contacts/add/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ name, phone }),
      });
      document.getElementById('contactName').value  = '';
      document.getElementById('contactPhone').value = '';
      modal.style.display = 'none';
      loadContacts();
    } catch { console.log('Could not save contact'); }
  });

  loadContacts();

  // ── NEARBY SUPPORT ──
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  function renderNearbyCenters(centers, userLat, userLng) {
    const container = document.getElementById('nearbyDynamicList');
    if (!container) return;
    if (!centers?.length) {
      container.innerHTML = `<div class="error-message">No nearby mental health support found.<br><br>Please call SADAG: <strong>0800 456 789</strong><br><button onclick="location.reload()" class="retry-btn">Try Again</button></div>`;
      return;
    }
    container.innerHTML = '';
    centers.forEach(center => {
      const name    = center.name || center.business_name || 'Mental Health Support Centre';
      const address = center.address || center.full_address || 'Address available on map';
      const lat     = center.latitude  || center.lat;
      const lng     = center.longitude || center.lng;
      const phone   = center.phone || null;
      let distance  = '';
      if (lat && lng && userLat && userLng) {
        const km = haversineDistance(userLat, userLng, parseFloat(lat), parseFloat(lng));
        distance = km < 1 ? `${Math.round(km*1000)} m away` : `${km.toFixed(1)} km away`;
      }
      const mapsLink = lat && lng
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}+${encodeURIComponent(address)}`;

      const card = document.createElement('div');
      card.className = 'nearby-card';
      card.innerHTML = `
        <div class="h-icon h-purple">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div class="nearby-info">
          <p class="nearby-name">${escapeHTML(name)} ${distance?`<span class="distance-badge">${distance}</span>`:''}</p>
          <p class="nearby-addr">${escapeHTML(address.substring(0,80))}${address.length>80?'...':''}</p>
          ${phone?`<a href="tel:${escapeHTML(phone)}" class="phone-link"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.58 1.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.75a16 16 0 0 0 6.29 6.29l.87-1.87a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 15.42z"/></svg>${escapeHTML(phone)}</a>`:''}
        </div>
        <a href="${mapsLink}" target="_blank" rel="noopener noreferrer" class="dir-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>`;
      container.appendChild(card);
    });
  }

  async function getCityFromCoords(lat, lng) {
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`);
      const data = await res.json();
      return data.address.city || data.address.town || data.address.suburb || data.address.state || 'South Africa';
    } catch { return 'South Africa'; }
  }

  async function searchBizData(city, userLat, userLng) {
    const container = document.getElementById('nearbyDynamicList');
    container.innerHTML = `<div class="loading-spinner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Searching near ${escapeHTML(city)}...</div>`;

    const categories = ['hospital','doctor','pharmacy','clinic','healthcare','therapy'];
    let allResults = [];
    for (const cat of categories) {
      try {
        const res  = await fetch(`https://bizdata-web.vercel.app/api/businesses?location=${encodeURIComponent(city)}&category=${cat}&limit=20`);
        const data = await res.json();
        if (data.businesses?.length) {
          const keywords = ['mental','psych','counsel','therapy','wellness','health','clinic','hospital','medical','care'];
          allResults.push(...data.businesses.filter(b => keywords.some(k => (b.name||'').toLowerCase().includes(k)||(b.category||'').toLowerCase().includes(k))));
        }
      } catch { /* continue */ }
    }

    const unique = [], seen = new Set();
    for (const b of allResults) {
      const key = `${b.name}-${b.latitude}-${b.longitude}`;
      if (!seen.has(key)) { seen.add(key); unique.push(b); }
    }

    if (!unique.length) {
      container.innerHTML = `<div class="error-message">No mental health facilities found near ${escapeHTML(city)}.<br><br>Call SADAG: <strong>0800 456 789</strong><br><button onclick="location.reload()" class="retry-btn">Try Again</button></div>`;
      return;
    }

    const sorted = unique.map(p => ({...p, _dist:(p.latitude&&p.longitude)?haversineDistance(userLat,userLng,parseFloat(p.latitude),parseFloat(p.longitude)):9999})).sort((a,b)=>a._dist-b._dist).slice(0,6);
    renderNearbyCenters(sorted, userLat, userLng);
  }

  async function findNearbySupport() {
    const container = document.getElementById('nearbyDynamicList');
    container.innerHTML = `<div class="loading-spinner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Requesting your location...</div>`;
    if (!navigator.geolocation) {
      container.innerHTML = '<div class="error-message">Geolocation not supported. Call SADAG: 0800 456 789.</div>';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const city = await getCityFromCoords(pos.coords.latitude, pos.coords.longitude);
          await searchBizData(city, pos.coords.latitude, pos.coords.longitude);
        } catch {
          container.innerHTML = '<div class="error-message">Unable to fetch nearby resources. Call SADAG: 0800 456 789.<br><button onclick="location.reload()" class="retry-btn">Try Again</button></div>';
        }
      },
      (err) => {
        const msgs = {1:'Location access denied.',2:'Location unavailable.',3:'Location request timed out.'};
        container.innerHTML = `<div class="error-message">${msgs[err.code]||'Unable to get location.'} Call SADAG: <strong>0800 456 789</strong><br><button onclick="location.reload()" class="retry-btn">Try Again</button></div>`;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  findNearbySupport();
});