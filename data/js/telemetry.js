/**
 * PUP Hydration Station — Public Telemetry & Status Monitor
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

        // Advisory Banner Elements
        const advisoryBadgeElem = document.getElementById('advisory-badge');
        const advisoryMessageElem = document.getElementById('advisory-message');

        // Eco & Impact Elements
        const ecoLitersElem = document.getElementById('eco-liters-val');
        const ecoTapsElem = document.getElementById('eco-taps-val');
        const bottlesSavedElem = document.getElementById('bottles-saved-today');

        if (data.online) {
            // --- ONLINE STATE ---
            if (espStatusElem) {
                espStatusElem.textContent = "Connected";
                espStatusElem.className = "text-green";
            }

            if (systemStatusElem) {
                systemStatusElem.textContent = "Fully Operational";
                systemStatusElem.className = "text-cyan";
            }

            // READ LIVE SENSOR TEMP DIRECTLY FROM BACKEND
            if (waterTempElem && data.waterTemp !== null && data.waterTemp !== undefined) {
                const liveTemp = Number(data.waterTemp).toFixed(1);
                waterTempElem.textContent = `${liveTemp} °C`;

                if (advisoryMessageElem) {
                    advisoryMessageElem.textContent = `Station is running on full solar power. Water is actively chilled at ${liveTemp}°C.`;
                }
            }

            if (advisoryBadgeElem) advisoryBadgeElem.textContent = "☀️ Optimal Solar Storage";

            // Battery Voltage to Percentage (10.5V = 0%, 12.6V = 100%)
            if (batteryElem && data.batteryVoltage !== null && data.batteryVoltage !== undefined) {
                const volt = Number(data.batteryVoltage);
                const batteryPct = Math.min(100, Math.max(0, Math.round(((volt - 10.5) / 2.1) * 100)));
                batteryElem.textContent = `${batteryPct}%`;
            }

            // Raw Water Reservoir Level %
            if (waterLevelElem && data.waterLevel !== null && data.waterLevel !== undefined) {
                waterLevelElem.textContent = `${Math.round(Number(data.waterLevel))}%`;
            }

            // Eco Metrics
            const totalLiters = Number(data.totalLiters || 0);
            if (ecoLitersElem) ecoLitersElem.textContent = `${totalLiters.toFixed(1)} L`;
            if (bottlesSavedElem) bottlesSavedElem.textContent = Math.floor((totalLiters * 1000) / 500);
            if (ecoTapsElem) ecoTapsElem.textContent = data.todayTaps || 0;

        } else {
            // --- OFFLINE STATE ---
            if (espStatusElem) {
                espStatusElem.textContent = "Offline";
                espStatusElem.className = "text-amber";
            }

            if (systemStatusElem) {
                systemStatusElem.textContent = "Station Offline";
                systemStatusElem.className = "text-amber";
            }

            if (advisoryBadgeElem) advisoryBadgeElem.textContent = "⚠️ Station Offline";
            if (advisoryMessageElem) {
                advisoryMessageElem.textContent = "Station hardware is currently offline. Dispensing functions are suspended.";
            }

            if (waterTempElem) waterTempElem.textContent = "-- °C";
            if (batteryElem) batteryElem.textContent = "--%";
            if (waterLevelElem) waterLevelElem.textContent = "--%";
        }

    } catch (error) {
        console.error("[TELEMETRY FETCH ERROR]", error);
    }
}

/**
 * Fetch recent dispensing logs for the activity table with local timezone conversion
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
            // Parse SQLite UTC timestamp into local Manila time (UTC+8)
            const rawTime = log.timestamp.endsWith('Z') ? log.timestamp : log.timestamp.replace(' ', 'T') + 'Z';
            const formattedTime = new Date(rawTime).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: true 
            });

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

setInterval(fetchTelemetry, 3000);
fetchTelemetry();
refreshLogs();