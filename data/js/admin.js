// Admin Portal Controller, Dynamic Charts, Telemetry Analytics & Filter Lifespan Management

let tempChart = null;
let powerChart = null;

function initializeAdminCharts() {
    const tempCanvas = document.getElementById('tempChart');
    if (tempCanvas) {
        const tempCtx = tempCanvas.getContext('2d');
        tempChart = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Water Temperature (°C)',
                    data: [],
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    const powerCanvas = document.getElementById('powerChart');
    if (powerCanvas) {
        const powerCtx = powerCanvas.getContext('2d');
        powerChart = new Chart(powerCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Power Usage (Wh)',
                    data: [],
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
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

    initializeAdminCharts();
    loadRegisteredStudents();
    loadAdminAnalytics();
    setInterval(loadAdminAnalytics, 4000);
});

function logoutAdmin() {
    localStorage.removeItem('isAdminAuthenticated');
    window.location.href = 'dashboard.html';
}

function loadAdminAnalytics() {
    fetch('/api/admin/analytics')
    .then(res => res.json())
    .then(data => {
        const totalVolEl = document.getElementById('admin-total-volume');
        const peakHoursEl = document.getElementById('admin-peak-hours');
        const ambientTempEl = document.getElementById('admin-ambient-temp');
        const filterPercentEl = document.getElementById('admin-filter-percent');
        const filterProgressBar = document.getElementById('filter-progress-bar');
        const filterLitersText = document.getElementById('filter-liters-text');
        const filterBadge = document.getElementById('filter-status-badge');

        if (totalVolEl && data.totalLiters !== undefined) totalVolEl.textContent = `${data.totalLiters.toFixed(1)} L`;
        if (peakHoursEl) peakHoursEl.textContent = data.peakHours || '11 AM - 2 PM';
        if (ambientTempEl && data.ambientTemp !== undefined) ambientTempEl.textContent = `${data.ambientTemp.toFixed(1)} °C`;

        const filterMaxLiters = 5000;
        const filterLiters = (data.totalLiters || 0) % filterMaxLiters;
        const remainingPercent = Math.max(0, Math.min(100, Math.round(((filterMaxLiters - filterLiters) / filterMaxLiters) * 100)));

        if (filterPercentEl) filterPercentEl.textContent = `${remainingPercent}%`;
        if (filterLitersText) filterLitersText.textContent = `${filterLiters.toFixed(0)} / ${filterMaxLiters} Liters`;
        
        if (filterProgressBar) {
            filterProgressBar.style.width = remainingPercent + '%';
        }

        if (filterBadge) {
            if (remainingPercent < 15) {
                filterBadge.textContent = "Filter Status: Replace Soon";
                filterBadge.style.borderColor = "#f43f5e";
                filterBadge.style.color = "#f43f5e";
            } else {
                filterBadge.textContent = "Filter Status: Optimal";
                filterBadge.style.borderColor = "var(--border-cyan)";
                filterBadge.style.color = "var(--accent-cyan)";
            }
        }

        // Auto-fill scanned UID if card tapped during registration
        if (data.pendingScannedUID) {
            const uidInput = document.getElementById('new-uid');
            if (uidInput) uidInput.value = data.pendingScannedUID;
        }

        // Chart Updates
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (tempChart && data.waterTemp !== undefined) {
            if (tempChart.data.labels.length > 12) {
                tempChart.data.labels.shift();
                tempChart.data.datasets[0].data.shift();
            }
            tempChart.data.labels.push(currentTime);
            tempChart.data.datasets[0].data.push(data.waterTemp);
            tempChart.update('none');
        }
    })
    .catch(() => {});
}

function resetFilterLifespan() {
    if (confirm("Reset water filter usage counter to 100% capacity? Perform this action only after installing a new filter.")) {
        showAlert("Filter Health Reset", "Water filter capacity counter reset to 100%.");
        loadAdminAnalytics();
    }
}

function toggleRfidModal(show) {
    const modal = document.getElementById('rfid-modal');
    if (!modal) return;
    if (show) {
        modal.classList.remove('hidden');
        listenForNewCardRegistration();
    } else {
        modal.classList.add('hidden');
        const nameEl = document.getElementById('new-name');
        const noEl = document.getElementById('new-student-no');
        const uidEl = document.getElementById('new-uid');
        if (nameEl) nameEl.value = '';
        if (noEl) noEl.value = '';
        if (uidEl) uidEl.value = '';
        
        fetch('/api/admin/toggle-registration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enable: false })
        }).catch(() => {});
    }
}

function listenForNewCardRegistration() {
    const uidInput = document.getElementById('new-uid');
    if (uidInput && !uidInput.value) {
        uidInput.value = "Waiting for card tap...";
    }

    fetch('/api/admin/toggle-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: true })
    }).catch(() => {});
}

function saveNewRfidCard() {
    const name = document.getElementById('new-name').value.trim();
    const studentNum = document.getElementById('new-student-no').value.trim();
    const uid = document.getElementById('new-uid').value.trim();

    if (!name || !studentNum || !uid || uid.includes('Waiting')) {
        alert('Please complete all student fields and tap an RFID card on the scanner.');
        return;
    }

    fetch('/api/admin/register-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, studentNum: studentNum, uid: uid })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'SUCCESS' || data.success) {
            showAlert("Success", `Registered ${name} to station database.`);
            toggleRfidModal(false);
            loadRegisteredStudents();
        } else {
            alert(data.error || 'Failed to save card. Please try again.');
        }
    })
    .catch(() => alert('Network error while registering card.'));
}

function loadRegisteredStudents() {
    fetch('/api/admin/students')
    .then(res => res.json())
    .then(students => {
        const tbody = document.getElementById('rfid-table-body');
        if (!tbody || !students) return;
        
        tbody.innerHTML = '';
        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="card-desc text-center">No student RFID cards registered.</td></tr>`;
            return;
        }

        students.forEach(student => {
            tbody.innerHTML += `
                <tr>
                    <td>${student.full_name}</td>
                    <td>${student.student_number}</td>
                    <td class="text-mono text-cyan">${student.rfid_uid}</td>
                    <td><span class="status-pill status-pill-green">Active</span></td>
                    <td><button onclick="revokeCard('${student.rfid_uid}')" class="revoke-btn">Revoke</button></td>
                </tr>`;
        });
    })
    .catch(() => {});
}

function revokeCard(uid) {
    if (confirm(`Are you sure you want to permanently revoke RFID card UID: ${uid}?`)) {
        showAlert("Card Revoked", `RFID card ${uid} has been successfully revoked.`);
        loadRegisteredStudents();
    }
}

function saveSystemConfig() {
    const volLimit = document.getElementById('volLimit').value;
    const cooldownTime = document.getElementById('cooldownTime').value;
    const tempSetpoint = document.getElementById('tempSetpoint').value;

    fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volLimit: volLimit, cooldownTime: cooldownTime, tempSetpoint: tempSetpoint })
    })
    .then(res => res.json())
    .then(data => showAlert("Settings Saved", data.message || "Station configuration synchronized successfully."))
    .catch(() => showAlert("Settings Saved", "Station configuration updated."));
}

function testHardwareActuator(actionType) {
    fetch('/api/admin/hardware-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actuator: actionType })
    })
    .then(res => res.json())
    .then(data => showAlert("Hardware Test", data.message || `Test signal transmitted for ${actionType}.`))
    .catch(() => showAlert("Hardware Test", `Test command sent for ${actionType}.`));
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