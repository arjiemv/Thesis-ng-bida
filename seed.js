const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

const testStudents = [
    { studentNum: '2024-00001-MN-0', name: 'Test Student 1', uid: '0B03F306' },
    { studentNum: '2024-00002-MN-0', name: 'Test Student 2', uid: '94BE6506' },
    
    // Space-formatted fallback variants if your current C++ sketch sends spaces
    { studentNum: '2024-00003-MN-0', name: 'Test Student 1 (Spaces)', uid: '0B 03 F3 06' },
    { studentNum: '2024-00004-MN-0', name: 'Test Student 2 (Spaces)', uid: '94 BE 65 06' }
];

db.serialize(() => {
    testStudents.forEach(s => {
        db.run(
            `INSERT OR REPLACE INTO students (student_number, full_name, rfid_uid) VALUES (?, ?, ?)`,
            [s.studentNum, s.name, s.uid],  
            (err) => {
                if (err) console.error(`Error adding ${s.name}:`, err.message);
                else console.log(`[SUCCESSFULLY REGISTERED] ${s.name} -> UID: ${s.uid}`);
            }
        );
    });
});