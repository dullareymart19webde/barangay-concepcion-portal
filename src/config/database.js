const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_CLIENT = process.env.DB_CLIENT || 'sqlite';

let dbAdapter = null;

// ====================================================================
// SQLite Implementation (Zero-config, instant local execution)
// ====================================================================
function initSqlite() {
  const Database = require('better-sqlite3');
  const dbPath = path.resolve(process.env.SQLITE_DB_PATH || './data/barangay_concepcion.sqlite');
  
  // Ensure data directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Auto-bootstrap schema in SQLite if not already created
  bootstrapSqliteSchema(sqlite);

  return {
    client: 'sqlite',
    query: async (sqlText, params = []) => {
      // Normalize MySQL-specific syntax to standard SQLite where needed
      let cleanSql = sqlText.trim();
      
      const isSelect = /^\s*(SELECT|PRAGMA)/i.test(cleanSql);
      if (isSelect) {
        const stmt = sqlite.prepare(cleanSql);
        const rows = stmt.all(...params);
        return { rows, insertId: null, affectedRows: 0 };
      } else {
        const stmt = sqlite.prepare(cleanSql);
        const info = stmt.run(...params);
        return {
          rows: [],
          insertId: Number(info.lastInsertRowid),
          affectedRows: info.changes
        };
      }
    },
    queryOne: async (sqlText, params = []) => {
      const stmt = sqlite.prepare(sqlText);
      const row = stmt.get(...params);
      return row || null;
    },
    close: () => sqlite.close()
  };
}

