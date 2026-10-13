const db = require('../config/database');
const StatusLog = require('./StatusLog');
const firestoreAdapter = require('../config/firestoreAdapter');

const isFirestore = () => {
  const client = (process.env.DB_CLIENT || 'sqlite').toLowerCase();
  return client === 'firestore' || client === 'firebase';
};

class Request {
  static async create(data) {
    if (isFirestore()) {
      return await firestoreAdapter.createRequest(data);
    }

    const {
      controlNumber,
      certType,
      firstName,
      middleName = '',
      lastName,
      suffix = '',
      purok,
      birthDate,
      civilStatus,
      gender,
      contactNumber,
      email = null,
      purpose,
      yearsOfResidency = 1,
      cedulaNo = null,
      validIdPath = null,
      adminRemarks = null
    } = data;

    const result = await db.query(
      `INSERT INTO requests (
        control_number, cert_type, first_name, middle_name, last_name, suffix,
        purok, birth_date, civil_status, gender, contact_number, email, purpose,
        years_of_residency, cedula_no, valid_id_path, status, admin_remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Review', ?)`,
      [
        controlNumber,
        certType,
        firstName.trim(),
        middleName ? middleName.trim() : null,
        lastName.trim(),
        suffix ? suffix.trim() : null,
        purok.trim(),
        birthDate,
        civilStatus,
        gender,
        contactNumber.trim(),
        email ? String(email).trim().toLowerCase() : null,
        purpose.trim(),
        Number(yearsOfResidency) || 1,
        cedulaNo ? cedulaNo.trim() : null,
        validIdPath,
        adminRemarks
      ]
    );

    const requestId = result.insertId;

    await StatusLog.create({
      requestId,
      oldStatus: null,
      newStatus: 'Pending Review',
      remarks: 'Online resident request submitted via portal.',
      changedBy: 'Resident Portal'
    });

    return requestId;
  }

  static async findByControlNumber(controlNumber) {
    if (!controlNumber) return null;
    if (isFirestore()) {
      return await firestoreAdapter.findRequestByControlNumber(controlNumber);
    }
    return await db.queryOne(
      `SELECT * FROM requests WHERE UPPER(control_number) = UPPER(?)`,
      [controlNumber.trim()]
    );
  }

  static async findById(id) {
    if (isFirestore()) {
      return await firestoreAdapter.findRequestById(id);
    }
    return await db.queryOne(
      'SELECT * FROM requests WHERE id = ?',
      [id]
    );
  }

  static async findAll({
    status = '',
    certType = '',
    search = '',
    dateFrom = '',
    dateTo = '',
    page = 1,
    limit = 10
  } = {}) {
    if (isFirestore()) {
      return await firestoreAdapter.findRequests({
        status,
        certType,
        search,
        dateFrom,
        dateTo,
        page,
        limit
      });
    }

    const conditions = [];
    const params = [];

    if (status && status !== 'All') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (certType && certType !== 'All') {
      conditions.push('cert_type = ?');
      params.push(certType);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(control_number LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR contact_number LIKE ? OR email LIKE ? OR purpose LIKE ?)');
      params.push(term, term, term, term, term, term);
    }

    if (dateFrom) {
      conditions.push('created_at >= ?');
      params.push(`${dateFrom} 00:00:00`);
    }

    if (dateTo) {
      conditions.push('created_at <= ?');
      params.push(`${dateTo} 23:59:59`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM requests ${whereClause}`;
    const countRes = await db.queryOne(countSql, params);
    const total = countRes ? countRes.total : 0;

    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (pageNum - 1) * pageLimit;

    const listSql = `
      SELECT id, control_number, cert_type, first_name, middle_name, last_name, suffix,
             purok, birth_date, civil_status, gender, contact_number, purpose,
             years_of_residency, cedula_no, valid_id_path, status, admin_remarks,
             created_at, updated_at
      FROM requests
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const listParams = [...params, pageLimit, offset];
    const listRes = await db.query(listSql, listParams);

    return {
      requests: listRes.rows,
      pagination: {
        total,
        page: pageNum,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit) || 1
      }
    };
  }

  static async updateStatus(id, newStatus, remarks = '', changedBy = 'Barangay Staff') {
    if (isFirestore()) {
      return await firestoreAdapter.updateRequestStatus(id, newStatus, remarks, changedBy);
    }

    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('Request record not found');
    }

    const oldStatus = existing.status;
    const finalRemarks = remarks ? remarks.trim() : existing.admin_remarks;

    await db.query(
      `UPDATE requests 
       SET status = ?, admin_remarks = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, finalRemarks, id]
    );

    await StatusLog.create({
      requestId: id,
      oldStatus,
      newStatus,
      remarks: finalRemarks,
      changedBy
    });

    return await this.findById(id);
  }

  static async getMetrics() {
    if (isFirestore()) {
      return await firestoreAdapter.getMetrics();
    }

    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const phTime = new Date(utc + (3600000 * 8));
    const todayStr = phTime.toISOString().slice(0, 10);

    const totalRow = await db.queryOne('SELECT COUNT(*) AS total FROM requests');
    const pendingRow = await db.queryOne("SELECT COUNT(*) AS total FROM requests WHERE status = 'Pending Review'");
    const processingRow = await db.queryOne("SELECT COUNT(*) AS total FROM requests WHERE status = 'Processing'");
    const readyRow = await db.queryOne("SELECT COUNT(*) AS total FROM requests WHERE status = 'Ready for Pickup'");
    const releasedRow = await db.queryOne("SELECT COUNT(*) AS total FROM requests WHERE status = 'Released'");
    const rejectedRow = await db.queryOne("SELECT COUNT(*) AS total FROM requests WHERE status = 'Rejected'");
    
    const todayRow = await db.queryOne(
      'SELECT COUNT(*) AS total FROM requests WHERE created_at >= ?',
      [`${todayStr} 00:00:00`]
    );

    const certTypesRes = await db.query(`
      SELECT cert_type, COUNT(*) AS count
      FROM requests
      GROUP BY cert_type
    `);

    const statusBreakdownRes = await db.query(`
      SELECT status, COUNT(*) AS count
      FROM requests
      GROUP BY status
    `);

    return {
      kpi: {
        total: totalRow ? totalRow.total : 0,
        pending: pendingRow ? pendingRow.total : 0,
        processing: processingRow ? processingRow.total : 0,
        readyForPickup: readyRow ? readyRow.total : 0,
        released: releasedRow ? releasedRow.total : 0,
        rejected: rejectedRow ? rejectedRow.total : 0,
        today: todayRow ? todayRow.total : 0
      },
      certTypes: certTypesRes.rows,
      statusBreakdown: statusBreakdownRes.rows
    };
  }
}

module.exports = Request;
