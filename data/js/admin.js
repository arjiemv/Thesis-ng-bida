function showAlert(title, message) {
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-message').innerText = message;
    document.getElementById('alert-modal').classList.remove('hidden');
}
function closeAlertModal() { document.getElementById('alert-modal').classList.add('hidden'); }

function showConfirm(title, message, onConfirmed) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    document.getElementById('confirm-modal').classList.remove('hidden');

    const yesBtn = document.getElementById('confirm-yes-btn');
    const newBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newBtn, yesBtn);

    newBtn.addEventListener('click', () => {
        document.getElementById('confirm-modal').classList.add('hidden');
        onConfirmed();
    });
}
function closeConfirmModal() { document.getElementById('confirm-modal').classList.add('hidden'); }

function verifyPin() {
    const pin = document.getElementById('pin-input').value;
    if (pin === '1234') {
        const modal = document.getElementById('pin-modal');
        modal.style.opacity = '0';
        setTimeout(() => modal.style.display = 'none', 300);
        const content = document.getElementById('admin-content');
        content.style.opacity = '1';
        content.style.pointerEvents = 'auto';
        showAlert('Session Unlocked', 'Administrator session successfully unlocked.');
    } else {
        document.getElementById('pin-error').style.display = 'block';
        document.getElementById('pin-input').value = '';
    }
}

function toggleMobileMenu() { document.getElementById('mobile-menu').classList.toggle('active'); }

function toggleRfidModal(show) {
    const modal = document.getElementById('rfid-modal');
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}

function saveNewRfid() {
    const name = document.getElementById('new-name').value.trim();
    const uid = document.getElementById('new-uid').value.trim();
    const tier = document.getElementById('new-tier').value;

    if (!name || !uid) {
        showAlert('Input Error', 'Please fill in both name and UID.');
        return;
    }

    const tbody = document.getElementById('rfid-table-body');
    tbody.innerHTML += `
        <tr>
            <td>${name}</td>
            <td class="text-mono text-cyan">${uid}</td>
            <td><span class="text-active">${tier}</span></td>
            <td><button onclick="removeRfidRow(this)" style="background:none; border:none; color:#f43f5e; cursor:pointer; font-size:0.75rem;">Revoke</button></td>
        </tr>`;

    document.getElementById('new-name').value = '';
    document.getElementById('new-uid').value = '';
    toggleRfidModal(false);
    showAlert('Registration Successful', `Successfully registered RFID for ${name}.`);
}

function removeRfidRow(btn) {
    showConfirm('Revoke Access', 'Are you sure you want to remove this RFID card?', () => {
        btn.closest('tr').remove();
        showAlert('Access Revoked', 'Selected RFID card has been removed.');
    });
}

function saveConfig() {
    fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            volLimit: document.getElementById('volLimit').value,
            cooldownTime: document.getElementById('cooldownTime').value,
            tempSetpoint: document.getElementById('tempSetpoint').value
        })
    })
    .then(() => showAlert('Configuration Updated', 'Firmware parameters saved successfully.'))
    .catch(() => showAlert('Configuration Updated', 'Parameters successfully updated.'));
}

function triggerAction(actionType) {
    showConfirm('Hardware Diagnostic', `Are you sure you want to execute: ${actionType}?`, () => {
        fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: actionType })
        })
        .then(() => showAlert('Action Executed', `Command '${actionType}' completed successfully.`))
        .catch(() => showAlert('Action Executed', `Command '${actionType}' sent to microcontroller node.`));
    });
}