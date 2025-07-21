// New, updated script.js with image support
const SERVER_URL = "https://sms-dashboard-1igl.onrender.com"; // Make sure this is your correct URL
const socket = io(SERVER_URL);

const attMessages = document.getElementById('att-messages');
const verizonMessages = document.getElementById('verizon-messages');

function addMessageToList(phoneId, message) {
    const list = phoneId === 'AT&T' ? attMessages : verizonMessages;
    
    if (!list) return;

    const item = document.createElement('li');
    item.className = 'message-item';
    
    const time = new Date(message.timestamp).toLocaleTimeString('en-US');

    // Create the basic HTML for the message (from, body, time)
    let messageHTML = `
        <div class="from">From: ${message.from}</div>
        <div class="body">${message.body}</div>
        <div class="time">${time}</div>
    `;

    // **NEW:** Check if there is an image URL.
    if (message.imageUrl) {
        // If there is an image, add an <img> tag to the HTML.
        // The src will be the full URL to the image on our server.
        messageHTML += `<img src="${SERVER_URL}${message.imageUrl}" class="mms-image" alt="MMS Image">`;
    }

    item.innerHTML = messageHTML;
    list.prepend(item);
}

// When first connecting, load all historical messages
socket.on('all_messages', (messagesByPhone) => {
    if(attMessages) attMessages.innerHTML = '';
    if(verizonMessages) verizonMessages.innerHTML = '';
    
    if (messagesByPhone.AT&T) {
        messagesByPhone.AT&T.forEach(msg => addMessageToList('AT&T', msg));
    }
    if (messagesByPhone.Verizon) {
        messagesByPhone.Verizon.forEach(msg => addMessageToList('Verizon', msg));
    }
});

// When a new message arrives in real-time
socket.on('new_message', (message) => {
    addMessageToList(message.phoneId, message);
});

console.log("Dashboard script loaded. Connecting to server...");
