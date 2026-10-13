const { firestoreDb, isFirebaseReady } = require('./firebase');
const bcrypt = require('bcryptjs');

class FirestoreAdapter {
  constructor() {
    this.client = 'firestore';
  }

  getDb() {
    if (!firestoreDb) {
      throw new Error('Firestore is not initialized. Please ensure FIREBASE_PROJECT_ID is set in .env.');
    }
    return firestoreDb;
  }

  /**
   * Initializes Firestore collections with seed admins and realistic sample requests
   */
  async seedIfEmpty() {
    try {
      const db = this.getDb();
      const adminSnapshot = await db.collection('admins').limit(1).get();

      if (adminSnapshot.empty) {
        console.log('[Firestore] Seeding default admin accounts...');
        const adminHash = '$2b$10$esfi0XBmgoIMoqUMbEOTPuM5iC3fEl14FyVqtCNxLYQ5LXxJsODgS'; // Admin@123
        const secretaryHash = '$2b$10$5teH7BmxncVLi7i4DQFSRek/27sLIuXjqBfK0KYpAQ.aD0q0w5OK6'; // Secretary@123

        await db.collection('admins').doc('admin').set({
          username: 'admin',
          password_hash: adminHash,
          full_name: 'Hon. Merlyn G. Antiga (Punong Barangay)',
          role: 'Admin',
          created_at: new Date().toISOString()
        });

        await db.collection('admins').doc('secretary').set({
          username: 'secretary',
          password_hash: secretaryHash,
          full_name: 'Hon. Redin T. Butanas',
          role: 'Barangay Secretary',
          created_at: new Date().toISOString()
        });
      }

      // Production Clean: No dummy sample requests are auto-seeded.
    } catch (err) {
      console.warn('[Firestore Seeding Notice]', err.message);
    }
  }

  // --- REQUEST OPERATIONS ---

  async createRequest(data) {
    const db = this.getDb();
    const docRef = db.collection('requests').doc(data.controlNumber);
    const now = new Date().toISOString();

    const record = {
      id: data.controlNumber,
      control_number: data.controlNumber,
      cert_type: data.certType,
      first_name: data.firstName.trim(),
      middle_name: data.middleName ? data.middleName.trim() : '',
      last_name: data.lastName.trim(),
      suffix: data.suffix ? data.suffix.trim() : '',
      purok: data.purok.trim(),
      birth_date: data.birthDate,
      civil_status: data.civilStatus,
      gender: data.gender,
      contact_number: data.contactNumber.trim(),
      email: data.email ? data.email.trim().toLowerCase() : null,
      purpose: data.purpose.trim(),
      years_of_residency: Number(data.yearsOfResidency) || 1,
      cedula_no: data.cedulaNo ? data.cedulaNo.trim() : null,
      valid_id_path: data.validIdPath,
      status: 'Pending Review',
      admin_remarks: data.adminRemarks || 'Application received. Pending review.',
      created_at: now,
      updated_at: now
    };

    await docRef.set(record);

    await db.collection('status_logs').add({
      request_id: data.controlNumber,
      old_status: null,
      new_status: 'Pending Review',
      remarks: 'Online resident request submitted via portal.',
      changed_by: 'Resident Portal',
      created_at: now
    });

    return data.controlNumber;
  }

  async findRequestByControlNumber(controlNumber) {
    const db = this.getDb();
    const doc = await db.collection('requests').doc(controlNumber).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    // Fallback lookup by field
    const q = await db.collection('requests').where('control_number', '==', controlNumber).limit(1).get();
    if (!q.empty) {
      const d = q.docs[0];
      return { id: d.id, ...d.data() };
    }
    return null;
  }

  async findRequestById(id) {
    return await this.findRequestByControlNumber(id);
  }

