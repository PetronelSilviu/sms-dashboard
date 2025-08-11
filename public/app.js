const socket = io();
const messagesEl = document.getElementById('messages');
const refreshBtn = document.getElementById('refresh');

function renderMessage(m) {
  const el = document.createElement('div');
  el.className = 'message';
  const time = new Date(m.created_at).toLocaleString();
  el.innerHTML = `
    <div class="meta"><strong>${escapeHtml(m.phone_number)}</strong> <span class="time">${time}</span></div>
    <div class="body">${escapeHtml(m.body || '')}</div>
    ${m.media_path ? `<div class="media"><img src="${escapeAttr(m.media_path)}" alt="mms" /></div>` : ''}
  `;
  return el;
}

function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escapeAttr(s){ return (s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

async function loadMessages() {
  try {
    const res = await fetch('/api/messages?limit=50');
    const arr = await res.json();
    messagesEl.innerHTML = '';
    arr.forEach(m => messagesEl.appendChild(renderMessage(m)));
  } catch (err) {
    console.error(err);
  }
}

socket.on('message', (m) => {
  // prepend
  messagesEl.insertBefore(renderMessage(m), messagesEl.firstChild);
});

refreshBtn.addEventListener('click', loadMessages);

// initial load
loadMessages();
