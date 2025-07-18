// script.js

// ==================  IMPORTANT: EDIT THIS LINE ==================
// Replace with your public Render server URL
const SERVER_URL = "https://your-dashboard-name.onrender.com";
// ================================================================

const socket = io(SERVER_URL);

// Get the lists where we will display messages
const phoneAMessages = document.getElementById('phone-a-messages');
const phoneBMessages = document.getElementById('phone-b-messages');

// A function to create and add a message to the UI
function addMessageToList(phoneId, message) {
    const list = phoneId === 'PhoneA' ? phoneAMessages : phoneBMessages;
    
    const item = document.createElement('li');
    item.className = 'message-item';
    
    // Format the timestamp to be readable
    const time = new Date(message.timestamp).toLocaleTimeString('en-US');

    item.innerHTML = `
        <div class="from">From: ${message.from}</div>
        <div class="body">${message.body}</div>
        <div class="time">${time}</div>
    `;
    
    // Add the new message to the top of the list
    list.prepend(item);
}


// Listen for the 'all_messages' event from the server
socket.on('all_messages', (messagesByPhone) => {
    // Clear any existing messages
    phoneAMessages.innerHTML = '';
    phoneBMessages.innerHTML = '';
    
    // Populate messages for Phone A
    if (messagesByPhone.PhoneA) {
        messagesByPhone.PhoneA.forEach(msg => addMessageToList('PhoneA', msg));
    }

    // Populate messages for Phone B
    if (messagesByPhone.PhoneB) {
        messagesByPhone.PhoneB.forEach(msg => addMessageToList('PhoneB', msg));
    }
});


// Listen for the 'new_message' event from the server
socket.on('new_message', (message) => {
    // Add the new message in real-time
    addMessageToList(message.phoneId, message);
});

console.log("Dashboard script loaded. Connecting to server...");
