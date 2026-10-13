const db = require('../config/database');
const SmsLog = require('../models/SmsLog');

/**
 * Normalizes Philippine mobile numbers to standard 11-digit format (09XXXXXXXXX)
 */
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+63')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('63') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Validates Philippine mobile number format (09XXXXXXXXX)
 */
function isValidPhNumber(phone) {
  const normalized = normalizePhoneNumber(phone);
  return /^09\d{9}$/.test(normalized);
}

/**
 * Dispatches an SMS notification via Semaphore API or fallback simulation mode.
 * 
 * @param {Object} options
 * @param {string} options.recipient - Target mobile number
 * @param {string} options.message - SMS body text
 * @param {number|null} options.requestId - Optional linked request ID
 * @returns {Promise<{success: boolean, mode: string, apiResponse?: any}>}
 */
async function sendSms({ recipient, message, requestId = null }) {
  const normalizedNumber = normalizePhoneNumber(recipient);
  const apiKey = process.env.SEMAPHORE_API_KEY || 'MOCK';
  const senderName = process.env.SEMAPHORE_SENDER_NAME || 'BRGYCONCEP';
  const isSimulation = 
    process.env.SMS_SIMULATION_MODE === 'true' || 
    apiKey === 'MOCK' || 
    apiKey === 'MOCK_DEV_KEY' || 
    apiKey === 'YOUR_SEMAPHORE_API_KEY';

  if (isSimulation) {
    // -------------------------------------------------------------
    // SIMULATION MODE: Visual Logger & Database Log
    // -------------------------------------------------------------
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    console.log('\n============================================================');
    console.log('📱 [SEMAPHORE SMS GATEWAY - DISPATCH LOGGER]');
    console.log(`⏰ Time:      ${timestamp} (PST)`);
    console.log(`👤 Recipient: ${normalizedNumber}`);
    console.log(`🏢 Sender:    ${senderName}`);
    console.log(`📄 RequestID: ${requestId || 'N/A'}`);
    console.log('💬 Message:');
    console.log(`   "${message}"`);
    console.log('============================================================\n');

    const mockResponse = JSON.stringify({
      status: 'success',
      recipient: normalizedNumber,
      message_length: message.length,
      note: 'Dispatched via Gateway Logger'
    });

    try {
      await SmsLog.create({
        requestId,
        recipientNumber: normalizedNumber,
        message,
        apiResponse: mockResponse,
        status: 'SENT'
      });
    } catch (dbErr) {
      console.error('[SMS Logger] Failed to save dispatch log in DB:', dbErr.message);
    }

    return {
      success: true,
      mode: 'logger',
      recipient: normalizedNumber,
      message
    };
  }

  // -------------------------------------------------------------
  // LIVE MODE: Real Semaphore API Call
  // -------------------------------------------------------------
  try {
    const payload = {
      apikey: apiKey,
      number: normalizedNumber,
      message: message,
      sendername: senderName
    };

    const response = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json().catch(() => ({}));

    const isSuccess = response.ok;
    const logStatus = isSuccess ? 'SENT' : 'FAILED';

    try {
      await SmsLog.create({
        requestId,
        recipientNumber: normalizedNumber,
        message,
        apiResponse: JSON.stringify(responseData),
        status: logStatus
      });
    } catch (dbErr) {
      console.error('[SMS Gateway] Failed to write SMS log to database:', dbErr.message);
    }

    return {
      success: isSuccess,
      mode: 'live',
      apiResponse: responseData
    };
  } catch (error) {
    console.error('[SMS Gateway Error] Semaphore dispatch failed:', error.message);

    try {
      await SmsLog.create({
        requestId,
        recipientNumber: normalizedNumber,
        message,
        apiResponse: JSON.stringify({ error: error.message }),
        status: 'FAILED'
      });
    } catch (dbErr) {
      console.error('[SMS Gateway] Failed to write error log to database:', dbErr.message);
    }

    return {
      success: false,
      mode: 'live',
      error: error.message
    };
  }
}

/**
 * Generates official SMS message templates for standard Philippine Barangay transactions
 */
const SmsTemplates = {
  submitted: (name, certType, controlNo) =>
    `Maayong adlaw ${name}! Nadawat ang imong request para sa ${certType}. Imong Control No: ${controlNo}. I-track kini sa atong portal. Salamat! - Brgy. Concepcion`,

  processing: (name, certType, controlNo) =>
    `Maayong adlaw ${name}! Gisugdan na ang pag-proseso sa imong ${certType} (Control No: ${controlNo}) sa Barangay Concepcion. Salamat sa paghulat!`,

  readyForPickup: (name, certType, controlNo, remarks = '') => {
    let msg = `Maayong adlaw ${name}! Andam na alang sa pickup ang imong ${certType} (Control No: ${controlNo}) sa Barangay Concepcion Hall. Palihug dala ug 1 valid ID ug CTC.`;
    if (remarks) msg += ` Note: ${remarks}`;
    msg += ` Office hours: 8AM-5PM (Mon-Fri). Salamat!`;
    return msg;
  },

  released: (name, certType, controlNo) =>
    `Maayong adlaw ${name}! Malampusong na-release ang imong ${certType} (Control No: ${controlNo}). Daghang salamat sa imong kooperasyon! - Brgy. Concepcion`,

  rejected: (name, certType, controlNo, reason = '') =>
    `Maayong adlaw ${name}! Ang imong request para sa ${certType} (Control No: ${controlNo}) wala ma-aprobahan. Rason: ${reason || 'Palihug bisitaha ang Barangay Hall'}. - Brgy. Concepcion`
};

module.exports = {
  sendSms,
  normalizePhoneNumber,
  isValidPhNumber,
  SmsTemplates
};

