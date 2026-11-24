const jwt = require('jsonwebtoken');

/**
 * The token signs the member's group as `groupId` — see generateToken() in
 * authController.js and phoneLoginController.js. Several controllers read
 * `req.user.group_id` instead, which was always undefined, silently breaking
 * group_leader access in the meetings and forms modules.
 *
 * Rather than patch nine call sites, expose both spellings here so neither can
 * be undefined. New code should prefer `groupId`; this keeps the older
 * `group_id` readers working until they're migrated.
 */
function normaliseUser(decoded) {
  const user = { ...decoded };

  const groupId = user.groupId ?? user.group_id ?? null;
  user.groupId  = groupId;
  user.group_id = groupId;

  return user;
}

// Verify JWT token
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = normaliseUser(decoded);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// Role-based access control
const authorize = (...roles) => (req, res, next) => {
  // Guard against a route that forgot `authenticate` first. Without this,
  // req.user is undefined and the role check throws a TypeError, which the
  // error handler turns into a 500 instead of a clean 401.
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied. Insufficient permissions.' });
  }

  next();
};

module.exports = { authenticate, authorize };