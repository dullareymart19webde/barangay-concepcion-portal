const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const requestRoutes = require('./routes/requestRoutes');
const adminRoutes = require('./routes/adminRoutes');
const RequestController = require('./controllers/requestController');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Security and standard parsers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const PUBLIC_DIR = fs.existsSync(path.resolve(__dirname, '../public'))
  ? path.resolve(__dirname, '../public')
  : path.resolve(process.cwd(), 'public');

const UPLOADS_DIR = process.env.VERCEL
  ? path.resolve('/tmp/uploads')
  : path.resolve(__dirname, '../uploads');

// Serve static assets and uploaded IDs
app.use(express.static(PUBLIC_DIR, { dotfiles: 'allow' }));
app.use('/uploads', express.static(UPLOADS_DIR, { dotfiles: 'allow' }));

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------
app.use('/api/requests', requestRoutes);
app.get('/api/track/:controlNumber', RequestController.trackRequest);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    jurisdiction: 'Barangay Concepcion, Valencia City, Bukidnon',
    timestamp: new Date().toISOString()
  });
});

// -------------------------------------------------------------
// Frontend Clean Route Aliases
// -------------------------------------------------------------
const sendHtml = (res, filename) => {
  const filePath = path.join(PUBLIC_DIR, filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  const rootPath = path.join(process.cwd(), 'public', filename);
  if (fs.existsSync(rootPath)) {
    return res.sendFile(rootPath);
  }
  return res.redirect(`/${filename}`);
};

app.get('/track', (req, res) => {
  sendHtml(res, 'track.html');
});

app.get('/request', (req, res) => {
  sendHtml(res, 'request.html');
});

app.get('/admin', (req, res) => {
  sendHtml(res, 'admin-login.html');
});

app.get('/admin/login', (req, res) => {
  sendHtml(res, 'admin-login.html');
});

app.get('/admin/dashboard', (req, res) => {
  sendHtml(res, 'admin-dashboard.html');
});

app.get('/admin/print/:controlNumber', (req, res) => {
  sendHtml(res, 'certificate-template.html');
});

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found'
  });
});

// Fallback to home page for frontend HTML navigation
app.use((req, res) => {
  sendHtml(res, 'index.html');
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;
