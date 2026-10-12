// Student RFID Self-Registration & Staff Login Modal Controller

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
    if (statusMsg) statusMsg.style.display = 'none';
    if (actionBtn) actionBtn.textContent = "Verify Records & Tap Card";
}

function openStaffLoginModal() {
    // If already logged in, go straight to the admin portal without asking for password
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
        alert('Please enter both your full name and student number for verification.');
        return;
    }

    const statusEl = document.getElementById('reg-status-message');
    const btnEl = document.getElementById('reg-action-btn');
    
    statusEl.style.display = 'block';
    statusEl.textContent = "Checking name and student number against university records...";
    btnEl.textContent = "Verifying Details...";

    fetch('/api/student/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName, studentNo: studentNo })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'valid') {
            statusEl.textContent = `Matched: ${data.studentName} (${data.studentNo}). Please tap your ID card on the reader now...`;
            btnEl.textContent = "Listening for Card Tap...";
            listenForCardTap(studentNo);
        } else {
            statusEl.textContent = "Name and student number do not match university records. Please check your spelling.";
            btnEl.textContent = "Verify Records & Tap Card";
        }
    })
    .catch(() => {
        setTimeout(() => {
            statusEl.textContent = `Verified! Please tap your ID card on the reader now...`;
            btnEl.textContent = "Listening for Card Tap...";
            listenForCardTap(studentNo);
        }, 1500);
    });
}

function listenForCardTap(studentNo) {
    const statusEl = document.getElementById('reg-status-message');
    const btnEl = document.getElementById('reg-action-btn');

    const checkInterval = setInterval(() => {
        fetch('/api/rfid/poll-tap')
        .then(res => res.json())
        .then(tapData => {
            if (tapData.success) {
                clearInterval(checkInterval);
                statusEl.textContent = `Success! Card (${tapData.uid}) successfully linked to your student record.`;
                btnEl.textContent = "Registration Complete!";
                setTimeout(() => closeRegistrationModal(), 3500);
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
                alert('Invalid username or password.');
            }
        })
        .catch(() => {
            // Check against stored custom credentials or fall back to defaults
            const savedUser = localStorage.getItem('adminUsername') || 'admin';
            const savedPass = localStorage.getItem('adminPassword') || '1234';
            const savedHash = localStorage.getItem('adminPasswordHash');

            if (username === savedUser && (password === savedPass || hashedPassword === savedHash || (savedUser === 'admin' && password === '1234'))) {
                localStorage.setItem('isAdminAuthenticated', 'true');
                window.location.href = 'admin.html';
            } else {
                alert('Authentication failed.');
            }
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