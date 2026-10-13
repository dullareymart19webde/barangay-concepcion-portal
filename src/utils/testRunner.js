/**
 * Comprehensive Automated Test Suite
 * Validates Endpoints, Flow, Database, and SMS Integration
 */
const http = require('http');
const app = require('../app');
const db = require('../config/database');

let server;
const PORT = 3099;

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({ ...options, port: PORT, host: 'localhost' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      if (typeof body === 'string') {
        req.write(body);
      } else {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Barangay E-Certificate Portal Automated Verification...\n');

  server = app.listen(PORT);
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await request({ path: '/api/health', method: 'GET' });
    assert(health.status === 200 && health.body.status === 'ok', 'Health check endpoint returns 200 OK');

    // 2. Submit new certificate request
    const newReqPayload = {
      certType: 'Barangay Clearance',
      firstName: 'Maricar',
      middleName: 'Alcantara',
      lastName: 'Montenegro',
      suffix: '',
      purok: 'Purok 3 - Poblacion',
      birthDate: '1998-04-22',
      civilStatus: 'Single',
      gender: 'Female',
      contactNumber: '09179998877',
      purpose: 'Job Application at Bukidnon Agro Ventures',
      yearsOfResidency: 6,
      cedulaNo: 'CCI2026-778899',
      privacyConsent: 'true'
    };

    const submitRes = await request({ path: '/api/requests', method: 'POST' }, newReqPayload);
    assert(submitRes.status === 201, 'POST /api/requests returns 201 Created');
    assert(submitRes.body.success === true, 'Response contains success=true');
    assert(/^BC-\d{8}-[A-Z0-9]{4}$/.test(submitRes.body.controlNumber), `Valid Control Number generated: ${submitRes.body.controlNumber}`);
    assert(submitRes.body.qrCode && submitRes.body.qrCode.startsWith('data:image/png'), 'QR code data URL generated');

    const testControlNo = submitRes.body.controlNumber;
    const testReqId = submitRes.body.data.id;

    // 3. Track request
    const trackRes = await request({ path: `/api/track/${testControlNo}`, method: 'GET' });
    assert(trackRes.status === 200, 'GET /api/track/:controlNumber returns 200 OK');
    assert(trackRes.body.data.status === 'Pending Review', 'Initial status is Pending Review');
    assert(trackRes.body.data.currentStage === 1, 'Current stage is 1 (Submitted/Pending)');
    assert(trackRes.body.data.timeline.length >= 1, 'Audit timeline has initial entry');

    // 4. Admin login
    const loginRes = await request(
      { path: '/api/admin/login', method: 'POST' },
      { username: 'secretary', password: 'Secretary@123' }
    );
    assert(loginRes.status === 200, 'Admin login with secretary account returns 200 OK');
    assert(loginRes.body.token != null, 'Admin token received');
    const adminToken = loginRes.body.token;

    // 5. Admin overview metrics
    const overviewRes = await request({
      path: '/api/admin/overview',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(overviewRes.status === 200, 'Admin overview metrics returns 200 OK');
    assert(overviewRes.body.data.kpi.total >= 1, `Total requests tracked: ${overviewRes.body.data.kpi.total}`);

    // 6. Admin requests listing with search
    const listRes = await request({
      path: `/api/admin/requests?search=${testControlNo}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(listRes.status === 200, 'Admin requests listing returns 200 OK');
    assert(listRes.body.requests.length === 1, 'Search by control number found exact record');

    // 7. Update status to 'Ready for Pickup'
    const updateRes = await request(
      {
        path: `/api/admin/requests/${testReqId}/status`,
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` }
      },
      {
        status: 'Ready for Pickup',
        remarks: 'Clearance approved. Bring 1 valid ID for release.',
        sendSmsAlert: true
      }
    );
    assert(updateRes.status === 200, 'PUT /api/admin/requests/:id/status returns 200 OK');
    assert(updateRes.body.data.status === 'Ready for Pickup', 'Status successfully changed to Ready for Pickup');

    // 8. Re-track request to verify pickup instructions appear
    const trackAfterUpdate = await request({ path: `/api/track/${testControlNo}`, method: 'GET' });
    assert(trackAfterUpdate.body.data.status === 'Ready for Pickup', 'Track reflects Ready for Pickup');
    assert(trackAfterUpdate.body.data.pickupInstructions != null, 'Pickup instructions included');
    assert(trackAfterUpdate.body.data.currentStage === 3, 'Current stage updated to 3 (Ready for Pickup)');

    // 9. Send manual SMS
    const manualSmsRes = await request(
      {
        path: '/api/admin/sms/send',
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      },
      {
        recipient: '09179998877',
        message: 'Barangay Concepcion Reminder: Please claim before 5:00 PM today.',
        requestId: testReqId
      }
    );
    assert(manualSmsRes.status === 200, 'POST /api/admin/sms/send returns 200 OK');

    // 10. SMS Logs
    const smsLogsRes = await request({
      path: '/api/admin/sms-logs',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(smsLogsRes.status === 200, 'Admin SMS logs returns 200 OK');
    assert(smsLogsRes.body.logs.length >= 3, `SMS logs recorded (${smsLogsRes.body.logs.length} logged dispatches)`);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
    if (failed === 0) {
      console.log('\n🎉 ALL 10 CORE AUTOMATED TESTS PASSED SUCCESSFULLY!\n');
    } else {
      console.log(`\n⚠️ Tests completed with ${failed} failure(s).\n`);
    }
  }
}

runTests();

