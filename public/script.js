// script.js - Final Dynamic "Master-Detail" Version
const SERVER_URL = "https://sms-dashboard-1igl.onrender.com";
const socket = io(SERVER_URL);

// Get the main UI elements
const phoneSelector = document.getElementById('phone-selector');
const contentArea = document.getElementById('content-area');
const messageList = document.getElementById('message-list');

// This object will hold all messages, sorted by phone number
let allMessages = {};

// --- Functions to build the dynamic interface ---

// Fetches the list of phone numbers and populates the dropdown
async function initializePhoneSelector() {
    try {
        const response = await fetch(`${SERVER_URL}/api/phones`);
        const phoneNumbers = await response.json();

        phoneSelector.innerHTML = '<option value="">-- Select a Phone --</option>'; // Clear "Loading..."

        phoneNumbers.forEach(number => {
            const option = document.createElement('option');
            option.value = number;
            option.textContent = number;
            phoneSelector.appendChild(option);
        });
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
        // Note: For Cloudinary or S3, the URL will be absolute and you won't need SERVER_URL
        const imageUrl = message.imageUrl.startsWith('http') ? message.imageUrl : `${SERVER_URL}${message.imageUrl}`;
        messageHTML += `<img src="${imageUrl}" class="mms-image" alt="MMS Image">`;
    }

    item.innerHTML = messageHTML;
    messageList.appendChild(item); // Use appendChild to keep the order correct (newest at top)
}


// --- Event Handlers ---

// When the user selects a different phone from the dropdown
phoneSelector.addEventListener('change', () => {
    const selectedPhone = phoneSelector.value;
    displayMessagesForPhone(selectedPhone);
});

// When the page first connects, get all historical data
socket.on('all_messages', (messagesByPhone) => {
    allMessages = messagesByPhone;
    // Now that we have the data, populate the dropdown
    initializePhoneSelector();
});

// When a new message arrives in real-time
socket.on('new_message', (message) => {
    const { phoneId } = message;
    
    // Add the new message to our stored data
    if (!allMessages[phoneId]) {
        allMessages[phoneId] = [];
        initializePhoneSelector(); // A new phone appeared, so refresh the dropdown
    }
    allMessages[phoneId].push(message);

    // If the user is currently viewing this phone's conversation, update the UI live
    if (phoneSelector.value === phoneId) {
        displayMessagesForPhone(phoneId);
    } else {
        // Optional: Add a visual indicator that a new message has arrived for another number
        const option = phoneSelector.querySelector(`option[value="${phoneId}"]`);
        if (option && !option.textContent.includes('•')) {
            option.textContent += ' •';
        }
    }
});
