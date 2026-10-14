const qrcode = require('qrcode');
const Request = require('../models/Request');
const StatusLog = require('../models/StatusLog');
const { generateControlNumber, isValidControlNumber } = require('../utils/controlNumber');
const { sendSms, SmsTemplates, normalizePhoneNumber } = require('../utils/semaphore');
const { sendApplicationConfirmation } = require('../utils/resendEmail');

/**
 * Controller for Resident Online Certificate Requests and Tracking
 */
class RequestController {
  /**
   * POST /api/requests
   * Creates a new online certificate request, generates control number, and sends SMS/Email notifications
   */
  static async createRequest(req, res) {
    try {
      const {
        certType,
        firstName,
        middleName,
        lastName,
        suffix,
        purok,
        birthDate,
        civilStatus,
        gender,
        contactNumber,
        email,
        purpose,
        yearsOfResidency,
        cedulaNo
      } = req.body;

      // Handle uploaded valid ID file
      let validIdPath = null;
      if (req.file) {
        validIdPath = `/uploads/valid_ids/${req.file.filename}`;
      }

      const normalizedPhone = normalizePhoneNumber(contactNumber);

      // Business Rule: Prevent duplicate requests for the exact same document type while active
      // (Requests for DIFFERENT document types are permitted concurrently).
      const activeDuplicate = await Request.findActiveDuplicate({
        firstName,
        lastName,
        certType,
        contactNumber: normalizedPhone,
        email,
        birthDate
      });

      if (activeDuplicate) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_ACTIVE_REQUEST',
          message: `You currently have an active application for ${certType} under Control No. ${activeDuplicate.control_number} (Status: ${activeDuplicate.status}). Duplicate submissions for the same certificate are not permitted while an existing request is in progress.`,
          errors: [
            `You already have an active request for ${certType} (Control No: ${activeDuplicate.control_number}, Status: ${activeDuplicate.status}). Please wait for this application to be released or processed before requesting it again.`
          ],
          existingControlNumber: activeDuplicate.control_number,
          existingStatus: activeDuplicate.status,
          certType: activeDuplicate.cert_type
        });
      }

      // Generate unique control number: BC-YYYYMMDD-XXXX
      let controlNumber = generateControlNumber();
      // Ensure uniqueness defensively
      let existing = await Request.findByControlNumber(controlNumber);
      let attempts = 0;
      while (existing && attempts < 5) {
        controlNumber = generateControlNumber();
        existing = await Request.findByControlNumber(controlNumber);
        attempts++;
      }

      const requestId = await Request.create({
        controlNumber,
        certType,
        firstName,
        middleName,
        lastName,
        suffix,
        purok,
        birthDate,
        civilStatus,
        gender,
        contactNumber: normalizedPhone,
        email: email ? String(email).trim().toLowerCase() : null,
        purpose,
        yearsOfResidency,
        cedulaNo,
        validIdPath,
        adminRemarks: 'Application received. Pending administrative review.'
      });

      // Construct tracking URL
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const trackingUrl = `${appUrl}/track.html?ref=${encodeURIComponent(controlNumber)}`;

      // Generate QR Code data URL for easy resident scanning
      let qrCodeDataUrl = null;
      try {
        qrCodeDataUrl = await qrcode.toDataURL(trackingUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#0038A8', // Official Philippine Blue
            light: '#FFFFFF'
          }
        });
      } catch (qrErr) {
        console.warn('[QR Code Generation Warning]', qrErr.message);
      }

      // 1. Dispatch Email notification via Resend (Primary modern notification)
      if (email) {
        sendApplicationConfirmation({
          email,
          firstName,
          certType,
          controlNumber,
          requestId
        }).catch(err => {
          console.error('[Resend Async Confirmation Error]', err.message);
        });
      }

      // 2. Dispatch automated SMS fallback/simulation via Semaphore API
      const smsMessage = SmsTemplates.submitted(firstName, certType, controlNumber);
      sendSms({
        recipient: normalizedPhone,
        message: smsMessage,
        requestId
      }).catch(err => {
        console.error('[SMS Async Dispatch Error]', err.message);
      });

      return res.status(201).json({
        success: true,
        message: 'Your certificate request has been successfully submitted!',
        controlNumber,
        trackingUrl,
        qrCode: qrCodeDataUrl,
        data: {
          id: requestId,
          controlNumber,
          certType,
          applicantName: `${firstName} ${lastName}`.trim(),
          contactNumber: normalizedPhone,
          status: 'Pending Review',
          submittedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[RequestController.createRequest Error]', error);
      return res.status(500).json({
        success: false,
        message: 'An unexpected internal error occurred while processing your request.',
        error: error.message
      });
    }
  }

  /**
   * GET /api/track/:controlNumber
   * Resident tracking endpoint by Control Number
   */
  static async trackRequest(req, res) {
    try {
      const { controlNumber } = req.params;

      if (!controlNumber || !isValidControlNumber(controlNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Control Number format. Expected format: BC-YYYYMMDD-XXXX (e.g., BC-20261014-8A4F).'
        });
      }

      const request = await Request.findByControlNumber(controlNumber);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: `No certificate request found matching Control Number "${controlNumber}". Please check the number and try again.`
        });
      }

      // Fetch audit timeline
      const logs = await StatusLog.getByRequestId(request.id);

      // Determine numeric stage index for the progress bar:
      // 1: Pending Review (Submitted)
      // 2: Processing (Approved/In Progress)
      // 3: Ready for Pickup
      // 4: Released (Completed)
      // -1: Rejected
      const stageMap = {
        'Pending Review': 1,
        'Processing': 2,
        'Ready for Pickup': 3,
        'Released': 4,
        'Rejected': -1
      };

      const currentStage = stageMap[request.status] || 1;

      // Instructions tailored to current status
      let pickupInstructions = null;
      if (request.status === 'Ready for Pickup') {
        pickupInstructions = {
          location: 'Barangay Concepcion Hall, Purok 3, Valencia City, Bukidnon',
          officeHours: process.env.OFFICE_HOURS || 'Monday to Friday, 8:00 AM - 5:00 PM',
          hotline: process.env.BARANGAY_HOTLINE || '0917-828-4567 / (088) 828-1234',
          requirements: [
            '1 Valid Government-issued Photo ID (or School ID for students)',
            'Community Tax Certificate (Cedula / CTC)',
            'Applicable Barangay Fee (if any, Indigency is strictly FREE)',
            'Authorization letter if claimed by an authorized representative'
          ]
        };
      }

      return res.status(200).json({
        success: true,
        data: {
          controlNumber: request.control_number,
          certType: request.cert_type,
          fullName: `${request.first_name} ${request.middle_name ? request.middle_name + ' ' : ''}${request.last_name}${request.suffix ? ' ' + request.suffix : ''}`.trim(),
          purok: request.purok,
          contactNumber: request.contact_number,
          email: request.email || null,
          purpose: request.purpose,
          status: request.status,
          currentStage,
          adminRemarks: request.admin_remarks || 'Your application is currently under review by the Barangay Concepcion staff.',
          createdAt: request.created_at,
          updatedAt: request.updated_at,
          pickupInstructions,
          timeline: logs.map(l => ({
            id: l.id,
            status: l.new_status,
            remarks: l.remarks,
            changedBy: l.changed_by,
            timestamp: l.created_at
          }))
        }
      });
    } catch (error) {
      console.error('[RequestController.trackRequest Error]', error);
      return res.status(500).json({
        success: false,
        message: 'Unable to query request tracking details at this moment.',
        error: error.message
      });
    }
  }

  /**
   * GET /api/requests/:controlNumber
   * Fetch full request details (public or print view)
   */
  static async getByControlNumber(req, res) {
    try {
      const { controlNumber } = req.params;
      const request = await Request.findByControlNumber(controlNumber);

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Certificate request not found.'
        });
      }

      return res.status(200).json({
        success: true,
        data: request
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = RequestController;

