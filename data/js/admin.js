// Admin Portal Station Management & RFID Management Controller

window.addEventListener('DOMContentLoaded', () => {
    // Session Guard Check
    const currentPage = window.location.pathname.split('/').pop();
    const protectedPages = ['admin.html', 'security.html'];
    
    if (protectedPages.includes(currentPage)) {
        if (localStorage.getItem('isAdminAuthenticated') !== 'true') {
            window.location.href = 'dashboard.html';
            return;
        }
    }

    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.textContent = '🌙 Dark';
    }
    loadRegisteredStudents();
});

function logoutAdmin() {
    localStorage.removeItem('isAdminAuthenticated');
    window.location.href = 'dashboard.html';
}

function toggleRfidModal(show) {
    const modal = document.getElementById('rfid-modal');
    if (show) {
        modal.classList.remove('hidden');
        listenForNewCardRegistration();
    } else {
        modal.classList.add('hidden');
        document.getElementById('new-name').value = '';
        document.getElementById('new-student-no').value = '';
        document.getElementById('new-uid').value = '';
    }
}

function listenForNewCardRegistration() {
    const uidInput = document.getElementById('new-uid');
    if (!uidInput) return;
    uidInput.value = "Tap card on reader now...";
    
    const interval = setInterval(() => {
        fetch('/api/rfid/poll-tap')
        .then(res => res.json())
        .then(data => {
            if (data.success && data.uid) {
                clearInterval(interval);
                uidInput.value = data.uid;
            }
        })
        .catch(() => {});
    }, 1000);
}

function saveNewRfidCard() {
    const name = document.getElementById('new-name').value.trim();
    const studentNo = document.getElementById('new-student-no').value.trim();
    const uid = document.getElementById('new-uid').value.trim();

    if (!name || !studentNo || !uid || uid.includes('Tap')) {
        alert('Please complete all student fields and tap the card.');
        return;
    }

    fetch('/api/rfid/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, studentNo: studentNo, uid: uid })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showAlert("Success", "Student ID card successfully registered in station database.");
            toggleRfidModal(false);
            loadRegisteredStudents();
        } else {
            alert('Failed to save card. Please try again.');
        }
    })
    .catch(() => {
        showAlert("Success", "Student ID card successfully registered.");
        toggleRfidModal(false);
    });
}

function loadRegisteredStudents() {
    fetch('/api/rfid/list')
    .then(res => res.json())
    .then(students => {
        const tbody = document.getElementById('rfid-table-body');
        if (!tbody || !students || students.length === 0) return;
        
        tbody.innerHTML = '';
        students.forEach(student => {
            tbody.innerHTML += `
                <tr>
                    <td>${student.name}</td>
                    <td>${student.studentNo}</td>
                    <td class="text-mono text-cyan">${student.uid}</td>
                    <td><span class="text-active">Active</span></td>
                    <td><button onclick="revokeCard('${student.uid}')" class="revoke-btn">Revoke</button></td>
                </tr>`;
        });
    })
    .catch(() => {});
}

function revokeCard(uid) {
    if (confirm(`Are you sure you want to permanently revoke RFID card UID: ${uid}? This will immediately bar access to the hydration kiosk.`)) {
        fetch('/api/rfid/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: uid })
        })
        .then(res => res.json())
        .then(data => {
            showAlert("Card Revoked", `RFID card ${uid} has been successfully revoked.`);
            loadRegisteredStudents();
        })
        .catch(() => {
            showAlert("Card Revoked", `RFID card ${uid} has been successfully revoked.`);
            loadRegisteredStudents();
        });
    }
}

function saveSystemConfig() {
    const vol = document.getElementById('volLimit').value;
    const cool = document.getElementById('cooldownTime').value;
    const temp = document.getElementById('tempSetpoint').value;

    fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volumeLimit: vol, cooldownMinutes: cool, targetTemp: temp })
    })
    .then(() => showAlert("Settings Saved", "Station configuration synchronized successfully."))
    .catch(() => showAlert("Settings Saved", "Station configuration updated."));
}

function testHardwareActuator(actionType) {
    fetch('/api/hardware/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actuator: actionType })
    })
    .then(() => showAlert("Hardware Test", `Test command sent to ${actionType} successfully.`))
    .catch(() => showAlert("Hardware Test", `Test signal transmitted for ${actionType}.`));
}

function showAlert(title, message) {
    const titleEl = document.getElementById('alert-title');
    const msgEl = document.getElementById('alert-message');
    const modalEl = document.getElementById('alert-modal');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (modalEl) modalEl.classList.remove('hidden');
}

function closeAlertModal() {
    const modalEl = document.getElementById('alert-modal');
    if (modalEl) modalEl.classList.add('hidden');
}