const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- In-Memory State & Mock Database ---
let isRegistrationMode = false;
let pendingScannedUID = null;

// Registered Users Database (UID -> Student Details)
let registeredStudents = {
    "A3B4C5D6": { studentNum: "2024-00001-MN-0", name: "Dianne Mirasol", lastTapTime: 0 }
};

// Global System Telemetry
let systemTelemetry = {
    waterTemp: 15.2,
    ambientTemp: 32.0,
    totalLiters: 124.5,
    activeCardCount: 1,
    peakHours: "11:00 AM - 1:00 PM"
};

// --- API Endpoints ---

// 1. ESP32 Telemetry Update
app.post('/api/telemetry', (req, res) => {
    const { waterTemp, totalLiters, ambientTemp } = req.body;
    if (waterTemp !== undefined) systemTelemetry.waterTemp = waterTemp;
    if (totalLiters !== undefined) systemTelemetry.totalLiters = totalLiters;
    if (ambientTemp !== undefined) systemTelemetry.ambientTemp = ambientTemp;

    res.json({ status: "OK" });
});

// 2. ESP32 RFID Tap Entrypoint
app.post('/api/rfid/tap', (req, res) => {
    const { uid } = req.body;
    console.log(`[RFID TAP] Scanned UID: ${uid}`);

    // FLOW A: System is currently in Admin Registration Mode
    if (isRegistrationMode) {
        pendingScannedUID = uid;
        return res.json({
            status: "REGISTERED_PENDING",
            message: "UID stored for registration"
        });
    }

    // FLOW B: Standard Dispensing Mode
    const student = registeredStudents[uid];

    if (!student) {
        return res.json({
            status: "DENY",
            message: "Unregistered Card"
        });
    }

    // Enforce 5-Minute Cooldown (300,000 ms)
    const currentTime = Date.now();
    const timeSinceLastTap = currentTime - student.lastTapTime;
    const cooldownPeriodMs = 5 * 60 * 1000;

    if (timeSinceLastTap < cooldownPeriodMs) {
        const remainingSeconds = Math.ceil((cooldownPeriodMs - timeSinceLastTap) / 1000);
        return res.json({
            status: "DENY",
            message: `Cooldown: ${remainingSeconds}s`
        });
    }

    // Access Approved
    res.json({
        status: "ALLOW",
        message: `Welcome ${student.name}`
    });
});

// 3. Confirm Dispense Completion & Update Cooldown
app.post('/api/dispense/complete', (req, res) => {
    const { uid, dispensedMl } = req.body;
    if (registeredStudents[uid]) {
        registeredStudents[uid].lastTapTime = Date.now();
    }
    systemTelemetry.totalLiters += (dispensedMl / 1000.0);
    res.json({ status: "SUCCESS" });
});

// 4. Admin Dashboard Endpoint (Used by admin.html)
app.get('/api/admin/analytics', (req, res) => {
    systemTelemetry.activeCardCount = Object.keys(registeredStudents).length;
    res.json({
        ...systemTelemetry,
        isRegistrationMode,
        pendingScannedUID
    });
});

// 5. Admin Toggle Registration Mode
app.post('/api/admin/toggle-registration', (req, res) => {
    const { enable } = req.body;
    isRegistrationMode = enable;
    if (!enable) pendingScannedUID = null;
    res.json({ status: "SUCCESS", isRegistrationMode });
});

// 6. Admin Complete Student Registration
app.post('/api/admin/register-student', (req, res) => {
    const { studentNum, name, uid } = req.body;
    const targetUID = uid || pendingScannedUID;

    if (!targetUID) {
        return res.status(400).json({ error: "No RFID UID scanned or provided." });
    }

    registeredStudents[targetUID] = {
        studentNum,
        name,
        lastTapTime: 0
    };

    // Reset registration pending state
    pendingScannedUID = null;
    isRegistrationMode = false;

    res.json({ status: "SUCCESS", message: `Registered ${name} to UID ${targetUID}` });
});

// Start Server
const PORT = 3000;
// 9. RFID / Student List Endpoint (Fixes 404 error)
app.get('/api/rfid/list', (req, res) => {
    db.all(`SELECT student_number, full_name, rfid_uid, created_at FROM students ORDER BY id DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows || []);
    });
});
app.listen(PORT, () => {
    console.log(`[SERVER RUNNING] Kiosk Backend active at http://localhost:${PORT}`);
});