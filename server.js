const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'data' folder
app.use(express.static(path.join(__dirname, 'data')));

// Initialize SQLite Database File
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('[DATABASE] Connected to SQLite database file.');
});

// Create SQL Tables & Insert Defaults
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_number TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        rfid_uid TEXT UNIQUE NOT NULL,
        last_dispense_time INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS dispensing_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rfid_uid TEXT NOT NULL,
        volume_ml INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS telemetry_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        water_temp REAL NOT NULL,
        ambient_temp REAL NOT NULL,
        total_liters REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )`);

    // Insert Default Admin (username: admin / password: admin123 SHA-256 hash)
    db.run(`INSERT OR IGNORE INTO admin_users (username, password_hash) VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('registration_mode', 'false')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('pending_uid', '')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('cooldown_minutes', '5')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('dispense_limit_ml', '500')`);
});

// Helper database functions
function getSetting(key) {
    return new Promise((resolve) => {
        db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => resolve(row ? row.value : null));
    });
}

function setSetting(key, value) {
    return new Promise((resolve) => {
        db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, String(value)], resolve);
    });
}

// --- API ENDPOINTS ---

// 1. Staff / Admin Login
app.post('/api/staff/login', (req, res) => {
    const { username, passwordHash } = req.body;
    db.get(`SELECT * FROM admin_users WHERE username = ? AND password_hash = ?`, [username, passwordHash], (err, row) => {
        if (row) res.json({ success: true, message: "Login successful" });
        else res.status(401).json({ success: false, message: "Invalid username or password" });
    });
});

// 2. ESP32 RFID Tap Request
app.post('/api/rfid/tap', async (req, res) => {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ status: "DENY", message: "Invalid Card Scan" });

    const isRegMode = (await getSetting('registration_mode')) === 'true';

    if (isRegMode) {
        await setSetting('pending_uid', uid);
        return res.json({ status: "REGISTERED_PENDING", message: "Card read for registration" });
    }

    db.get(`SELECT * FROM students WHERE rfid_uid = ?`, [uid], async (err, student) => {
        if (!student) {
            return res.json({ status: "DENY", message: "Unregistered Card" });
        }

        const cooldownMins = parseInt(await getSetting('cooldown_minutes')) || 5;
        const cooldownMs = cooldownMins * 60 * 1000;
        const timeSinceLastTap = Date.now() - (student.last_dispense_time || 0);

        if (timeSinceLastTap < cooldownMs) {
            const remainingSecs = Math.ceil((cooldownMs - timeSinceLastTap) / 1000);
            return res.json({ status: "DENY", message: `Cooldown: ${remainingSecs}s` });
        }

        res.json({ status: "ALLOW", message: `Welcome ${student.full_name}` });
    });
});

// 3. Confirm Dispense Completed
app.post('/api/dispense/complete', async (req, res) => {
    const { uid, dispensedMl } = req.body;
    const volume = dispensedMl || 500;
    const currentTime = Date.now();

    db.run(`UPDATE students SET last_dispense_time = ? WHERE rfid_uid = ?`, [currentTime, uid]);
    db.run(`INSERT INTO dispensing_logs (rfid_uid, volume_ml) VALUES (?, ?)`, [uid, volume]);

    res.json({ status: "SUCCESS" });
});

// 4. ESP32 Telemetry Update
app.post('/api/telemetry', (req, res) => {
    const { waterTemp, ambientTemp, totalLiters } = req.body;
    db.run(`INSERT INTO telemetry_logs (water_temp, ambient_temp, total_liters) VALUES (?, ?, ?)`,
        [waterTemp || 15.0, ambientTemp || 31.0, totalLiters || 0.0],
        () => res.json({ status: "OK" })
    );
});

// 5. Admin Analytics Endpoint
app.get('/api/admin/analytics', async (req, res) => {
    const regMode = (await getSetting('registration_mode')) === 'true';
    const pendingUID = await getSetting('pending_uid');

    db.get(`SELECT water_temp, ambient_temp, total_liters FROM telemetry_logs ORDER BY id DESC LIMIT 1`, [], (err, telemetry) => {
        db.get(`SELECT COUNT(*) as activeCardCount FROM students`, [], (err, countRow) => {
            res.json({
                waterTemp: telemetry ? telemetry.water_temp : 15.0,
                ambientTemp: telemetry ? telemetry.ambient_temp : 31.0,
                totalLiters: telemetry ? telemetry.total_liters : 0.0,
                activeCardCount: countRow ? countRow.activeCardCount : 0,
                isRegistrationMode: regMode,
                pendingScannedUID: pendingUID || null
            });
        });
    });
});

// 6. Admin Student List
app.get('/api/admin/students', (req, res) => {
    db.all(`SELECT student_number, full_name, rfid_uid, created_at FROM students ORDER BY id DESC`, [], (err, rows) => {
        res.json(rows || []);
    });
});

// 7. Admin Toggle Registration Mode
app.post('/api/admin/toggle-registration', async (req, res) => {
    const { enable } = req.body;
    await setSetting('registration_mode', enable);
    if (!enable) await setSetting('pending_uid', '');
    res.json({ status: "SUCCESS", isRegistrationMode: enable });
});

// 8. Admin Register Student
app.post('/api/admin/register-student', async (req, res) => {
    const { studentNum, name, uid } = req.body;
    const pendingUID = await getSetting('pending_uid');
    const targetUID = uid || pendingUID;

    if (!targetUID) {
        return res.status(400).json({ error: "No RFID UID scanned or provided." });
    }

    db.run(`INSERT OR REPLACE INTO students (student_number, full_name, rfid_uid) VALUES (?, ?, ?)`,
        [studentNum, name, targetUID],
        async (err) => {
            if (err) return res.status(500).json({ error: err.message });
            await setSetting('pending_uid', '');
            await setSetting('registration_mode', 'false');
            res.json({ status: "SUCCESS", message: `Registered ${name}` });
        }
    );
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`[SERVER RUNNING] Kiosk Backend active at http://localhost:${PORT}`);
});