require('dotenv').config();
const { firestoreDb } = require('../config/firebase');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function cleanFirestore() {
  if (!firestoreDb) {
    console.log('⚠️ [Firestore] Not initialized or not connected. Skipping Firestore cleanup.');
    return;
  }

  console.log('🔥 [Firestore] Cleaning test and demo collections...');
  const collections = ['requests', 'status_logs', 'sms_logs', 'email_logs'];

  for (const colName of collections) {
    const colRef = firestoreDb.collection(colName);
    const snapshot = await colRef.get();

    if (snapshot.empty) {
      console.log(`   - ${colName}: 0 documents (Already clean)`);
      continue;
    }

    const batch = firestoreDb.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`   - ${colName}: Deleted ${snapshot.size} documents (Now 0)`);
  }

  // Verify admins collection is kept intact
  const adminsSnap = await firestoreDb.collection('admins').get();
  console.log(`   🛡️ admins: Preserved ${adminsSnap.size} official admin accounts for login.`);
}

function cleanSqlite() {
  const dbPath = path.resolve(process.env.SQLITE_DB_PATH || './data/barangay_concepcion.sqlite');
  if (!fs.existsSync(dbPath)) {
    console.log('ℹ️ [SQLite] Database file not found. Skipping SQLite cleanup.');
    return;
  }

  console.log('\n💾 [SQLite] Cleaning local tables...');
  const sqlite = new Database(dbPath);

  try {
    const delLogs = sqlite.prepare('DELETE FROM status_logs').run();
    const delSms = sqlite.prepare('DELETE FROM sms_logs').run();
    const delReqs = sqlite.prepare('DELETE FROM requests').run();
    
    // Vacuum database to reclaim disk space
    sqlite.exec('VACUUM;');

    const adminCount = sqlite.prepare('SELECT COUNT(*) as count FROM admins').get().count;

    console.log(`   - requests: Deleted ${delReqs.changes} records (Now 0)`);
    console.log(`   - status_logs: Deleted ${delLogs.changes} records (Now 0)`);
    console.log(`   - sms_logs: Deleted ${delSms.changes} records (Now 0)`);
    console.log(`   🛡️ admins: Preserved ${adminCount} official accounts for login.`);
  } finally {
    sqlite.close();
  }
}

async function runCleanup() {
  console.log('================================================================');
  console.log('🧹 BARANGAY E-CERTIFICATE PORTAL - DATABASE SANITIZATION');
  console.log('================================================================');
  
  await cleanFirestore();
  cleanSqlite();

  console.log('================================================================');
  console.log('✨ Database is now 100% clean and fresh for production defense!');
  console.log('================================================================\n');
}

runCleanup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Database cleanup error:', err);
    process.exit(1);
  });

