const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Request = require('../models/Request');
const StatusLog = require('../models/StatusLog');
const SmsLog = require('../models/SmsLog');
const { JWT_SECRET } = require('../middlewares/authMiddleware');
const { sendSms, SmsTemplates, normalizePhoneNumber } = require('../utils/semaphore');
const { sendStatusUpdateNotification, sendEmail } = require('../utils/resendEmail');
const { firebaseAuth, firestoreDb } = require('../config/firebase');

class AdminController {
  /**
   * POST /api/admin/login
   * Authenticates administrative user via Firebase Auth or standard credentials and issues JWT cookie/token
   */
  static async login(req, res) {
    try {
      const { username, password, email, idToken } = req.body;
      const targetIdentifier = email || username;

      // 1. Authenticate via Firebase ID Token (if provided from client Firebase Auth SDK)
      if (idToken && firebaseAuth) {
        try {
          const decoded = await firebaseAuth.verifyIdToken(idToken);
          const emailStr = decoded.email || '';
          let role = decoded.role || (decoded.admin ? 'Admin' : 'Barangay Secretary');
          let fullName = decoded.name || decoded.displayName || 'Hon. Merlyn G. Antiga (Punong Barangay)';

          if (emailStr.includes('secretary') || role === 'Barangay Secretary') {
            role = 'Barangay Secretary';
            fullName = 'Hon. Redin T. Butanas';
          } else {
            role = 'Admin';
            fullName = 'Hon. Merlyn G. Antiga (Punong Barangay)';
          }

          const token = jwt.sign(
            { id: decoded.uid, username: emailStr || decoded.uid, fullName, role },
            JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
          });

          return res.status(200).json({
            success: true,
            message: `Welcome back, ${fullName}!`,
            token,
            admin: { id: decoded.uid, username: emailStr || decoded.uid, fullName, role }
          });
        } catch (tokenErr) {
          console.warn('[Firebase Auth verifyIdToken Warning]', tokenErr.message);
          return res.status(401).json({
            success: false,
            message: 'Invalid or expired Firebase Authentication token.'
          });
        }
      }

      if (!targetIdentifier || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please provide both username/email and password.'
        });
      }

      // 2. If targetIdentifier is an email, authenticate with Firebase Auth REST API
      if (targetIdentifier.includes('@')) {
        const apiKey = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDYRXWvM5LJPcHJiWu7K1FlCJnVJ4aYbRs';
        try {
          const fbRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: targetIdentifier,
              password,
              returnSecureToken: true
            })
          });
          const fbData = await fbRes.json();

          if (fbData.idToken) {
            let role = 'Admin';
            let fullName = 'Hon. Merlyn G. Antiga (Punong Barangay)';
            if (fbData.email.includes('secretary')) {
              role = 'Barangay Secretary';
              fullName = 'Hon. Redin T. Butanas';
            }

            const token = jwt.sign(
              { id: fbData.localId, username: fbData.email, fullName, role },
              JWT_SECRET,
              { expiresIn: '24h' }
            );

            res.cookie('admin_token', token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 24 * 60 * 60 * 1000
            });

            return res.status(200).json({
              success: true,
              message: `Welcome back, ${fullName}!`,
              token,
              admin: { id: fbData.localId, username: fbData.email, fullName, role }
            });
          }
        } catch (fbApiErr) {
          console.warn('[Firebase Auth REST Error]', fbApiErr.message);
        }
      }

      // 3. Fallback: Local database authentication (for test suite and backward compatibility)
      const admin = await Admin.findByUsername(targetIdentifier);
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid administrative credentials.'
        });
      }

      const isMatch = await Admin.verifyPassword(password, admin.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid administrative credentials.'
        });
      }

      // Generate JWT Token (valid for 24 hours)
      const token = jwt.sign(
        {
          id: admin.id,
          username: admin.username,
          fullName: admin.full_name,
          role: admin.role
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Set secure HTTP-only cookie
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      return res.status(200).json({
        success: true,
        message: `Welcome back, ${admin.full_name}!`,
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          fullName: admin.full_name,
          role: admin.role
        }
      });
    } catch (error) {
      console.error('[AdminController.login Error]', error);
      return res.status(500).json({
        success: false,
        message: 'Login failed due to an internal server error.'
      });
    }
  }

  /**
   * POST /api/admin/logout
   */
  static async logout(req, res) {
    res.clearCookie('admin_token');
    return res.status(200).json({
      success: true,
      message: 'Successfully logged out.'
    });
  }

  /**
   * GET /api/admin/me
   */
  static async getMe(req, res) {
    return res.status(200).json({
      success: true,
      admin: req.admin
    });
  }

  /**
   * GET /api/admin/overview
   * Dashboard KPI statistics and chart metrics
   */
  static async getOverview(req, res) {
    try {
      const metrics = await Request.getMetrics();
      return res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('[AdminController.getOverview Error]', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve overview analytics.'
      });
    }
  }

  /**
   * GET /api/admin/requests
   * Paginated and filterable list of certificate applications
   */
  static async getRequests(req, res) {
    try {
      const {
        status,
        certType,
        search,
        dateFrom,
        dateTo,
        page = 1,
        limit = 10
      } = req.query;

      const result = await Request.findAll({
        status,
        certType,
        search,
        dateFrom,
        dateTo,
        page,
        limit
      });

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[AdminController.getRequests Error]', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve requests list.'
      });
    }
  }

  /**
   * GET /api/admin/requests/:id
   * Complete application details, status audit history, and SMS logs
   */
  static async getRequestDetails(req, res) {
    try {
      const { id } = req.params;
      const request = await Request.findById(id);

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Certificate request not found.'
        });
      }

      const statusLogs = await StatusLog.getByRequestId(id);
      const smsLogs = await SmsLog.getByRequestId(id);

      return res.status(200).json({
        success: true,
        data: {
          request,
          statusLogs,
          smsLogs
        }
      });
    } catch (error) {
      console.error('[AdminController.getRequestDetails Error]', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve request details.'
      });
    }
  }

  /**
   * PUT /api/admin/requests/:id/status
   * Updates status, writes audit trail, and triggers automated SMS notification
   */
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, remarks = '', sendSmsAlert = true } = req.body;
      const adminName = req.admin ? req.admin.fullName : 'Barangay Secretary';

      const existing = await Request.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Request not found.'
        });
      }

      // Update status & write status log
      const updated = await Request.updateStatus(id, status, remarks, adminName);

      // Automated SMS dispatch if requested
      let smsResult = null;
      if (sendSmsAlert) {
        let smsMessage = '';
        if (status === 'Ready for Pickup') {
          smsMessage = SmsTemplates.readyForPickup(
            existing.first_name,
            existing.cert_type,
            existing.control_number,
            remarks
          );
        } else if (status === 'Processing') {
          smsMessage = SmsTemplates.processing(
            existing.first_name,
            existing.cert_type,
            existing.control_number
          );
        } else if (status === 'Released') {
          smsMessage = SmsTemplates.released(
            existing.first_name,
            existing.cert_type,
            existing.control_number
          );
        } else if (status === 'Rejected') {
          smsMessage = SmsTemplates.rejected(
            existing.first_name,
            existing.cert_type,
            existing.control_number,
            remarks
          );
        }

        if (smsMessage) {
          smsResult = await sendSms({
            recipient: existing.contact_number,
            message: smsMessage,
            requestId: existing.id
          });
        }
      }

      // Automated Email dispatch via Resend if applicant provided email
      let emailResult = null;
      if (existing.email) {
        try {
          emailResult = await sendStatusUpdateNotification({
            email: existing.email,
            firstName: existing.first_name,
            certType: existing.cert_type,
            controlNumber: existing.control_number,
            status,
            remarks,
            requestId: existing.id || existing.control_number
          });
        } catch (emailErr) {
          console.warn('[Resend Status Alert Warning]', emailErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: `Status updated to "${status}" successfully.`,
        data: updated,
        smsResult,
        emailResult
      });
    } catch (error) {
      console.error('[AdminController.updateStatus Error]', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update request status.',
        error: error.message
      });
    }
  }

  /**
   * POST /api/admin/sms/send
   * Direct manual SMS dispatch tool with pre-filled templates
   */
  static async sendManualSms(req, res) {
    try {
      const { recipient, message, requestId = null } = req.body;

      if (!recipient || !message || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Both recipient phone number and SMS message text are required.'
        });
      }

      const normalizedPhone = normalizePhoneNumber(recipient);
      const result = await sendSms({
        recipient: normalizedPhone,
        message: message.trim(),
        requestId: requestId ? Number(requestId) : null
      });

      return res.status(200).json({
        success: true,
        message: result.mode === 'simulation'
          ? 'SMS simulated and recorded in SMS logs.'
          : 'SMS successfully dispatched via Semaphore API.',
        result
      });
    } catch (error) {
      console.error('[AdminController.sendManualSms Error]', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to dispatch manual SMS.',
        error: error.message
      });
    }
  }

  /**
   * POST /api/admin/email/send
   * Direct manual email dispatch tool via Resend
   */
  static async sendManualEmail(req, res) {
    try {
      const { recipient, subject, message, requestId = null } = req.body;

      if (!recipient || !message || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Both recipient email address and email message text are required.'
        });
      }

      const result = await sendEmail({
        to: recipient.trim(),
        subject: subject || '[Barangay Concepcion] Official Resident Notice',
        html: `<p style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #334155;">${message.replace(/\n/g, '<br/>')}</p>`,
        text: message.trim(),
        requestId: requestId || null
      });

      return res.status(200).json({
        success: true,
        message: result.mode === 'simulation'
          ? 'Email simulated and logged.'
          : 'Official email dispatched via Resend API.',
        result
      });
    } catch (error) {
      console.error('[AdminController.sendManualEmail Error]', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to dispatch manual email.',
        error: error.message
      });
    }
  }

  /**
   * GET /api/admin/sms-logs
   * View all SMS transmissions and simulation records
   */
  static async getSmsLogs(req, res) {
    try {
      const { limit = 50, page = 1 } = req.query;
      const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

      const result = await SmsLog.getAll({ limit, offset });
      return res.status(200).json({
        success: true,
        logs: result.logs,
        total: result.total,
        page: Number(page),
        limit: Number(limit)
      });
    } catch (error) {
      console.error('[AdminController.getSmsLogs Error]', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch SMS logs.'
      });
    }
  }

  /**
   * GET /api/admin/email-logs
   * View all Resend email transmissions and audit records
   */
  static async getEmailLogs(req, res) {
    try {
      const { limit = 50, page = 1 } = req.query;
      const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

      if (firestoreDb) {
        const snapshot = await firestoreDb.collection('email_logs').get();
        let logs = [];
        snapshot.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
        logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = logs.length;
        const paged = logs.slice(offset, offset + Number(limit));
        return res.status(200).json({
          success: true,
          logs: paged,
          total,
          page: Number(page),
          limit: Number(limit)
        });
      }

      return res.status(200).json({
        success: true,
        logs: [],
        total: 0,
        page: Number(page),
        limit: Number(limit)
      });
    } catch (error) {
      console.error('[AdminController.getEmailLogs Error]', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch email logs.'
      });
    }
  }
}

module.exports = AdminController;

