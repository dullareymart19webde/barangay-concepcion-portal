const db = require('../config/database');
const firestoreAdapter = require('../config/firestoreAdapter');

const isFirestore = () => {
  const client = (process.env.DB_CLIENT || 'sqlite').toLowerCase();
  return client === 'firestore' || client === 'firebase';
};

class SmsLog {
  static async create({ requestId, recipientNumber, message, apiResponse, status = 'MOCK_SENT' }) {
    if (isFirestore()) {
      return await firestoreAdapter.createSmsLog({ requestId, recipientNumber, message, apiResponse, status });
    }

    const result = await db.query(
      `INSERT INTO sms_logs (request_id, recipient_number, message, api_response, status)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, recipientNumber, message, apiResponse, status]
    );
    return result.insertId;
  }

  static async getAll({ limit = 50, offset = 0 } = {}) {
    if (isFirestore()) {
      return await firestoreAdapter.getSmsLogs({ limit, offset });
    }

    const listRes = await db.query(
      `SELECT s.id, s.request_id, s.recipient_number, s.message, s.api_response, s.status, s.created_at,
              r.control_number, r.first_name, r.last_name, r.cert_type
       FROM sms_logs s
       LEFT JOIN requests r ON s.request_id = r.id
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [Number(limit), Number(offset)]
    );

    const countRes = await db.queryOne('SELECT COUNT(*) AS total FROM sms_logs');
    return {
      logs: listRes.rows,
      total: countRes ? countRes.total : 0
    };
  }

  static async getByRequestId(requestId) {
    if (isFirestore()) {
      const all = await firestoreAdapter.getSmsLogs({ limit: 100 });
      return (all.logs || []).filter(l => l.request_id === requestId);
    }

    const res = await db.query(
      `SELECT id, request_id, recipient_number, message, api_response, status, created_at
       FROM sms_logs
       WHERE request_id = ?
       ORDER BY created_at DESC`,
      [requestId]
    );
    return res.rows;
  }
}

module.exports = SmsLog;
