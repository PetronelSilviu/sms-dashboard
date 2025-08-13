const SERVER_URL = "https://sms-dashboard-1igl.onrender.com";
const socket = io(SERVER_URL);

const phoneSelector = document.getElementById('phone-selector');
const contentArea = document.getElementById('content-area');
const messageList = document.getElementById('message-list');

let allMessages = {};

async function initializePhoneSelector() {
    try {
        const response = await fetch(`${SERVER_URL}/api/phones`);
        const groupedPhones = await response.json();
        
        const currentSelection = phoneSelector.value;
        phoneSelector.innerHTML = '<option value="">-- Select a Phone --</option>';

        for (const country in groupedPhones) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = country;
            
            groupedPhones[country].forEach(device => {
                const option = document.createElement('option');
                option.value = device.phoneNumber;

                // --- THIS IS THE CORRECTED LOGIC ---
                // It checks if the carrier name is useful before displaying it.
                if (device.carrier && device.carrier !== device.phoneNumber) {
                    option.textContent = `${device.carrier} - ${device.phoneNumber}`;
                } else {
                    option.textContent = device.phoneNumber;
                }
                // --- END OF CORRECTION ---

                optgroup.appendChild(option);
            });
            phoneSelector.appendChild(optgroup);
        }
        
        if (currentSelection) {
            phoneSelector.value = currentSelection;
        }
    } catch (error) {
        phoneSelector.innerHTML = '<option>Error loading phones</option>';
        console.error("Failed to fetch phone data:", error);
    }
}

function displayMessagesForPhone(phoneId) {
    messageList.innerHTML = '';
    if (phoneId && allMessages[phoneId]) {
        contentArea.style.display = 'block';
        const messages = allMessages[phoneId];
        messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        messages.forEach(msg => addMessageToUI(msg));
    } else {
        contentArea.style.display = 'none';
    }
}

function addMessageToUI(message) {
    const item = document.createElement('li');
    item.className = 'message-item';

    const dateTime = new Date(message.timestamp).toLocaleString('ro-RO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
        hour12: false
    });

    let displayBody = message.body || '';

    // RBM JSON Parsing logic
    try {
        const rbmData = JSON.parse(displayBody);
        if (rbmData && rbmData.response && rbmData.response.reply && rbmData.response.reply.displayText) {
            displayBody = `[RBM]: ${rbmData.response.reply.displayText}`;
        }
    } catch (e) {
        // Not a JSON message, do nothing.
    }

    let messageHTML = `
        <div class="from">From: ${message.from}</div>
        <div class="body">${displayBody}</div>
        <div class="time">${dateTime}</div>
    `;
    if (message.imageUrl) {
        const imageUrl = message.imageUrl.startsWith('http') ? message.imageUrl : `${SERVER_URL}${message.imageUrl}`;
        messageHTML += `<img src="${imageUrl}" class="mms-image" alt="MMS Image">`;
    }
    item.innerHTML = messageHTML;
    messageList.appendChild(item);
}

phoneSelector.addEventListener('change', () => {
    const selectedPhone = phoneSelector.value;
    displayMessagesForPhone(selectedPhone);
});

socket.on('all_messages', (messagesByPhone) => {
    allMessages = messagesByPhone;
    initializePhoneSelector();
});

socket.on('new_message', (message) => {
    const { phoneId } = message;
    if (!allMessages[phoneId]) {
        allMessages[phoneId] = [];
        initializePhoneSelector();
    }
    allMessages[phoneId].push(message);
    if (phoneSelector.value === phoneId) {
        displayMessagesForPhone(phoneId);
    } else {
        const option = phoneSelector.querySelector(`option[value="${phoneId}"]`);
        if (option && !option.textContent.includes('•')) {
            option.textContent += ' •';
        }
    }
});

console.log("Dashboard script loaded. Connecting to server...");
