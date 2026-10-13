const db = require('../config/database');
const firestoreAdapter = require('../config/firestoreAdapter');
const bcrypt = require('bcryptjs');

const isFirestore = () => {
  const client = (process.env.DB_CLIENT || 'sqlite').toLowerCase();
  return client === 'firestore' || client === 'firebase';
};

class Admin {
  static async findByUsername(username) {
    if (isFirestore()) {
      return await firestoreAdapter.findAdminByUsername(username);
    }

    return await db.queryOne(
      'SELECT id, username, password_hash, full_name, role, created_at FROM admins WHERE username = ?',
      [username.trim()]
    );
  }

  static async findById(id) {
    if (isFirestore()) {
      const dbInstance = firestoreAdapter.getDb();
      const doc = await dbInstance.collection('admins').doc(String(id)).get();
      if (doc.exists) return { id: doc.id, ...doc.data() };
      return null;
    }

    return await db.queryOne(
      'SELECT id, username, full_name, role, created_at FROM admins WHERE id = ?',
      [id]
    );
  }

  static async verifyPassword(plainPassword, passwordHash) {
    return await bcrypt.compare(plainPassword, passwordHash);
  }

  static async create({ username, password, fullName, role = 'Barangay Secretary' }) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    if (isFirestore()) {
      const dbInstance = firestoreAdapter.getDb();
      await dbInstance.collection('admins').doc(username.trim()).set({
        username: username.trim(),
        password_hash: hash,
        full_name: fullName.trim(),
        role,
        created_at: new Date().toISOString()
      });
      return username.trim();
    }

    const result = await db.query(
      `INSERT INTO admins (username, password_hash, full_name, role)
       VALUES (?, ?, ?, ?)`,
      [username.trim(), hash, fullName.trim(), role]
    );
    return result.insertId;
  }
}

module.exports = Admin;