function bootstrapSqliteSchema(sqlite) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Barangay Secretary',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      control_number TEXT NOT NULL UNIQUE,
      cert_type TEXT NOT NULL,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      suffix TEXT,
      purok TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      civil_status TEXT NOT NULL,
      gender TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      purpose TEXT NOT NULL,
      years_of_residency INTEGER NOT NULL DEFAULT 1,
      cedula_no TEXT,
      valid_id_path TEXT,
      status TEXT NOT NULL DEFAULT 'Pending Review',
      admin_remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS status_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      remarks TEXT,
      changed_by TEXT NOT NULL DEFAULT 'System',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sms_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER,
      recipient_number TEXT NOT NULL,
      message TEXT NOT NULL,
      api_response TEXT,
      status TEXT NOT NULL DEFAULT 'MOCK_SENT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_requests_control ON requests(control_number);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
    CREATE INDEX IF NOT EXISTS idx_requests_contact ON requests(contact_number);
  `);

  // Seed default admin accounts if table is empty
  const adminCount = sqlite.prepare('SELECT COUNT(*) AS count FROM admins').get().count;
  if (adminCount === 0) {
    const insertAdmin = sqlite.prepare(`
      INSERT INTO admins (username, password_hash, full_name, role)
      VALUES (?, ?, ?, ?)
    `);

    // admin: Admin@123
    insertAdmin.run(
      'admin',
      '$2b$10$esfi0XBmgoIMoqUMbEOTPuM5iC3fEl14FyVqtCNxLYQ5LXxJsODgS',
      'Hon. Merlyn G. Antiga (Punong Barangay)',
      'Admin'
    );

    // secretary: Secretary@123
    insertAdmin.run(
      'secretary',
      '$2b$10$5teH7BmxncVLi7i4DQFSRek/27sLIuXjqBfK0KYpAQ.aD0q0w5OK6',
      'Hon. Redin T. Butanas',
      'Barangay Secretary'
    );
  }

  // Seed initial sample requests for Barangay Concepcion if empty
  const reqCount = sqlite.prepare('SELECT COUNT(*) AS count FROM requests').get().count;
  if (reqCount === 0) {
    const insertReq = sqlite.prepare(`
      INSERT INTO requests (
        control_number, cert_type, first_name, middle_name, last_name, suffix,
        purok, birth_date, civil_status, gender, contact_number, purpose,
        years_of_residency, cedula_no, valid_id_path, status, admin_remarks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
    `);

    const r1 = insertReq.run(
      'BC-20261012-7A12', 'Barangay Clearance', 'Juan', 'Mercado', 'Dela Cruz', '',
      'Purok 4 - Pag-asa', '1995-06-15', 'Single', 'Male', '09171234567',
      'Local Employment Requirement (Valencia City Commercial)', 5, 'CCI2026-987123', null,
      'Ready for Pickup', 'Application verified. Please bring 1 valid ID and CTC for verification during pickup.',
      '-1 day'
    );

    const r2 = insertReq.run(
      'BC-20261013-3F90', 'Certificate of Indigency', 'Maria Lourdes', 'Santos', 'Macaspac', '',
      'Purok 2 - Maharlika', '1988-11-20', 'Married', 'Female', '09289876543',
      'Medical Assistance at Bukidnon Provincial Hospital', 12, null, null,
      'Processing', 'Under review by Committee on Social Services. Verification of indigent status ongoing.',
      '-5 hours'
    );

    const r3 = insertReq.run(
      'BC-20261013-8D44', 'Certificate of Residency', 'Carlos Jose', 'Reyes', 'Villanueva', 'Jr.',
      'Purok 6 - Riverside', '2004-03-08', 'Single', 'Male', '09395551234',
      'Scholarship Application (Bukidnon State University)', 8, 'CCI2026-112344', null,
      'Pending Review', 'Newly submitted request. Awaiting staff review.',
      '-1 hour'
    );

    const r4 = insertReq.run(
      'BC-20261011-1B2C', 'Barangay Clearance', 'Ana Patricia', 'Gomez', 'Tan', '',
      'Purok 1 - Centro', '1992-09-02', 'Married', 'Female', '09183334455',
      'Philippine National Police (PNP) Clearance', 15, 'CCI2026-443211', null,
      'Released', 'Document signed by Punong Barangay and officially released.',
      '-2 days'
    );

    const r5 = insertReq.run(
      'BC-20261010-9E55', 'Certificate of Residency', 'Roberto', 'Alvarez', 'Diaz', 'III',
      'Purok 5 - San Isidro', '2001-01-30', 'Single', 'Male', '09276667788',
      'Bank Account Opening requirement', 1, null, null,
      'Rejected', 'Uploaded ID was blurry and could not verify Concepcion residence. Please visit Barangay Hall with utility bill.',
      '-3 days'
    );

    // Initial logs for sample requests
    const insertLog = sqlite.prepare(`
      INSERT INTO status_logs (request_id, old_status, new_status, remarks, changed_by, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', ?))
    `);
    const insertSms = sqlite.prepare(`
      INSERT INTO sms_logs (request_id, recipient_number, message, api_response, status, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', ?))
    `);

    [
      { id: r1.lastInsertRowid, no: 'BC-20261012-7A12', name: 'Juan', phone: '09171234567', type: 'Barangay Clearance', off: '-1 day' },
      { id: r2.lastInsertRowid, no: 'BC-20261013-3F90', name: 'Maria Lourdes', phone: '09289876543', type: 'Certificate of Indigency', off: '-5 hours' },
      { id: r3.lastInsertRowid, no: 'BC-20261013-8D44', name: 'Carlos Jose', phone: '09395551234', type: 'Certificate of Residency', off: '-1 hour' },
      { id: r4.lastInsertRowid, no: 'BC-20261011-1B2C', name: 'Ana Patricia', phone: '09183334455', type: 'Barangay Clearance', off: '-2 days' },
      { id: r5.lastInsertRowid, no: 'BC-20261010-9E55', name: 'Roberto', phone: '09276667788', type: 'Certificate of Residency', off: '-3 days' }
    ].forEach(item => {
      insertLog.run(item.id, null, 'Pending Review', 'Initial online application submitted by resident.', 'System', item.off);
      insertSms.run(
        item.id,
        item.phone,
        `Maayong adlaw ${item.name}! Nadawat ang imong request para sa ${item.type}. Imong Control No: ${item.no}. I-track kini sa atong portal. Salamat! - Brgy. Concepcion`,
        '{"status":"success","mode":"simulation"}',
        'MOCK_SENT',
        item.off
      );
    });
  }
}

// ====================================================================
// MySQL Implementation (For production or local MySQL instance)
// ====================================================================
function initMysql() {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'barangay_concepcion_db',
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  return {
    client: 'mysql',
    query: async (sqlText, params = []) => {
      const [result] = await pool.execute(sqlText, params);
      if (Array.isArray(result)) {
        return { rows: result, insertId: null, affectedRows: 0 };
      } else {
        return {
          rows: [],
          insertId: result.insertId,
          affectedRows: result.affectedRows
        };
      }
    },
    queryOne: async (sqlText, params = []) => {
      const [rows] = await pool.execute(sqlText, params);
      return rows && rows.length > 0 ? rows[0] : null;
    },
    close: () => pool.end()
  };
}

// Factory initialization with automatic fallback if MySQL is configured but unreachable
try {
  if (DB_CLIENT.toLowerCase() === 'mysql') {
    dbAdapter = initMysql();
    console.log('[DB] Configured with MySQL Client (Pool initialized).');
  } else {
    dbAdapter = initSqlite();
    console.log('[DB] Configured with SQLite Client (Local database ready).');
  }
} catch (err) {
  console.warn(`[DB] Failed to initialize requested ${DB_CLIENT} client: ${err.message}. Falling back to SQLite.`);
  dbAdapter = initSqlite();
}

module.exports = dbAdapter;

