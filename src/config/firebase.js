const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');
const fs = require('fs');

const projectId = process.env.FIREBASE_PROJECT_ID || 'brgy-concepcion-valencia';
const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || './serviceAccountKey.json';

let isFirebaseReady = false;
let firestoreDb = null;
let firestoreStorage = null;
let firebaseAuth = null;

try {
  let serviceAccount = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim().startsWith('{')) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      console.warn('[Firebase] Could not parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON string:', e.message);
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
    } catch (e) {
      console.warn('[Firebase] Could not parse FIREBASE_SERVICE_ACCOUNT_BASE64:', e.message);
    }
  } else {
    const resolvedKeyPath = path.resolve(keyPath);
    if (fs.existsSync(resolvedKeyPath)) {
      serviceAccount = require(resolvedKeyPath);
    }
  }

  if (serviceAccount) {
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
        storageBucket: `${projectId}.appspot.com`
      });
    }
    console.log(`[Firebase] Initialized with Service Account Key for project: ${serviceAccount.project_id || projectId}`);
    isFirebaseReady = true;
  } else {
    // Project ID initialization
    if (!getApps().length) {
      initializeApp({
        projectId,
        storageBucket: `${projectId}.appspot.com`
      });
    }
    console.log(`[Firebase] Initialized with Project ID: ${projectId}`);
    isFirebaseReady = true;
  }

  firestoreDb = getFirestore();
  firestoreStorage = getStorage();
  firebaseAuth = getAuth();
} catch (err) {
  console.warn(`[Firebase] Initialization Notice: ${err.message}.`);
  isFirebaseReady = false;
}

module.exports = {
  getFirestore,
  getStorage,
  getAuth,
  firestoreDb,
  firestoreStorage,
  firebaseAuth,
  isFirebaseReady,
  projectId
};

