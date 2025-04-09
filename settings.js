let phoneNumbers = [];

// Initialize when page loads
async function initSettings() {
  try {
    // Load current settings from main process
    const settings = await window.electronAPI.getSettings();
    phoneNumbers = settings.phoneNumbers || [];
    
    // Update the UI with loaded phone numbers
    updatePhoneList();
    
    // Set API key if available
    document.getElementById('madgradesApiKey').value = settings.madGradesApiKey || '';
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

function addPhone() {
  const phoneInput = document.getElementById('phoneInput');
  const phoneNumber = phoneInput.value.trim();
  
  if (!phoneNumber) {
    alert("Please enter a valid phone number.");
    phoneInput.focus();
    return;
  }
  
  if (phoneNumbers.includes(phoneNumber)) {
    alert("This phone number is already added.");
    phoneInput.focus();
    phoneInput.select();
    return;
  }

  phoneNumbers.push(phoneNumber);
  updatePhoneList();
  phoneInput.value = '';
  phoneInput.focus();
}

function removePhone(index) {
  phoneNumbers.splice(index, 1);
  updatePhoneList();
}

function updatePhoneList() {
  const phoneList = document.getElementById('phoneList').getElementsByTagName('tbody')[0];
  phoneList.innerHTML = '';

  if (phoneNumbers.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="2" class="empty-message">No phone numbers added yet</td>`;
    phoneList.appendChild(row);
    return;
  }

  phoneNumbers.forEach((number, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatPhoneNumber(number)}</td>
      <td style="text-align: right">
        <button class="test-btn" onclick="testMessage('${number}')">Test</button>
        <button class="remove-btn" onclick="removePhone(${index})">Remove</button>
      </td>
    `;
    phoneList.appendChild(row);
  });
}

// Function to send a test iMessage
async function testMessage(phoneNumber) {
  try {
    const result = await window.electronAPI.sendTestMessage(phoneNumber);
    if (result.success) {
      alert(`Test message sent to ${formatPhoneNumber(phoneNumber)}`);
    } else {
      alert(`Failed to send test message: ${result.error}`);
    }
  } catch (error) {
    console.error("Error sending test message:", error);
    alert("Failed to send test message. Check console for details.");
  }
}

// Format phone number to be more readable: (123) 456-7890
function formatPhoneNumber(phoneNumber) {
  const cleaned = ('' + phoneNumber).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return '(' + match[1] + ') ' + match[2] + '-' + match[3];
  }
  return phoneNumber;
}

async function saveSettings() {
  try {
    const madgradesApiKey = document.getElementById('madgradesApiKey').value.trim();
    
    const settings = {
      phoneNumbers: phoneNumbers,
      madGradesApiKey: madgradesApiKey
    };
    
    await window.electronAPI.saveSettings(settings);
    alert('Settings saved successfully!');
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('Failed to save settings. Please try again.');
  }
}

// Handle keyboard events
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const phoneInput = document.getElementById('phoneInput');
    if (document.activeElement === phoneInput) {
      addPhone();
    }
  } else if (e.key === 'Escape') {
    window.close();
  } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    saveSettings();
  }
});

// Initialize settings when the page loads
document.addEventListener('DOMContentLoaded', initSettings);

// Add a save button at the bottom
document.addEventListener('DOMContentLoaded', function() {
  const footer = document.createElement('div');
  footer.className = 'settings-footer';
  footer.innerHTML = `<button onclick="saveSettings()" class="save-btn">Save Changes</button>`;
  document.querySelector('.settings-content').appendChild(footer);
  
  // Add footer styles
  const style = document.createElement('style');
  style.textContent = `
    .settings-footer {
      position: fixed;
      bottom: 0;
      right: 0;
      padding: 15px 30px;
      background-color: rgba(40, 40, 42, 0.95);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      width: calc(100% - 200px);
      text-align: right;
    }
    
    .save-btn {
      padding: 6px 16px;
      background-color: #9a0005;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
    }
    
    .save-btn:active {
      background-color: #830004;
    }
    
    .test-btn {
      background-color: rgba(76, 175, 80, 0.2);
      border: none;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      padding: 5px 10px;
      font-size: 13px;
      border-radius: 4px;
      margin-right: 8px;
    }
    
    .test-btn:hover {
      background-color: rgba(76, 175, 80, 0.4);
      color: white;
    }
  `;
  document.head.appendChild(style);
});