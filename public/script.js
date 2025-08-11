// script.js - Final version with sending capabilities
const SERVER_URL = "https://sms-dashboard-1igl.onrender.com"; // Make sure this is your correct URL
const socket = io(SERVER_URL);

// --- Get elements for displaying messages ---
const phoneSelector = document.getElementById('phone-selector');
const contentArea = document.getElementById('content-area');
const messageList = document.getElementById('message-list');

// --- Get elements for sending messages ---
const recipientInput = document.getElementById('recipient-input');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// This object will hold all messages, sorted by phone number
let allMessages = {};

// --- Functions to build the dynamic interface ---

// Fetches the list of phone numbers and populates the dropdown
async function initializePhoneSelector() {
    try {
        const response = await fetch(`${SERVER_URL}/api/phones`);
        const phoneNumbers = await response.json();

        // ADD THIS LINE FOR DEBUGGING
        console.log('Data from server:', phoneNumbers); 

        // Save the currently selected value
        const currentSelection = phoneSelector.value;
        
        phoneSelector.innerHTML = '<option value="">-- Select a Phone --</option>'; // Clear "Loading..."

        phoneNumbers.forEach(number => {
            const option = document.createElement('option');
            option.value = number;
            option.textContent = number;
            phoneSelector.appendChild(option);
        });
        
        // Restore the selection if it still exists
        if (phoneNumbers.includes(currentSelection)) {
            phoneSelector.value = currentSelection;
        }

    } catch (error) {
        phoneSelector.innerHTML = '<option>Error loading phones</option>';
        console.error("Failed to fetch phone numbers:", error);
    }
}

// Displays the messages for the currently selected phone
function displayMessagesForPhone(phoneId) {
    messageList.innerHTML = ''; // Clear the current message list

    if (phoneId && allMessages[phoneId]) {
        contentArea.style.display = 'block'; // Show the content area
        const messages = allMessages[phoneId];
        // Sort messages by timestamp descending to show newest first
        messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        messages.forEach(msg => addMessageToUI(msg));
    } else {
        contentArea.style.display = 'none'; // Hide if no phone is selected
    }
}

// Renders a single message item into the list
function addMessageToUI(message) {
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
        const imageUrl = message.imageUrl.startsWith('http') ? message.imageUrl : `${SERVER_URL}${message.imageUrl}`;
        messageHTML += `<img src="${imageUrl}" class="mms-image" alt="MMS Image">`;
    }

    item.innerHTML = messageHTML;
    messageList.appendChild(item); // Use appendChild to keep the order correct (newest at top)
}


// --- Function to send a message ---
async function sendMessage() {
    const selectedPhone = phoneSelector.value;
    const recipientNumber = recipientInput.value.trim();
    const messageBody = messageInput.value.trim();

    if (!selectedPhone) {
        alert("Please select a phone to send from.");
        return;
    }
    if (!recipientNumber || !messageBody) {
        alert("Please enter a recipient and a message.");
        return;
    }

    sendButton.disabled = true;
    sendButton.textContent = 'Sending...';

    try {
        await fetch(`${SERVER_URL}/send-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phoneId: selectedPhone,
                recipientNumber: recipientNumber,
                messageBody: messageBody
            }),
        });
        
        recipientInput.value = '';
        messageInput.value = '';
        alert(`Send command issued from ${selectedPhone}!`);
    } catch (error) {
        alert("Failed to send message. Please check the server logs.");
        console.error("Send message error:", error);
    } finally {
        sendButton.disabled = false;
        sendButton.textContent = 'Send Message';
    }
}


// --- Event Handlers ---

phoneSelector.addEventListener('change', () => {
    const selectedPhone = phoneSelector.value;
    displayMessagesForPhone(selectedPhone);
});

sendButton.addEventListener('click', sendMessage);

socket.on('all_messages', (messagesByPhone) => {
    allMessages = messagesByPhone;
    initializePhoneSelector();
});

socket.on('new_message', (message) => {
    const { phoneId } = message;
    if (!allMessages[phoneId]) {
        allMessages[phoneId] = [];
        // A new phone appeared, so refresh the dropdown
        initializePhoneSelector();
    }
    allMessages[phoneId].push(message);

    // If the user is currently viewing this phone's conversation, update the UI live
    if (phoneSelector.value === phoneId) {
        displayMessagesForPhone(phoneId);
    } else {
        // Add a visual indicator that a new message has arrived for another number
        const option = phoneSelector.querySelector(`option[value="${phoneId}"]`);
        if (option && !option.textContent.includes('•')) {
            option.textContent += ' •';
        }
    }
});

console.log("Dashboard script loaded. Connecting to server...");
