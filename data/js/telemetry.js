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

        // -127 = DS18B20 disconnected, -1 = ultrasonic got no echo
        const tempValid = data.waterTemp !== undefined && data.waterTemp > -100;
        const levelValid = data.waterLevel !== undefined && data.waterLevel >= 0;

        if (waterTempEl) {
            waterTempEl.textContent = tempValid ? data.waterTemp.toFixed(1) + " °C" : "-- °C";
        }

        if (batteryPercentEl && data.batteryVoltage !== undefined) {
            if (data.batteryVoltage > 5) {
                // 12V lead-acid approximation: 11.8 V = 0%, 12.8 V = 100%. Adjust for your battery.
                const pct = Math.max(0, Math.min(100, Math.round((data.batteryVoltage - 11.8) / (12.8 - 11.8) * 100)));
                batteryPercentEl.textContent = pct + "%";
            } else {
                batteryPercentEl.textContent = "--";
            }
        }

        if (solarStatusEl) {
            solarStatusEl.textContent = data.online ? "☀️ Solar Active" : "Offline";
            solarStatusEl.className = data.online ? "status-pill status-pill-green" : "status-pill status-pill-amber";
        }

        if (waterLevelEl) {
            waterLevelEl.textContent = levelValid ? Math.round(data.waterLevel) + "%" : "--";
        }

        if (valveStateEl) {
            valveStateEl.textContent = data.online ? "Ready" : "No signal";
            valveStateEl.className = "status-pill status-pill-cyan";
        }

        if (systemStatusEl) {
            systemStatusEl.textContent = data.online ? "Fully Operational" : "Kiosk Offline (no data from ESP32)";
        }

        if (data.totalLiters !== undefined) {
            const calculatedBottles = Math.floor((data.totalLiters * 1000) / 500);

            if (bottlesSavedEl) bottlesSavedEl.textContent = calculatedBottles.toLocaleString();
            if (ecoLitersEl) ecoLitersEl.textContent = data.totalLiters.toFixed(1) + " L";
            if (ecoTapsEl) ecoTapsEl.textContent = (data.activeCardCount || calculatedBottles).toLocaleString();
        }

        updateSolarAdvisory(tempValid ? data.waterTemp : undefined);
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
    fetch('/api/logs/recent')
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
            // SQLite CURRENT_TIMESTAMP is UTC without a "Z" - add it so the browser shows local time
            const timeStr = s.timestamp ? new Date(s.timestamp.replace(' ', 'T') + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
            const anonUser = anonymizeStudentNumber(s.student_number || 'Unknown');
            tbody.innerHTML += `
                <tr>
                    <td>${timeStr}</td>
                    <td><span class="badge-anon">${anonUser}</span></td>
                    <td>${s.volume_ml} mL</td>
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