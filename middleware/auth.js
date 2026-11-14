const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sa-dev-secret-change-in-production';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function extractToken(req) {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') ? h.slice(7) : null;
}

// Generic: any valid JWT
function auth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

// Role guard factory
function requireRole(...roles) {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
      next();
    } catch { res.status(401).json({ error: 'Invalid or expired token' }); }
  };
}

module.exports = { auth, requireRole, signToken };
