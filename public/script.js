// script.js - Final Dynamic Version
const SERVER_URL = "https://sms-dashboard-1igl.onrender.com";
const socket = io(SERVER_URL);

const mainContainer = document.getElementById('dashboard-main');

// --- Functions to dynamically create and manage the dashboard ---

// Creates a new column for a phone number if it doesn't exist
function createColumnForPhone(phoneId) {
    // Check if a column for this phoneId already exists
    if (document.getElementById(`col-${phoneId}`)) {
        return; // Do nothing if it's already there
    }

    // Create the column elements
    const column = document.createElement('div');
    column.className = 'phone-column';
    column.id = `col-${phoneId}`;

    const title = document.createElement('h2');
    title.textContent = phoneId; // The title is now the phone number

    const messageList = document.createElement('ul');
    messageList.className = 'message-list';
    messageList.id = `list-${phoneId}`;

    column.appendChild(title);
    column.appendChild(messageList);
    
    // Add the new column to the main container
    mainContainer.appendChild(column);
}

// Adds a message to the correct phone number's list
function addMessageToList(phoneId, message) {
    // First, ensure a column exists for this phone number
    createColumnForPhone(phoneId);
    
    const list = document.getElementById(`list-${phoneId}`);
    if (!list) return;

    const item = document.createElement('li');
    item.className = 'message-item';
    
    const time = new Date(message.timestamp).toLocaleTimeString('ro-RO', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hour12: false
    });

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

// --- Socket.IO Event Handlers ---

// When first connecting, build the entire dashboard from historical data
socket.on('all_messages', (messagesByPhone) => {
    mainContainer.innerHTML = ''; // Clear the dashboard
    
    // Get all the phone numbers (the keys of the object)
    const phoneIds = Object.keys(messagesByPhone);

    // For each phone number, create a column and add its messages
    phoneIds.forEach(phoneId => {
        createColumnForPhone(phoneId);
        const messages = messagesByPhone[phoneId];
        messages.forEach(msg => addMessageToList(phoneId, msg));
    });
});

// When a new message arrives in real-time
socket.on('new_message', (message) => {
    addMessageToList(message.phoneId, message);
});

console.log("Dashboard script loaded. Connecting to server...");
