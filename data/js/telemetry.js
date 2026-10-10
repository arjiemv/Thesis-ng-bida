function toggleMobileMenu() {
    document.getElementById('mobile-menu').classList.toggle('active');
}

// Real-time telemetry polling loop (Every 2 seconds)
function fetchTelemetry() {
    fetch('/api/telemetry')
        .then(response => response.json())
        .then(data => {
            document.getElementById('water-temp').innerText = data.waterTemp.toFixed(1) + ' °C';
            document.getElementById('ambient-temp').innerText = data.ambientTemp.toFixed(1) + ' °C';
            document.getElementById('heatsink-temp').innerText = data.heatSinkTemp.toFixed(1) + ' °C';
            document.getElementById('battery-voltage').innerText = data.batteryVoltage.toFixed(1) + ' V';
            document.getElementById('water-level').innerText = data.waterLevel + '%';
        })
        .catch(error => console.error('Telemetry fetch error:', error));
}

setInterval(fetchTelemetry, 2000);

function refreshData() {
    fetch('/api/logs')
        .then(res => res.json())
        .then(logs => {
            const tbody = document.getElementById('logTableBody');
            tbody.innerHTML = '';
            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="card-desc">No transaction logs recorded yet.</td></tr>';
                return;
            }
            logs.forEach(log => {
                tbody.innerHTML += `
                    <tr>
                        <td class="text-water">${log.timestamp}</td>
                        <td class="text-mono text-cyan">${log.uid}</td>
                        <td>${log.volume} mL</td>
                        <td><span class="badge-status">${log.status}</span></td>
                    </tr>`;
            });
        })
        .catch(() => alert('Unable to sync logs from ESP32 database.'));
}

// Initial fetch on page load
refreshData();

// Chart.js Setup
new Chart(document.getElementById('tempChart').getContext('2d'), {
    type: 'line',
    data: {
        labels: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
        datasets: [{
            label: 'Reservoir Temp (°C)',
            data: [16.5, 15.8, 15.1, 15.0, 14.9, 15.2],
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3
        }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#0f172a' }, ticks: { color: '#a5f3fc' } }, x: { grid: { color: '#0f172a' }, ticks: { color: '#a5f3fc' } } } }
});

new Chart(document.getElementById('powerChart').getContext('2d'), {
    type: 'bar',
    data: {
        labels: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
        datasets: [{
            label: 'Power Consumption (Wh)',
            data: [42, 48, 55, 52, 45, 40],
            backgroundColor: '#0ea5e9',
            borderRadius: 4
        }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#0f172a' }, ticks: { color: '#a5f3fc' } }, x: { grid: { color: '#0f172a' }, ticks: { color: '#a5f3fc' } } } }
});