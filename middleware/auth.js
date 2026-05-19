const crypto = require('crypto');
const sessions = new Set();

function login(password) {
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) return null;
  const token = crypto.randomBytes(32).toString('hex');
  sessions.add(token);
  return token;
}

function logout(token) {
  sessions.delete(token);
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.token = token;
  next();
}

module.exports = { login, logout, auth };
