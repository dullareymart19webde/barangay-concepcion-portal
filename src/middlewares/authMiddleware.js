const jwt = require('jsonwebtoken');
const { firebaseAuth } = require('../config/firebase');

const JWT_SECRET = process.env.JWT_SECRET || 'barangay_concepcion_valencia_secure_jwt_token_2026_xyz';

/**
 * Middleware to authenticate Admin / Staff using JWT or Firebase ID token in Authorization header or Cookies
 */
async function authenticateAdmin(req, res, next) {
  let token = null;

  // 1. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Check Cookie fallback
  if (!token && req.cookies && req.cookies.admin_token) {
    token = req.cookies.admin_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please login with your administrative credentials.'
    });
  }

  // A. Try internal JWT verification
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded; // { id, username, fullName, role }
    return next();
  } catch (jwtErr) {
    // B. Fallback: Verify as Firebase ID Token
    if (firebaseAuth) {
      try {
        const fbUser = await firebaseAuth.verifyIdToken(token);
        req.admin = {
          id: fbUser.uid,
          username: fbUser.email || fbUser.uid,
          fullName: fbUser.name || fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Administrator'),
          role: fbUser.role || (fbUser.admin ? 'Admin' : 'Barangay Secretary')
        };
        return next();
      } catch (fbErr) {
        // Continue to 401
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Session expired or invalid token. Please login again.'
    });
  }
}

/**
 * Middleware to restrict access based on user role (e.g., 'Admin', 'Barangay Secretary')
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not possess the required permissions.'
      });
    }

    next();
  };
}

module.exports = {
  authenticateAdmin,
  requireRole,
  JWT_SECRET
};

