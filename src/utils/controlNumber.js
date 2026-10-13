const crypto = require('crypto');

/**
 * Generates a unique, human-readable control tracking number.
 * Format: BC-YYYYMMDD-XXXX (e.g., BC-20261014-8A4F)
 * Where BC = Barangay Concepcion
 * YYYYMMDD = Current Philippine date
 * XXXX = 4-character random uppercase alphanumeric string
 */
function generateControlNumber() {
  // Use Philippine standard time (UTC+8)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const phTime = new Date(utc + (3600000 * 8));

  const year = phTime.getFullYear();
  const month = String(phTime.getMonth() + 1).padStart(2, '0');
  const day = String(phTime.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // 4 random alphanumeric characters (excluding ambiguous characters 0, O, 1, I)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomStr = '';
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) {
    randomStr += chars[bytes[i] % chars.length];
  }

  return `BC-${dateStr}-${randomStr}`;
}

/**
 * Validates whether a given string adheres to the Barangay Concepcion control number format.
 */
function isValidControlNumber(controlNumber) {
  if (typeof controlNumber !== 'string') return false;
  const regex = /^BC-\d{8}-[A-Z0-9]{4}$/i;
  return regex.test(controlNumber.trim());
}

module.exports = {
  generateControlNumber,
  isValidControlNumber
};

