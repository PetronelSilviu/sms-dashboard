// Final script.js
const SERVER_URL = "https://sms-dashboard-1igl.onrender.com"; // Make sure this is your correct URL
const socket = io(SERVER_URL);

// Get the HTML lists using their correct IDs
const attMessages = document.getElementById('att-messages');
const verizonMessages = document.getElementById('verizon-messages');

// This function creates and adds a message item to the correct list
function addMessageToList(phoneId, message) {
    // Decide which list to add the message to based on the phoneId
    const list = phoneId === 'AT&T' ? attMessages : verizonMessages;
    
    if (!list) return; // Exit if the list element isn't found

    const item = document.createElement('li');
    item.className = 'message-item';
    
    const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false
});

    // Create the basic HTML for the message
    let messageHTML = `
        <div class="from">From: ${message.from}</div>
        <div class="body">${message.body || ''}</div>
        <div class="time">${time}</div>
    `;

    // Check if there is an image URL and add the image tag
    if (message.imageUrl) {
        messageHTML += `<img src="${SERVER_URL}${message.imageUrl}" class="mms-image" alt="MMS Image">`;
    }

    item.innerHTML = messageHTML;
    list.prepend(item);
}

// When first connecting, load all historical messages
socket.on('all_messages', (messagesByPhone) => {
    if(attMessages) attMessages.innerHTML = '';
    if(verizonMessages) verizonMessages.innerHTML = '';
    
    // Use bracket notation ['AT&T'] which is safer for keys with special characters
    if (messagesByPhone['AT&T']) {
        messagesByPhone['AT&T'].forEach(msg => addMessageToList('AT&T', msg));
    }
    if (messagesByPhone['Verizon']) {
        messagesByPhone['Verizon'].forEach(msg => addMessageToList('Verizon', msg));
    }
});

// When a new message arrives in real-time
socket.on('new_message', (message) => {
    addMessageToList(message.phoneId, message);
});

console.log("Dashboard script loaded. Connecting to server...");
