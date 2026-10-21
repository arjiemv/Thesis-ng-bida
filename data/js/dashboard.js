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
}

function openStaffLoginModal() {
    if (localStorage.getItem('isAdminAuthenticated') === 'true') {
        window.location.href = 'admin.html';
        return;
    }

    const modal = document.getElementById('staff-login-modal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        window.location.href = 'dashboard.html';
    }
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
    statusEl.textContent = "Verifying student records with university database...";
    btnEl.textContent = "Checking Records...";
    btnEl.disabled = true;

    fetch('/api/student/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName, studentNo: studentNo })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'valid' || data.success === true) {
            statusEl.textContent = `Record Verified: ${fullName}. Tap your student RFID card on the reader now...`;
            btnEl.textContent = "Listening for RFID Tap...";
            listenForCardTap(studentNo, fullName);
        } else {
            statusEl.textContent = "Verification Failed: Credentials do not match PUP school records.";
            btnEl.textContent = "Verify School Database";
            btnEl.disabled = false;
        }
    })
    .catch(() => {
        statusEl.textContent = "Unable to connect to verification server. Please try again.";
        btnEl.textContent = "Verify School Database";
        btnEl.disabled = false;
    });
}

function listenForCardTap(studentNo, fullName) {
    const statusEl = document.getElementById('reg-status-message');
    const btnEl = document.getElementById('reg-action-btn');

    const checkInterval = setInterval(() => {
        fetch('/api/rfid/poll-tap')
        .then(res => res.json())
        .then(tapData => {
            if (tapData.success && tapData.uid) {
                clearInterval(checkInterval);
                statusEl.textContent = `Success! Card UID (${tapData.uid}) linked to ${studentNo}.`;
                btnEl.textContent = "Registration Complete!";
                setTimeout(() => closeRegistrationModal(), 3000);
            }
        })
        .catch(() => {});
    }, 1000);
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
                alert('Invalid administrator credentials.');
            }
        })
        .catch(() => {
            alert('Unable to authenticate with ESP32 server.');
        });
    });
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = isLight ? '🌙 Dark' : '☀️ Light';
}

window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.textContent = '🌙 Dark';
    }
});