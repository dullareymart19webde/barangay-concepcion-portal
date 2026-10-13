const db = require('../config/database');
const firestoreAdapter = require('../config/firestoreAdapter');

const isFirestore = () => {
  const client = (process.env.DB_CLIENT || 'sqlite').toLowerCase();
  return client === 'firestore' || client === 'firebase';
};

class StatusLog {
  static async create({ requestId, oldStatus, newStatus, remarks, changedBy = 'System' }) {
    if (isFirestore()) {
      return null; // Handled directly in updateRequestStatus in Firestore
    }

    const result = await db.query(
      `INSERT INTO status_logs (request_id, old_status, new_status, remarks, changed_by)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, oldStatus || null, newStatus, remarks || null, changedBy]
    );
    return result.insertId;
  }

  static async getByRequestId(requestId) {
    if (isFirestore()) {
      return await firestoreAdapter.getStatusLogs(requestId);
    }

    const res = await db.query(
      `SELECT id, request_id, old_status, new_status, remarks, changed_by, created_at
       FROM status_logs
       WHERE request_id = ?
       ORDER BY created_at ASC`,
      [requestId]
    );
    return res.rows;
  }
}

module.exports = StatusLog;
