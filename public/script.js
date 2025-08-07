const SERVER_URL = "https://sms-dashboard-1igl.onrender.com";
const socket = io(SERVER_URL);

const phoneSelector = document.getElementById('phone-selector');
const contentArea = document.getElementById('content-area');
const messageList = document.getElementById('message-list');

let allMessages = {};

async function initializePhoneSelector() {
    try {
        const response = await fetch(`${SERVER_URL}/api/phones`);
        const groupedPhones = await response.json(); // Expects data like { "US": [...], "RO": [...] }
        
        const currentSelection = phoneSelector.value;
        phoneSelector.innerHTML = '<option value="">-- Select a Phone --</option>';

        // Create optgroups for each country
        for (const country in groupedPhones) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = country;
            
            groupedPhones[country].forEach(device => {
                const option = document.createElement('option');
                option.value = device.phoneNumber;
                // This line creates the text you want, e.g., "Digi Ro - +40756780187"
                option.textContent = `${device.carrier} - ${device.phoneNumber}`;
                optgroup.appendChild(option);
            });
            phoneSelector.appendChild(optgroup);
        }
        
        // Restore the previous selection if it still exists
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
        initializePhoneSelector(); // A new phone appeared, so refresh the dropdown
    }
    allMessages[phoneId].push(message);
    if (phoneSelector.value === phoneId) {
        displayMessagesForPhone(phoneId);
    } else {
        const option = phoneSelector.querySelector(`option[value="${phoneId}"]`);
        if (option && !option.textContent.includes('•')) {
            option.textContent += ' •'; // Add a dot for new messages on unseen numbers
        }
    }
});

console.log("Dashboard script loaded. Connecting to server...");
