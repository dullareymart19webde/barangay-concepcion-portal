const app = require('./app');
const db = require('./config/database');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('\n================================================================');
  console.log('🏛️  BARANGAY E-CERTIFICATE PORTAL');
  console.log('📍  Barangay Concepcion, Valencia City, Bukidnon');
  console.log('================================================================');
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
  console.log(`🌐 Resident Portal:   http://localhost:${PORT}/`);
  console.log(`📝 Certificate Form:  http://localhost:${PORT}/request`);
  console.log(`🔍 Track Request:     http://localhost:${PORT}/track`);
  console.log(`🔐 Admin Portal:      http://localhost:${PORT}/admin`);
  console.log(`📱 SMS Gateway Mode:  ${process.env.SMS_SIMULATION_MODE === 'true' || process.env.SEMAPHORE_API_KEY === 'MOCK_DEV_KEY' ? 'LOGGER / DISPATCH ACTIVE' : 'LIVE (Semaphore API Active)'}`);
  console.log(`💾 Database Client:   ${(process.env.DB_CLIENT || 'sqlite').toUpperCase()}${process.env.DB_CLIENT === 'firestore' ? ' (Cloud: ' + process.env.FIREBASE_PROJECT_ID + ')' : ''}`);
  console.log('================================================================\n');
});