  async findRequests({ status, certType, search, page = 1, limit = 10 } = {}) {
    const db = this.getDb();
    let query = db.collection('requests');

    if (status && status !== 'All') {
      query = query.where('status', '==', status);
    }
    if (certType && certType !== 'All') {
      query = query.where('cert_type', '==', certType);
    }

    const snapshot = await query.get();
    let allDocs = [];
    snapshot.forEach(doc => allDocs.push({ id: doc.id, ...doc.data() }));

    // In-memory search & sort (to ensure instant response without complex composite index configuration)
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      allDocs = allDocs.filter(d => 
        (d.control_number && d.control_number.toLowerCase().includes(term)) ||
        (d.first_name && d.first_name.toLowerCase().includes(term)) ||
        (d.last_name && d.last_name.toLowerCase().includes(term)) ||
        (d.contact_number && d.contact_number.includes(term)) ||
        (d.email && d.email.toLowerCase().includes(term)) ||
        (d.purpose && d.purpose.toLowerCase().includes(term))
      );
    }

    allDocs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = allDocs.length;
    const pageNum = Math.max(1, Number(page));
    const pageLimit = Math.max(1, Number(limit));
    const startIndex = (pageNum - 1) * pageLimit;
    const pagedDocs = allDocs.slice(startIndex, startIndex + pageLimit);

    return {
      requests: pagedDocs,
      pagination: {
        total,
        page: pageNum,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit) || 1
      }
    };
  }

  async updateRequestStatus(id, newStatus, remarks = '', changedBy = 'Barangay Staff') {
    const db = this.getDb();
    const existing = await this.findRequestById(id);
    if (!existing) throw new Error('Request record not found in Firestore.');

    const oldStatus = existing.status;
    const finalRemarks = remarks ? remarks.trim() : existing.admin_remarks;
    const now = new Date().toISOString();

    await db.collection('requests').doc(existing.id).update({
      status: newStatus,
      admin_remarks: finalRemarks,
      updated_at: now
    });

    await db.collection('status_logs').add({
      request_id: existing.id,
      old_status: oldStatus,
      new_status: newStatus,
      remarks: finalRemarks,
      changed_by: changedBy,
      created_at: now
    });

    return await this.findRequestById(id);
  }

  async getMetrics() {
    const db = this.getDb();
    const snapshot = await db.collection('requests').get();
    let total = 0, pending = 0, processing = 0, ready = 0, released = 0, rejected = 0, today = 0;
    const certCounts = {};
    const statusCounts = {};

    const todayStr = new Date().toISOString().slice(0, 10);

    snapshot.forEach(doc => {
      const data = doc.data();
      total++;
      if (data.status === 'Pending Review') pending++;
      else if (data.status === 'Processing') processing++;
      else if (data.status === 'Ready for Pickup') ready++;
      else if (data.status === 'Released') released++;
      else if (data.status === 'Rejected') rejected++;

      if (data.created_at && data.created_at.startsWith(todayStr)) {
        today++;
      }

      const ct = data.cert_type || 'Unknown';
      certCounts[ct] = (certCounts[ct] || 0) + 1;

      const st = data.status || 'Pending Review';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    return {
      kpi: {
        total,
        pending,
        processing,
        readyForPickup: ready,
        released,
        rejected,
        today
      },
      certTypes: Object.keys(certCounts).map(k => ({ cert_type: k, count: certCounts[k] })),
      statusBreakdown: Object.keys(statusCounts).map(k => ({ status: k, count: statusCounts[k] }))
    };
  }

  // --- LOG OPERATIONS ---

  async getStatusLogs(requestId) {
    const db = this.getDb();
    const snapshot = await db.collection('status_logs')
      .where('request_id', '==', requestId)
      .get();
    
    const logs = [];
    snapshot.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
    logs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return logs;
  }

  async createSmsLog(data) {
    const db = this.getDb();
    const docRef = await db.collection('sms_logs').add({
      request_id: data.requestId || null,
      recipient_number: data.recipientNumber,
      message: data.message,
      api_response: data.apiResponse,
      status: data.status || 'SENT',
      created_at: new Date().toISOString()
    });
    return docRef.id;
  }

  async getSmsLogs({ limit = 50, offset = 0 } = {}) {
    const db = this.getDb();
    const snapshot = await db.collection('sms_logs').get();
    let logs = [];
    snapshot.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = logs.length;
    const paged = logs.slice(offset, offset + Number(limit));
    return { logs: paged, total };
  }

  // --- ADMIN OPERATIONS ---

  async findAdminByUsername(username) {
    const db = this.getDb();
    const snapshot = await db.collection('admins')
      .where('username', '==', username.trim())
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }
}

module.exports = new FirestoreAdapter();

