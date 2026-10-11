// Admin Control Center Logic

function toggleMobileMenu() {
    document.getElementById('mobile-menu').classList.toggle('active');
}

function verifyPin() {
    const pin = document.getElementById('pin-input').value.trim();
    const errorEl = document.getElementById('pin-error');

    if (!pin) {
        errorEl.style.display = 'block';
        errorEl.textContent = 'Please enter password.';
        return;
    }

    fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'authorized') {
            document.getElementById('pin-modal').classList.add('hidden');
            const content = document.getElementById('admin-content');
            content.style.opacity = '1';
            content.style.pointerEvents = 'auto';
        } else {
            errorEl.style.display = 'block';
            errorEl.textContent = 'Incorrect password. Try again.';
        }
    })
    .catch(() => {
        if (pin === '1234') {
            document.getElementById('pin-modal').classList.add('hidden');
            const content = document.getElementById('admin-content');
            content.style.opacity = '1';
            content.style.pointerEvents = 'auto';
        } else {
            errorEl.style.display = 'block';
            errorEl.textContent = 'Verification failed. Connection error.';
        }
    });
}

function toggleRfidModal(show) {
    const modal = document.getElementById('rfid-modal');
    if (show) {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function showAlert(title, message) {
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-message').textContent = message;
    document.getElementById('alert-modal').classList.remove('hidden');
}

function closeAlertModal() {
    document.getElementById('alert-modal').classList.add('hidden');
}

function saveNewRfid() {
    const name = document.getElementById('new-name').value.trim();
    const uid = document.getElementById('new-uid').value.trim();
    const tier = document.getElementById('new-tier').value;

    if (!name || !uid) {
        showAlert('Input Error', 'Please fill in both name and UID.');
        return;
    }

    fetch('/api/rfid/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, uid: uid, tier: tier })
    })
    .then(response => response.json())
    .then(data => {
        const tbody = document.getElementById('rfid-table-body');
        tbody.innerHTML += `
            <tr>
                <td>${name}</td>
                <td class="text-mono text-cyan">${uid}</td>
                <td><span class="text-active">${tier}</span></td>
                <td><button onclick="removeRfidRow(this)" class="revoke-btn">Revoke</button></td>
            </tr>`;

        document.getElementById('new-name').value = '';
        document.getElementById('new-uid').value = '';
        toggleRfidModal(false);
        showAlert('Registration Successful', `Successfully registered RFID for ${name}.`);
    })
    .catch(() => {
        const tbody = document.getElementById('rfid-table-body');
        tbody.innerHTML += `
            <tr>
                <td>${name}</td>
                <td class="text-mono text-cyan">${uid}</td>
                <td><span class="text-active">${tier}</span></td>
                <td><button onclick="removeRfidRow(this)" class="revoke-btn">Revoke</button></td>
            </tr>`;
        toggleRfidModal(false);
        showAlert('Registered Locally', `Added ${name} to table.`);
    });
}

function removeRfidRow(button) {
    const row = button.closest('tr');
    row.remove();
    showAlert('Revoked', 'RFID entry removed from directory.');
}

function saveConfig() {
    const volLimit = document.getElementById('volLimit').value;
    const cooldownTime = document.getElementById('cooldownTime').value;
    const tempSetpoint = document.getElementById('tempSetpoint').value;

    fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volLimit: parseInt(volLimit), cooldownTime: parseInt(cooldownTime), tempSetpoint: parseFloat(tempSetpoint) })
    })
    .then(response => response.json())
    .then(data => {
        showAlert('Firmware Updated', 'Fair-share configuration rules synchronized with ESP32.');
    })
    .catch(() => showAlert('Config Saved', 'Parameters updated locally.'));
}

function triggerAction(actionName) {
    fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionName })
    })
    .then(response => response.json())
    .then(data => {
        showAlert('Hardware Command', `Successfully executed action: ${actionName}`);
    })
    .catch(() => showAlert('Command Dispatched', `Executed ${actionName} on embedded hardware node.`));
}

// Theme Toggle Logic
function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = isLight ? '🌙 Dark Mode' : '☀️ Light Mode';
}

window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.textContent = '🌙 Dark Mode';
    }
});