// Student Pre-Verification & Admin Login Controller

function openRegistrationModal() {
    const modal = document.getElementById('registration-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeRegistrationModal() {
    const modal = document.getElementById('registration-modal');
    if (modal) modal.classList.add('hidden');
    const nameInput = document.getElementById('reg-full-name');
    const noInput = document.getElementById('reg-student-no');
    const statusMsg = document.getElementById('reg-status-message');
    const actionBtn = document.getElementById('reg-action-btn');
    
    if (nameInput) nameInput.value = '';
    if (noInput) noInput.value = '';
    if (statusMsg) {
        statusMsg.classList.add('hidden');
        statusMsg.textContent = '';
    }
    if (actionBtn) {
        actionBtn.textContent = "Verify School Database";
        actionBtn.disabled = false;
    }

    fetch('/api/admin/toggle-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: false })
    }).catch(() => {});
}

function openStaffLoginModal() {
    if (localStorage.getItem('isAdminAuthenticated') === 'true') {
        window.location.href = 'admin.html';
        return;
    }

    const modal = document.getElementById('staff-login-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeStaffLoginModal() {
    const modal = document.getElementById('staff-login-modal');
    if (modal) modal.classList.add('hidden');
    const user = document.getElementById('staff-username');
    const pass = document.getElementById('staff-password');
    if (user) user.value = '';
    if (pass) pass.value = '';
}

function verifyAndRegisterCard() {
    const fullName = document.getElementById('reg-full-name').value.trim();
    const studentNo = document.getElementById('reg-student-no').value.trim();
    
    if (!fullName || !studentNo) {
        alert('Please enter both your full name and student number for university verification.');
        return;
    }

    const statusEl = document.getElementById('reg-status-message');
    const btnEl = document.getElementById('reg-action-btn');
    
    statusEl.classList.remove('hidden');
    statusEl.textContent = "Enabling station registration mode... Tap card on reader now.";
    btnEl.textContent = "Listening for Card Tap...";
    btnEl.disabled = true;

    fetch('/api/admin/toggle-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: true })
    })
    .then(() => listenForCardTap(studentNo, fullName))
    .catch(() => {
        statusEl.textContent = "Unable to connect to kiosk server. Please try again.";
        btnEl.textContent = "Verify School Database";
        btnEl.disabled = false;
    });
}

function listenForCardTap(studentNo, fullName) {
    const statusEl = document.getElementById('reg-status-message');
    const btnEl = document.getElementById('reg-action-btn');

    const checkInterval = setInterval(() => {
        fetch('/api/admin/analytics')
        .then(res => res.json())
        .then(data => {
            if (data.pendingScannedUID) {
                clearInterval(checkInterval);
                statusEl.textContent = `Scanned UID: ${data.pendingScannedUID}. Saving to database...`;

                return fetch('/api/admin/register-student', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentNum: studentNo, name: fullName, uid: data.pendingScannedUID })
                });
            }
        })
        .then(res => res ? res.json() : null)
        .then(resData => {
            if (resData && resData.status === 'SUCCESS') {
                statusEl.textContent = `Success! Card registered for ${fullName}.`;
                btnEl.textContent = "Registration Complete!";
                setTimeout(() => closeRegistrationModal(), 2500);
            }
        })
        .catch(() => {});
    }, 1500);
}

function submitStaffLogin() {
    const username = document.getElementById('staff-username').value.trim();
    const password = document.getElementById('staff-password').value.trim();

    if (!username || !password) {
        alert('Please enter both your username and password.');
        return;
    }

    crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)).then(buf => {
        const hashArray = Array.from(new Uint8Array(buf));
        const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        fetch('/api/staff/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, passwordHash: hashedPassword })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                localStorage.setItem('isAdminAuthenticated', 'true');
                window.location.href = 'admin.html';
            } else {
                alert(data.message || 'Invalid administrator credentials.');
            }
        })
        .catch(() => alert('Unable to authenticate with backend server.'));
    });
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = isLight ? '🌙 Dark' : '☀️ Light Mode';
}

window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.textContent = '🌙 Dark';
    }
});