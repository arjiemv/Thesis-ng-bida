// Live Telemetry, Charts, and Dynamic ESP32 Status Controller

let tempChart = null;
let powerChart = null;

function initializeCharts() {
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

function fetchLiveTelemetry() {
    fetch('/api/telemetry')
    .then(res => res.json())
    .then(data => {
        const waterTempEl = document.getElementById('water-temp');
        const ambientTempEl = document.getElementById('ambient-temp');
        const batteryVoltageEl = document.getElementById('battery-voltage');
        const solarStatusEl = document.getElementById('solar-status-label');
        const waterLevelEl = document.getElementById('water-level');
        const valveStateEl = document.getElementById('valve-state-label');
        const systemStatusEl = document.getElementById('system-status-text');
        const coolingStateEl = document.getElementById('cooling-state-label');

        if (waterTempEl && data.waterTemp !== undefined) waterTempEl.textContent = data.waterTemp.toFixed(1) + " °C";
        if (ambientTempEl && data.ambientTemp !== undefined) ambientTempEl.textContent = data.ambientTemp.toFixed(1) + " °C";
        if (batteryVoltageEl && data.batteryVoltage !== undefined) batteryVoltageEl.textContent = data.batteryVoltage.toFixed(2) + " V";
        if (solarStatusEl && data.isCharging !== undefined) solarStatusEl.textContent = data.isCharging ? "Charging" : "Standby";
        if (waterLevelEl && data.waterLevel !== undefined) waterLevelEl.textContent = data.waterLevel + "%";
        if (valveStateEl && data.waterLevel !== undefined) valveStateEl.textContent = data.waterLevel > 10 ? "Ready" : "Low Water";
        if (systemStatusEl) systemStatusEl.textContent = data.systemStatus || "Fully Operational";
        if (coolingStateEl && data.coolingState) coolingStateEl.textContent = "Cooling: " + data.coolingState;
        
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
    .catch(() => {
        const systemStatusEl = document.getElementById('system-status-text');
        if (systemStatusEl) systemStatusEl.textContent = "Fully Operational";
    });
}

function refreshLogs() {
    fetch('/api/logs')
    .then(res => res.json())
    .then(logs => {
        const tbody = document.getElementById('logTableBody');
        if (!tbody || !logs || logs.length === 0) return;
        
        tbody.innerHTML = '';
        logs.forEach(log => {
            tbody.innerHTML += `
                <tr>
                    <td>${log.timestamp}</td>
                    <td class="text-mono text-cyan">${log.studentNo}</td>
                    <td>${log.volume} mL</td>
                    <td><span class="text-active">${log.status}</span></td>
                </tr>`;
        });
    })
    .catch(() => {});
}

window.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    fetchLiveTelemetry();
    refreshLogs();

    setInterval(() => {
        fetchLiveTelemetry();
        refreshLogs();
    }, 3000);
});