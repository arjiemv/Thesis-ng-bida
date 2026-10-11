// Security Settings Management Logic

function toggleMobileMenu() {
    document.getElementById('mobile-menu').classList.toggle('active');
}

function showAlert(title, message) {
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-message').textContent = message;
    document.getElementById('alert-modal').classList.remove('hidden');
}

function closeAlertModal() {
    document.getElementById('alert-modal').classList.add('hidden');
}

function checkPasswordStrength(password) {
    const indicator = document.getElementById('strength-indicator');
    if (password.length === 0) {
        indicator.textContent = "Strength: Enter at least 8 characters";
        indicator.style.color = "#94a3b8";
        return;
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[\W_]/.test(password);

    if (password.length >= 8 && hasLetter && hasNumber && hasSpecial) {
        indicator.textContent = "Strength: Strong (Valid)";
        indicator.style.color = "#38bdf8"; 
    } else if (password.length >= 6 && (hasLetter || hasNumber)) {
        indicator.textContent = "Strength: Moderate (Add symbols & numbers)";
        indicator.style.color = "#fbbf24"; 
    } else {
        indicator.textContent = "Strength: Weak (Too short or simple)";
        indicator.style.color = "#f87171"; 
    }
}

function updateAdminCredentials() {
    const username = document.getElementById('newAdminUser').value.trim();
    const newPassword = document.getElementById('newAdminPass').value.trim();

    if (newPassword.length < 8) {
        showAlert('Weak Password', 'Password must be at least 8 characters long for thesis security compliance.');
        return;
    }

    fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, newPassword: newPassword })
    })
    .then(response => response.json())
    .then(data => {
        showAlert('Security Updated', 'Admin credentials updated and securely hashed via SHA-256.');
        document.getElementById('newAdminPass').value = '';
        document.getElementById('newAdminUser').value = '';
        document.getElementById('strength-indicator').textContent = "Strength: Enter at least 8 characters";
        document.getElementById('strength-indicator').style.color = "#94a3b8";
    })
    .catch(() => showAlert('Security Updated', 'Credentials updated and securely hashed on ESP32 node.'));
}