// script.js - Final receive-only version
const SERVER_URL = "https://sms-dashboard-1igl.onrender.com";
const socket = io(SERVER_URL);

const attMessages = document.getElementById('att-messages');
const verizonMessages = document.getElementById('verizon-messages');

function addMessageToList(phoneId, message) {
    const list = phoneId === 'AT&T' ? attMessages : verizonMessages;
    if (!list) return;

    const item = document.createElement('li');
    item.className = 'message-item';
    const time = new Date(message.timestamp).toLocaleTimeString('en-US');

    let messageHTML = `
        <div class="from">From: ${message.from}</div>
        <div class="body">${message.body || ''}</div>
        <div class="time">${time}</div>
    `;
    if (message.imageUrl) {
        messageHTML += `<img src="${SERVER_URL}${message.imageUrl}" class="mms-image" alt="MMS Image">`;
    }
    item.innerHTML = messageHTML;
    list.prepend(item);
}

socket.on('all_messages', (messagesByPhone) => {
    if (attMessages) attMessages.innerHTML = '';
    if (verizonMessages) verizonMessages.innerHTML = '';
    
    if (messagesByPhone['AT&T']) {
        messagesByPhone['AT&T'].forEach(msg => addMessageToList('AT&T', msg));
    }
    if (messagesByPhone['Verizon']) {
        messagesByPhone['Verizon'].forEach(msg => addMessageToList('Verizon', msg));
    }
});

socket.on('new_message', (message) => {
    addMessageToList(message.phoneId, message);
});

console.log("Dashboard script loaded. Connecting to server...");
