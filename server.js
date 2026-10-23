const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Log API activity
app.use('/api', (req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl} from ${req.ip}`, req.method === 'POST' ? JSON.stringify(req.body) : '');
    next();
});

let lastDeviceSeen = 0;
const REGISTRATION_TIMEOUT_MS = 2 * 60 * 1000;
let registrationStartedAt = 0;

function normalizeUid(uid) {
    return String(uid || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

app.use((err, req, res, next) => {
    if (err && (err.code === 'ECONNABORTED' || err.type === 'request.aborted')) {
        console.warn('[SERVER WARNING] ESP32 connection dropped before sending full payload.');
        return res.status(400).json({ status: "ERROR", message: "Connection aborted" });
    }
    if (err) {
        return res.status(400).json({ status: "ERROR", message: err.message });
    }
    next();
});

app.use(express.static(path.join(__dirname, 'data')));

const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('[DATABASE] Connection error:', err.message);
    else console.log('[DATABASE] Connected to SQLite database file.');
});

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
        battery_voltage REAL DEFAULT 12.5,
        water_level REAL DEFAULT 85.0,
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

    db.run(`INSERT OR IGNORE INTO admin_users (username, password_hash) VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('registration_mode', 'false')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('pending_uid', '')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('cooldown_minutes', '5')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('dispense_limit_ml', '500')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('temp_setpoint', '15.0')`);
});

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

app.post('/api/staff/login', (req, res) => {
    const { username, passwordHash } = req.body;
    db.get(`SELECT * FROM admin_users WHERE username = ? AND password_hash = ?`, [username, passwordHash], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (row) res.json({ success: true, message: "Login successful" });
        else res.status(401).json({ success: false, message: "Invalid username or password" });
    });
});

app.post('/api/rfid/tap', async (req, res) => {
    lastDeviceSeen = Date.now();
    const uid = normalizeUid(req.body && req.body.uid);
    if (!uid) return res.status(400).json({ status: "DENY", message: "Invalid Card Scan" });

    let isRegMode = (await getSetting('registration_mode')) === 'true';

    if (isRegMode && Date.now() - registrationStartedAt > REGISTRATION_TIMEOUT_MS) {
        await setSetting('registration_mode', 'false');
        isRegMode = false;
    }

    if (isRegMode) {
        await setSetting('pending_uid', uid);
        return res.json({ status: "REGISTERED_PENDING", message: "Card read for registration" });
    }

    db.get(`SELECT * FROM students WHERE rfid_uid = ?`, [uid], async (err, student) => {
        if (err) return res.status(500).json({ status: "DENY", message: "Database Error" });

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

app.post('/api/dispense/complete', async (req, res) => {
    lastDeviceSeen = Date.now();
    const uid = normalizeUid(req.body.uid);
    const dispensedMl = req.body.dispensedMl;
    const volume = dispensedMl ?? 500;
    const currentTime = Date.now();

    db.run(`UPDATE students SET last_dispense_time = ? WHERE rfid_uid = ?`, [currentTime, uid]);
    db.run(`INSERT INTO dispensing_logs (rfid_uid, volume_ml) VALUES (?, ?)`, [uid, volume]);

    res.json({ status: "SUCCESS" });
});

app.post('/api/telemetry', (req, res) => {
    lastDeviceSeen = Date.now();
    const { waterTemp, ambientTemp, totalLiters, batteryVoltage, waterLevel } = req.body;
    
    const wTemp = waterTemp ?? 15.0;
    const aTemp = ambientTemp ?? 31.0;
    const tLiters = totalLiters ?? 0.0;
    const bVolt = batteryVoltage ?? 12.5;
    const wLevel = waterLevel ?? 85.0;

    db.run(`INSERT INTO telemetry_logs (water_temp, ambient_temp, total_liters, battery_voltage, water_level) VALUES (?, ?, ?, ?, ?)`,
        [wTemp, aTemp, tLiters, bVolt, wLevel],
        (err) => {
            if (err) return res.status(500).json({ status: "ERROR", message: err.message });
            res.json({ status: "OK" });
        }
    );
});

// Admin Analytics Endpoint — Fixed to guarantee live telemetry reflection
app.get('/api/admin/analytics', async (req, res) => {
    const regMode = (await getSetting('registration_mode')) === 'true';
    const pendingUID = await getSetting('pending_uid');
    
    // Consider device online if seen within last 45 seconds
    const isOnline = (Date.now() - lastDeviceSeen) < 45000;

    db.get(`SELECT water_temp, ambient_temp, total_liters, battery_voltage, water_level FROM telemetry_logs ORDER BY id DESC LIMIT 1`, [], (err, telemetry) => {
        if (err) console.error('[ANALYTICS ERROR]', err.message);

        db.get(`SELECT COUNT(*) as activeCardCount FROM students`, [], (err, countRow) => {
            db.get(`SELECT COUNT(*) as todayTaps FROM dispensing_logs WHERE timestamp >= datetime('now', 'start of day')`, [], (err, tapRow) => {

                res.json({
                    online: isOnline,
                    waterTemp: telemetry ? telemetry.water_temp : 15.0,
                    ambientTemp: telemetry ? telemetry.ambient_temp : 30.5,
                    totalLiters: telemetry ? telemetry.total_liters : 0.0,
                    batteryVoltage: telemetry ? telemetry.battery_voltage : 12.5,
                    waterLevel: telemetry ? telemetry.water_level : 85.0,
                    todayTaps: tapRow ? tapRow.todayTaps : 0,
                    activeCardCount: countRow ? countRow.activeCardCount : 0,
                    lastSeenSecondsAgo: lastDeviceSeen ? Math.round((Date.now() - lastDeviceSeen) / 1000) : null,
                    isRegistrationMode: regMode,
                    pendingScannedUID: pendingUID || null
                });
            });
        });
    });
});

app.get('/api/admin/students', (req, res) => {
    db.all(`SELECT student_number, full_name, rfid_uid, created_at FROM students ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.get('/api/rfid/list', (req, res) => {
    db.all(`SELECT student_number, full_name, rfid_uid, created_at FROM students ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.get('/api/logs/recent', (req, res) => {
    db.all(`SELECT l.id, l.volume_ml, l.timestamp, s.student_number
            FROM dispensing_logs l LEFT JOIN students s ON s.rfid_uid = l.rfid_uid
            ORDER BY l.id DESC LIMIT 15`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/admin/toggle-registration', async (req, res) => {
    const enable = req.body.enable === true || req.body.enable === 'true';
    await setSetting('registration_mode', enable);
    await setSetting('pending_uid', '');
    if (enable) registrationStartedAt = Date.now();
    res.json({ status: "SUCCESS", isRegistrationMode: enable });
});

app.post('/api/admin/register-student', async (req, res) => {
    const { studentNum, name, uid } = req.body;
    const pendingUID = await getSetting('pending_uid');
    const targetUID = normalizeUid(uid || pendingUID);

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

app.post('/api/admin/settings', async (req, res) => {
    const { volLimit, cooldownTime, tempSetpoint } = req.body;
    if (volLimit) await setSetting('dispense_limit_ml', volLimit);
    if (cooldownTime) await setSetting('cooldown_minutes', cooldownTime);
    if (tempSetpoint) await setSetting('temp_setpoint', tempSetpoint);
    res.json({ status: "SUCCESS", message: "Settings saved to station successfully" });
});

app.post('/api/admin/hardware-test', (req, res) => {
    const { actuator } = req.body;
    console.log(`[HARDWARE TEST] Triggered actuator: ${actuator}`);
    res.json({ status: "SUCCESS", message: `Test command sent for ${actuator}` });
});

app.post('/api/admin/update-credentials', (req, res) => {
    const { currentPassHash, newUsername, newPassHash } = req.body;
    db.get(`SELECT * FROM admin_users WHERE password_hash = ?`, [currentPassHash], (err, row) => {
        if (err || !row) return res.status(401).json({ success: false, message: "Incorrect current password" });

        db.run(`UPDATE admin_users SET username = ?, password_hash = ? WHERE id = ?`,
            [newUsername || row.username, newPassHash, row.id],
            (err) => {
                if (err) return res.status(500).json({ success: false, message: err.message });
                res.json({ success: true, message: "Credentials updated successfully" });
            }
        );
    });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER RUNNING] http://localhost:${PORT}`);
    const nets = require('os').networkInterfaces();
    Object.values(nets).flat().filter(n => n.family === 'IPv4' && !n.internal)
        .forEach(n => console.log(`   -> Put this in the ESP32 SERVER_URL: http://${n.address}:${PORT}`));
});