// script.js - Final version with sending capabilities
const SERVER_URL = "https://sms-dashboard-1igl.onrender.com"; // Make sure this is your correct URL
const socket = io(SERVER_URL);

// --- Get elements for displaying messages ---
const attMessages = document.getElementById('att-messages');
const verizonMessages = document.getElementById('verizon-messages');

// --- Get elements for sending messages ---
const attRecipient = document.getElementById('att-recipient');
const attMessage = document.getElementById('att-message');
const attSendBtn = document.getElementById('att-send-btn');

const verizonRecipient = document.getElementById('verizon-recipient');
const verizonMessage = document.getElementById('verizon-message');
const verizonSendBtn = document.getElementById('verizon-send-btn');


// --- Function to send a message ---
async function sendMessage(phoneId, recipientInput, messageInput) {
    const recipientNumber = recipientInput.value.trim();
    const messageBody = messageInput.value.trim();

    if (!recipientNumber || !messageBody) {
        alert("Please enter a recipient and a message.");
        return;
    }

    // Send the data to our server's /send-message endpoint
    await fetch(`${SERVER_URL}/send-message`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            phoneId: phoneId,
            recipientNumber: recipientNumber,
            messageBody: messageBody
        }),
    });

    // Clear the input fields after sending
    recipientInput.value = '';
    messageInput.value = '';
    alert(`Send command issued from ${phoneId} phone!`);
}

// --- Add click listeners to the send buttons ---
attSendBtn.addEventListener('click', () => {
    sendMessage('AT&T', attRecipient, attMessage);
});

verizonSendBtn.addEventListener('click', () => {
    sendMessage('Verizon', verizonRecipient, verizonMessage);
});


// --- Functions for displaying received messages (remain the same) ---
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
