/**
 * PUP Hydration Station — Public Telemetry & Status Monitor
 * Automatically polls kiosk telemetry and updates UI indicators based on online state.
 */

async function fetchTelemetry() {
    try {
        const response = await fetch('/api/admin/analytics');
        if (!response.ok) throw new Error('Failed to reach backend API');

        const data = await response.json();

        // Get DOM Elements
        const espStatusElem = document.getElementById('esp-status-text');
        const systemStatusElem = document.getElementById('system-status-text');
        const waterTempElem = document.getElementById('water-temp');
        const batteryElem = document.getElementById('battery-percent');
        const waterLevelElem = document.getElementById('water-level');

        // Sustainability & Counter Elements
        const ecoLitersElem = document.getElementById('eco-liters-val');
        const bottlesSavedElem = document.getElementById('bottles-saved-today');

        if (data.online) {
            // --- ESP32 IS ONLINE ---
            if (espStatusElem) {
                espStatusElem.textContent = "Connected";
                espStatusElem.className = "text-green";
            }

            if (systemStatusElem) {
                systemStatusElem.textContent = "Fully Operational";
                systemStatusElem.className = "text-cyan";
            }

            // Update live measurements from hardware
            if (waterTempElem) {
                waterTempElem.textContent = `${Number(data.waterTemp).toFixed(1)} °C`;
            }

            if (batteryElem) {
                // Convert battery voltage (e.g., 12.6V nominal max) into percentage
                const volt = data.batteryVoltage ?? 12.5;
                const batteryPct = Math.min(100, Math.max(0, Math.round(((volt - 10.5) / 2.1) * 100)));
                batteryElem.textContent = `${batteryPct}%`;
            }

            if (waterLevelElem) {
                waterLevelElem.textContent = `${Number(data.waterLevel ?? 85).toFixed(0)}%`;
            }

            // Environmental metrics calculation
            const totalLiters = Number(data.totalLiters || 0);
            if (ecoLitersElem) ecoLitersElem.textContent = `${totalLiters.toFixed(1)} L`;
            if (bottlesSavedElem) bottlesSavedElem.textContent = Math.floor((totalLiters * 1000) / 500);

        } else {
            // --- ESP32 IS OFFLINE ---
            if (espStatusElem) {
                espStatusElem.textContent = "Offline";
                espStatusElem.className = "text-amber";
            }

            if (systemStatusElem) {
                systemStatusElem.textContent = "Station Offline";
                systemStatusElem.className = "text-amber";
            }

            // Set default placeholders when offline
            if (waterTempElem) waterTempElem.textContent = "-- °C";
            if (batteryElem) batteryElem.textContent = "--%";
            if (waterLevelElem) waterLevelElem.textContent = "--%";
            if (ecoLitersElem) ecoLitersElem.textContent = "-- L";
            if (bottlesSavedElem) bottlesSavedElem.textContent = "--";
        }

    } catch (error) {
        console.error("[TELEMETRY ERROR]", error);

        // --- BACKEND SERVER OR NETWORK DISCONNECTED ---
        const espStatusElem = document.getElementById('esp-status-text');
        const systemStatusElem = document.getElementById('system-status-text');

        if (espStatusElem) {
            espStatusElem.textContent = "Disconnected";
            espStatusElem.className = "text-amber";
        }

        if (systemStatusElem) {
            systemStatusElem.textContent = "Server Connection Lost";
            systemStatusElem.className = "text-amber";
        }

        // Set placeholders
        const waterTempElem = document.getElementById('water-temp');
        const batteryElem = document.getElementById('battery-percent');
        const waterLevelElem = document.getElementById('water-level');

        if (waterTempElem) waterTempElem.textContent = "-- °C";
        if (batteryElem) batteryElem.textContent = "--%";
        if (waterLevelElem) waterLevelElem.textContent = "--%";
    }
}

/**
 * Fetch recent dispensing logs for the activity table on index.html
 */
async function refreshLogs() {
    try {
        const response = await fetch('/api/logs/recent');
        if (!response.ok) return;

        const logs = await response.json();
        const tableBody = document.getElementById('logTableBody');

        if (!tableBody) return;

        if (!logs || logs.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center card-desc">No recent dispensing logs recorded.</td></tr>`;
            return;
        }

        tableBody.innerHTML = logs.map(log => {
            const formattedTime = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const studentLabel = log.student_number ? `Student (${log.student_number})` : 'Authorized User';

            return `
                <tr>
                    <td>${formattedTime}</td>
                    <td><span class="badge-anon">${studentLabel}</span></td>
                    <td>${log.volume_ml || 500} mL</td>
                    <td><span class="status-pill status-pill-green">Dispensed</span></td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Failed to load logs:", err);
    }
}

// Poll telemetry every 3 seconds & load recent logs
setInterval(fetchTelemetry, 3000);
fetchTelemetry();
refreshLogs();