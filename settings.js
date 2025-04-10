let phoneNumbers = [];

// Initialize when page loads
async function initSettings() {
  try {
    // Load current settings from main process
    const settings = await window.electronAPI.getSettings();
    phoneNumbers = settings.phoneNumbers || [];
    
    // Update the UI with loaded phone numbers
    updatePhoneList();
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
    const cell = document.createElement('td');
    cell.colSpan = 2;
    cell.style.textAlign = 'center';
    cell.style.color = 'rgba(255, 255, 255, 0.5)';
    cell.style.padding = '20px 0';
    cell.textContent = 'No phone numbers added yet';
    row.appendChild(cell);
    phoneList.appendChild(row);
    return;
  }

  phoneNumbers.forEach((number, index) => {
    const row = document.createElement('tr');
    
    // Phone number cell
    const phoneCell = document.createElement('td');
    phoneCell.textContent = formatPhoneNumber(number);
    row.appendChild(phoneCell);
    
    // Actions cell
    const actionsCell = document.createElement('td');
    actionsCell.className = 'phone-actions';
    
    // Test button
    const testBtn = document.createElement('button');
    testBtn.className = 'phone-btn test-btn';
    testBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    testBtn.title = 'Send test message';
    testBtn.onclick = () => testMessage(number);
    actionsCell.appendChild(testBtn);
    
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'phone-btn remove-btn';
    removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
    removeBtn.title = 'Remove';
    removeBtn.onclick = () => removePhone(index);
    actionsCell.appendChild(removeBtn);
    
    row.appendChild(actionsCell);
    phoneList.appendChild(row);
  });
}

// Function to send a test iMessage
async function testMessage(phoneNumber) {
  try {
    // Find the row containing this number
    const rows = document.getElementById('phoneList').getElementsByTagName('tr');
    let targetRow;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].cells[0]?.textContent === formatPhoneNumber(phoneNumber)) {
        targetRow = rows[i];
        break;
      }
    }
    
    if (!targetRow) return;
    
    // Add loading state
    const testBtn = targetRow.querySelector('.test-btn');
    testBtn.disabled = true;
    testBtn.innerHTML = '<span class="loading-spinner"></span>';
    testBtn.classList.add('loading');
    
    // Clear any existing result display
    const existingResult = targetRow.querySelector('.test-result');
    if (existingResult) existingResult.remove();
    
    // Send the test message
    const result = await window.electronAPI.sendTestMessage(phoneNumber);
    
    // Show result
    const resultEl = document.createElement('div');
    resultEl.className = `test-result ${result.success ? 'success' : 'error'}`;
    resultEl.innerHTML = result.success 
      ? '<i class="fas fa-check"></i> Message sent'
      : `<i class="fas fa-exclamation-circle"></i> ${result.error || 'Failed to send'}`;
    
    targetRow.cells[1].appendChild(resultEl);
    setTimeout(() => resultEl.classList.add('show'), 10);
    
    // Reset button
    testBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    testBtn.disabled = false;
    testBtn.classList.remove('loading');
    
    // Auto-hide the result after 5 seconds
    setTimeout(() => {
      resultEl.classList.remove('show');
      setTimeout(() => resultEl.remove(), 300);
    }, 5000);
    
  } catch (error) {
    console.error('Error sending test message:', error);
  }
}

// Format phone number to be more readable: (123) 456-7890
function formatPhoneNumber(phoneNumber) {
  const cleaned = ('' + phoneNumber).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phoneNumber;
}

async function saveSettings() {
  try {
    // Show saving indicator
    const saveBtn = document.querySelector('.save-btn');
    const originalBtnText = saveBtn.textContent;
    saveBtn.innerHTML = '<span class="loading-spinner"></span> Saving...';
    saveBtn.disabled = true;
    
    // Save the settings
    await window.electronAPI.saveSettings({
      phoneNumbers
    });
    
    // Update button to show success
    saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved';
    
    // Reset button after 2 seconds
    setTimeout(() => {
      saveBtn.innerHTML = originalBtnText;
      saveBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('Failed to save settings. Please try again.');
  }
}

// Handle keyboard events
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const activeEl = document.activeElement;
    if (activeEl.id === 'phoneInput') {
      addPhone();
    }
  } else if (e.key === 'Escape') {
    window.close();
  }
});

// Initialize settings when the page loads
document.addEventListener('DOMContentLoaded', initSettings);

// Set up the settings page when loaded
document.addEventListener('DOMContentLoaded', function() {
  // Add a save button at the bottom
  const footer = document.createElement('div');
  footer.className = 'settings-footer';
  footer.innerHTML = `
    <button class="cancel-btn" onclick="window.close()">Cancel</button>
    <button onclick="saveSettings()" class="save-btn">Save Changes</button>
  `;
  document.querySelector('.settings-container').appendChild(footer);
});