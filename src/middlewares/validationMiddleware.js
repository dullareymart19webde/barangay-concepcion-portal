const { isValidPhNumber } = require('../utils/semaphore');

const VALID_CERT_TYPES = [
  'Barangay Clearance',
  'Certificate of Residency',
  'Certificate of Indigency'
];

const VALID_CIVIL_STATUSES = [
  'Single',
  'Married',
  'Widowed',
  'Separated',
  'Divorced'
];

const VALID_GENDERS = ['Male', 'Female', 'Other'];

/**
 * Basic HTML escaping to defend against stored XSS
 */
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .trim()
    .replace(/[<>]/g, ''); // Strip direct tags
}

/**
 * Validates Resident Certificate Application payload
 */
function validateRequestApplication(req, res, next) {
  const errors = [];
  const body = req.body;

  // 1. Certificate Type
  if (!body.certType || !VALID_CERT_TYPES.includes(body.certType.trim())) {
    errors.push(`Invalid certificate type. Must be one of: ${VALID_CERT_TYPES.join(', ')}.`);
  }

  // 2. Personal Information
  if (!body.firstName || !body.firstName.trim()) {
    errors.push('First name is required.');
  }

  if (!body.lastName || !body.lastName.trim()) {
    errors.push('Last name is required.');
  }

  if (!body.purok || !body.purok.trim()) {
    errors.push('Purok / Street address in Barangay Concepcion is required.');
  }

  if (!body.birthDate || isNaN(Date.parse(body.birthDate))) {
    errors.push('A valid Date of Birth is required.');
  }

  if (!body.civilStatus || !VALID_CIVIL_STATUSES.includes(body.civilStatus.trim())) {
    errors.push(`Civil status must be one of: ${VALID_CIVIL_STATUSES.join(', ')}.`);
  }

  if (!body.gender || !VALID_GENDERS.includes(body.gender.trim())) {
    errors.push(`Gender must be one of: ${VALID_GENDERS.join(', ')}.`);
  }

  // 3. Contact Number Validation
  if (!body.contactNumber || !isValidPhNumber(body.contactNumber)) {
    errors.push('A valid 11-digit Philippine mobile number is required (e.g., 09XXXXXXXXX or +639XXXXXXXXX).');
  }

  // 4. Email Validation (Required for Resend official receipts & status updates)
  if (!body.email || !body.email.trim()) {
    errors.push('A valid email address is required so you can receive status updates and digital receipts via Resend.');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email.trim())) {
      errors.push('Please provide a valid email address (e.g. resident@gmail.com).');
    }
  }

  // 5. Purpose
  if (!body.purpose || !body.purpose.trim()) {
    errors.push('Purpose of certificate request is required.');
  }

  // 6. Data Privacy Consent
  const consent = body.privacyConsent;
  if (consent !== true && consent !== 'true' && consent !== 'on' && consent !== '1') {
    errors.push('You must agree to the Data Privacy Act terms and conditions before submitting.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors
    });
  }

  // Sanitize text inputs
  req.body.firstName = sanitizeInput(body.firstName);
  req.body.middleName = sanitizeInput(body.middleName || '');
  req.body.lastName = sanitizeInput(body.lastName);
  req.body.suffix = sanitizeInput(body.suffix || '');
  req.body.purok = sanitizeInput(body.purok);
  req.body.purpose = sanitizeInput(body.purpose);
  req.body.cedulaNo = sanitizeInput(body.cedulaNo || '');
  req.body.email = sanitizeInput(body.email || '').toLowerCase();

  next();
}

/**
 * Validates Admin Status Update payload
 */
function validateStatusUpdate(req, res, next) {
  const { status, remarks } = req.body;
  const allowedStatuses = [
    'Pending Review',
    'Processing',
    'Ready for Pickup',
    'Released',
    'Rejected'
  ];

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`
    });
  }

  if (status === 'Rejected' && (!remarks || !remarks.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason/remarks are mandatory when rejecting a request.'
    });
  }

  next();
}

module.exports = {
  validateRequestApplication,
  validateStatusUpdate,
  sanitizeInput
};

