const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { authenticateAdmin } = require('../middlewares/authMiddleware');
const { validateStatusUpdate } = require('../middlewares/validationMiddleware');

// Public Admin Auth
router.post('/login', AdminController.login);
router.post('/logout', AdminController.logout);

// Protected Admin Routes
router.get('/me', authenticateAdmin, AdminController.getMe);
router.get('/overview', authenticateAdmin, AdminController.getOverview);
router.get('/requests', authenticateAdmin, AdminController.getRequests);
router.get('/requests/:id', authenticateAdmin, AdminController.getRequestDetails);
router.put('/requests/:id/status', authenticateAdmin, validateStatusUpdate, AdminController.updateStatus);
router.post('/sms/send', authenticateAdmin, AdminController.sendManualSms);
router.get('/sms-logs', authenticateAdmin, AdminController.getSmsLogs);
router.post('/email/send', authenticateAdmin, AdminController.sendManualEmail);
router.get('/email-logs', authenticateAdmin, AdminController.getEmailLogs);

module.exports = router;

