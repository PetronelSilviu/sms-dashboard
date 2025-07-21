// New, updated script.js
const SERVER_URL = "https://sms-dashboard-1igl.onrender.com"; // Make sure this is your correct URL
const socket = io(SERVER_URL);

// 1. Get the HTML lists using their NEW IDs
const attMessages = document.getElementById('att-messages');
const verizonMessages = document.getElementById('verizon-messages');

// This function creates and adds a message item to the correct list
function addMessageToList(phoneId, message) {
    // 2. Decide which list to add the message to based on the NEW phoneId
    const list = phoneId === 'AT&T' ? attMessages : verizonMessages;
    
    // Make sure the list was found before trying to add to it
    if (!list) return;

    const item = document.createElement('li');
    item.className = 'message-item';
    
    const time = new Date(message.timestamp).toLocaleTimeString('en-US');

    item.innerHTML = `
        <div class="from">From: ${message.from}</div>
        <div class="body">${message.body}</div>
        <div class="time">${time}</div>
    `;
    
    list.prepend(item);
}


// When first connecting, load all historical messages
socket.on('all_messages', (messagesByPhone) => {
    // Clear any existing messages
    if(attMessages) attMessages.innerHTML = '';
    if(verizonMessages) verizonMessages.innerHTML = '';
    
    // 3. Populate messages using the NEW names
    if (messagesByPhone.AT_T) { // Note: Server might send AT&T as AT_T
        messagesByPhone.AT_T.forEach(msg => addMessageToList('AT&T', msg));
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
