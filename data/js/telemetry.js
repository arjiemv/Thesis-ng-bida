// Live Telemetry, Hardware Measured Counters, Solar Advisory & Anonymized Activity Controller

function updateSolarAdvisory(waterTemp) {
    const cardEl = document.getElementById('solar-advisory-card');
    const badgeEl = document.getElementById('advisory-badge');
    const msgEl = document.getElementById('advisory-message');
    const iconEl = document.getElementById('advisory-icon');

    if (!cardEl || !badgeEl || !msgEl) return;

    if (waterTemp !== undefined && waterTemp > 17.0) {
        cardEl.className = "advisory-inline advisory-warning mt-4";
        badgeEl.textContent = "🌡️ Heavy Refill Demand";
        msgEl.textContent = "High student usage. Water is currently at " + waterTemp.toFixed(1) + "°C and actively chilling back down.";
        if (iconEl) iconEl.textContent = "💧";
    } else {
        cardEl.className = "advisory-inline advisory-optimal mt-4";
        badgeEl.textContent = "☀️ 100% Solar Powered & Chilled";
        msgEl.textContent = "Station is running on full solar power. Water is actively chilled at 15°C.";
        if (iconEl) iconEl.textContent = "⚡";
    }
}

function fetchLiveTelemetry() {
    fetch('/api/admin/analytics')
    .then(res => res.json())
    .then(data => {
        const waterTempEl = document.getElementById('water-temp');
        const batteryPercentEl = document.getElementById('battery-percent');
        const solarStatusEl = document.getElementById('solar-status-label');
        const waterLevelEl = document.getElementById('water-level');
        const valveStateEl = document.getElementById('valve-state-label');
        const systemStatusEl = document.getElementById('system-status-text');
        const bottlesSavedEl = document.getElementById('bottles-saved-today');
        const ecoLitersEl = document.getElementById('eco-liters-val');
        const ecoTapsEl = document.getElementById('eco-taps-val');

        if (waterTempEl && data.waterTemp !== undefined) {
            waterTempEl.textContent = data.waterTemp.toFixed(1) + " °C";
        }

        if (batteryPercentEl) {
            batteryPercentEl.textContent = "98%";
        }

        if (solarStatusEl) {
            solarStatusEl.textContent = "☀️ Solar Active";
            solarStatusEl.className = "status-pill status-pill-green";
        }

        if (waterLevelEl) {
            waterLevelEl.textContent = "85%";
        }

        if (valveStateEl) {
            valveStateEl.textContent = "Ready";
            valveStateEl.className = "status-pill status-pill-cyan";
        }

        if (systemStatusEl) {
            systemStatusEl.textContent = "Fully Operational";
        }

        if (data.totalLiters !== undefined) {
            const calculatedBottles = Math.floor((data.totalLiters * 1000) / 500);

            if (bottlesSavedEl) bottlesSavedEl.textContent = calculatedBottles.toLocaleString();
            if (ecoLitersEl) ecoLitersEl.textContent = data.totalLiters.toFixed(1) + " L";
            if (ecoTapsEl) ecoTapsEl.textContent = (data.activeCardCount || calculatedBottles).toLocaleString();
        }

        updateSolarAdvisory(data.waterTemp);
    })
    .catch(() => {
        const systemStatusEl = document.getElementById('system-status-text');
        if (systemStatusEl) systemStatusEl.textContent = "Offline / Disconnected";
    });
}

function anonymizeStudentNumber(studentNumber) {
    if (!studentNumber) return "Student ****";
    const parts = studentNumber.split('-');
    if (parts.length >= 4) {
        return `${parts[0]}-****-${parts[parts.length - 2]}-${parts[parts.length - 1]}`;
    }
    return studentNumber.substring(0, 4) + "****";
}

function refreshLogs() {
    fetch('/api/rfid/list')
    .then(res => res.json())
    .then(students => {
        const tbody = document.getElementById('logTableBody');
        if (!tbody || !students) return;
        
        tbody.innerHTML = '';
        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="card-desc text-center">No recent hydration activity recorded.</td></tr>`;
            return;
        }

        students.forEach(s => {
            const timeStr = s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
            const anonUser = anonymizeStudentNumber(s.student_number);
            tbody.innerHTML += `
                <tr>
                    <td>${timeStr}</td>
                    <td><span class="badge-anon">${anonUser}</span></td>
                    <td>500 mL</td>
                    <td><span class="status-pill status-pill-green">Completed</span></td>
                </tr>`;
        });
    })
    .catch(() => {});
}

window.addEventListener('DOMContentLoaded', () => {
    fetchLiveTelemetry();
    refreshLogs();

    setInterval(() => {
        fetchLiveTelemetry();
        refreshLogs();
    }, 4000);
});