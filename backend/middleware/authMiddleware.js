const jwt = require('jsonwebtoken');

/**
 * protect — verifies the Bearer JWT token on incoming requests.
 * Attaches decoded payload (id, role, email) to req.user.
 */
exports.protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, email, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
};

/**
 * authorize(...roles) — restricts access to specific roles.
 * Must be used AFTER protect middleware.
 *
 * Usage: router.get('/', protect, authorize('Admin', 'Manager'), handler)
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Your role '${req.user?.role}' does not have permission to perform this action.`,
      });
    }
    next();
  };
};
