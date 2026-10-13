const express = require('express');
const router = express.Router();
const RequestController = require('../controllers/requestController');
const upload = require('../middlewares/uploadMiddleware');
const { validateRequestApplication } = require('../middlewares/validationMiddleware');

// POST /api/requests - Create new certificate request with valid ID upload
router.post(
  '/',
  upload.single('validId'),
  validateRequestApplication,
  RequestController.createRequest
);

// GET /api/requests/:controlNumber - Lookup by control number
router.get('/:controlNumber', RequestController.getByControlNumber);

module.exports = router;

