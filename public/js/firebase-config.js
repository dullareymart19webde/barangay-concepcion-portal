// Firebase Web SDK Configuration for Barangay Concepcion Portal
const firebaseConfig = {
  projectId: "brgy-concepcion-valencia",
  appId: "1:480789665705:web:387c8a98533f142ed516b8",
  storageBucket: "brgy-concepcion-valencia.firebasestorage.app",
  apiKey: "AIzaSyDYRXWvM5LJPcHJiWu7K1FlCJnVJ4aYbRs",
  authDomain: "brgy-concepcion-valencia.firebaseapp.com",
  messagingSenderId: "480789665705"
};

if (typeof window !== 'undefined') {
  window.FIREBASE_CONFIG = firebaseConfig;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = firebaseConfig;
}

