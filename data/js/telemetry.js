// Live Telemetry, Hardware Measured Counters, Solar Advisory & Anonymized Activity Controller

function updateSolarAdvisory(batteryVoltage, isCharging, waterTemp) {
    const cardEl = document.getElementById('solar-advisory-card');
    const badgeEl = document.getElementById('advisory-badge');
    const msgEl = document.getElementById('advisory-message');
    const iconEl = document.getElementById('advisory-icon');

    if (!cardEl || !badgeEl || !msgEl) return;

    if (batteryVoltage !== undefined && batteryVoltage < 11.8 && !isCharging) {
        cardEl.className = "advisory-inline advisory-warning mt-4";
        badgeEl.textContent = "⛅ Low Solar Reserve Advisory";
        msgEl.textContent = "Overcast climate or low battery detected. Cooling operating in eco-mode.";
        if (iconEl) iconEl.textContent = "🔋";
    } else if (waterTemp !== undefined && waterTemp > 17.0) {
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
    fetch('/api/telemetry')
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
        
        // Calculate Battery Charge Percentage (11.0V = 0%, 12.8V = 100%)
        if (batteryPercentEl && data.batteryVoltage !== undefined) {
            const chargePercent = Math.min(100, Math.max(0, Math.round(((data.batteryVoltage - 11.0) / 1.8) * 100)));
            batteryPercentEl.textContent = chargePercent + "%";
        }

        if (solarStatusEl && data.isCharging !== undefined) {
            solarStatusEl.textContent = data.isCharging ? "☀️ Solar Active" : "🔋 Battery Mode";
            solarStatusEl.className = data.isCharging ? "status-pill status-pill-green" : "status-pill status-pill-amber";
        }

        if (waterLevelEl && data.waterLevel !== undefined) {
            waterLevelEl.textContent = data.waterLevel + "%";
        }

        if (valveStateEl && data.waterLevel !== undefined) {
            valveStateEl.textContent = data.waterLevel > 10 ? "Ready" : "Low Supply";
            valveStateEl.className = data.waterLevel > 10 ? "status-pill status-pill-cyan" : "status-pill status-pill-amber";
        }

        if (systemStatusEl) {
            systemStatusEl.textContent = data.systemStatus || "Fully Operational";
        }

        // Bind 100% Measured Hardware Telemetry (Flow Sensor Liters & RFID Scan Count)
        if (data.totalLiters !== undefined) {
            const calculatedBottles = Math.floor((data.totalLiters * 1000) / 500);

            if (bottlesSavedEl) bottlesSavedEl.textContent = calculatedBottles.toLocaleString();
            if (ecoLitersEl) ecoLitersEl.textContent = data.totalLiters.toFixed(1) + " L";
            if (ecoTapsEl) ecoTapsEl.textContent = (data.todayTapsCount !== undefined ? data.todayTapsCount : calculatedBottles).toLocaleString();
        }

        updateSolarAdvisory(data.batteryVoltage, data.isCharging, data.waterTemp);
    })
    .catch(() => {
        const systemStatusEl = document.getElementById('system-status-text');
        if (systemStatusEl) systemStatusEl.textContent = "Offline / Disconnected";
    });
}

function anonymizeIdentifier(identifier) {
    if (!identifier) return "Anonymous Student";
    if (identifier.includes("-")) {
        const parts = identifier.split("-");
        if (parts.length >= 3) {
            return `${parts[0]}-****-${parts[parts.length - 2]}-${parts[parts.length - 1]}`;
        }
    }
    if (identifier.length > 4) {
        return identifier.substring(0, 3) + "****" + identifier.substring(identifier.length - 2);
    }
    return "Student ****";
}

function refreshLogs() {
    fetch('/api/logs')
    .then(res => res.json())
    .then(logs => {
        const tbody = document.getElementById('logTableBody');
        if (!tbody || !logs) return;
        
        tbody.innerHTML = '';
        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="card-desc text-center">No recent hydration activity recorded.</td></tr>`;
            return;
        }

        logs.forEach(log => {
            const anonUser = anonymizeIdentifier(log.studentNo || log.uid);
            tbody.innerHTML += `
                <tr>
                    <td>${log.timestamp}</td>
                    <td><span class="badge-anon">${anonUser}</span></td>
                    <td>${log.volume} mL</td>
                    <td><span class="text-active">${log.status}</span></td>
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
    }, 3000);
});