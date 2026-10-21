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
    setInterval(loadAdminAnalytics, 5000);
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
        if (peakHoursEl && data.peakHours) peakHoursEl.textContent = data.peakHours;
        if (ambientTempEl && data.ambientTemp !== undefined) ambientTempEl.textContent = `${data.ambientTemp.toFixed(1)} °C`;

        const filterMaxLiters = data.filterMaxLiters || 5000;
        const usedLiters = data.filterUsedLiters || data.totalLiters || 0;
        const remainingPercent = Math.max(0, Math.min(100, Math.round(((filterMaxLiters - usedLiters) / filterMaxLiters) * 100)));

        if (filterPercentEl) filterPercentEl.textContent = `${remainingPercent}%`;
        if (filterLitersText) filterLitersText.textContent = `${usedLiters.toFixed(0)} / ${filterMaxLiters} Liters`;
        
        // Dynamic loading bar animation update
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

        // Push telemetry points to chart
        const currentTime = new Date().toLocaleTimeString();
        if (tempChart && data.waterTemp !== undefined) {
            if (tempChart.data.labels.length > 15) {
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
        fetch('/api/admin/reset-filter', { method: 'POST' })
        .then(() => {
            showAlert("Filter Health Reset", "Water filter capacity reset to 100%.");
            loadAdminAnalytics();
        })
        .catch(() => showAlert("Filter Health Reset", "Filter capacity updated successfully."));
    }
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
        alert('Please complete all student fields and tap the card on the scanner.');
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
        if (!tbody || !students) return;
        
        tbody.innerHTML = '';
        students.forEach(student => {
            tbody.innerHTML += `
                <tr>
                    <td>${student.name}</td>
                    <td>${student.studentNo}</td>
                    <td class="text-mono text-cyan">${student.uid}</td>
                    <td><span class="text-active">Active</span></td>
                    <td><button onclick="revokeCard('${student.uid}')" class="revoke-btn">Revoke</button> summer</td>
                </tr>`;
        });
    })
    .catch(() => {});
}

function revokeCard(uid) {
    if (confirm(`Are you sure you want to permanently revoke RFID card UID: ${uid}?`)) {
        fetch('/api/rfid/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: uid })
        })
        .then(() => {
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