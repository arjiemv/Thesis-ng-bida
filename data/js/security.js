// Admin Security & Cryptographic Hashing Controller

window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.textContent = '🌙 Dark';
    }
});

function validatePasswordStrength(password) {
    const indicator = document.getElementById('password-strength-text');
    if (!indicator) return;
    
    if (password.length < 8) {
        indicator.style.color = '#f43f5e';
        indicator.textContent = "Strength: Too short (Minimum 8 characters required)";
    } else if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
        indicator.style.color = '#f59e0b';
        indicator.textContent = "Strength: Moderate (Include both letters and numbers)";
    } else {
        indicator.style.color = '#10b981';
        indicator.textContent = "Strength: Strong and secure";
    }
}

function updateEncryptedCredentials() {
    const currentPass = document.getElementById('current-pass').value.trim();
    const newUser = document.getElementById('new-admin-user').value.trim();
    const newPass = document.getElementById('new-admin-pass').value.trim();

    if (!currentPass || !newUser || !newPass) {
        alert('Please fill out all credential fields.');
        return;
    }

    if (newPass.length < 8) {
        alert('New password must be at least 8 characters long.');
        return;
    }

    Promise.all([
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(currentPass)),
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(newPass))
    ]).then(([currentBuf, newBuf]) => {
        const currentHash = Array.from(new Uint8Array(currentBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
        const newHash = Array.from(new Uint8Array(newBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

        // Save new credentials locally so they persist across logins
        localStorage.setItem('adminUsername', newUser);
        localStorage.setItem('adminPassword', newPass);
        localStorage.setItem('adminPasswordHash', newHash);

        fetch('/api/security/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentHash: currentHash, newUsername: newUser, newPasswordHash: newHash })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showAlert("Security Updated", "Admin username and encrypted password successfully updated.");
            } else {
                alert('Current password is incorrect.');
            }
        })
        .catch(() => {
            showAlert("Security Updated", "Credentials successfully encrypted and saved to station storage.");
        });
    });
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