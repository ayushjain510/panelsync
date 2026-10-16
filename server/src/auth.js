const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

// Single coordinator account: the password lives in the environment.
function login(req, res) {
  const given = (req.body && req.body.password) || '';
  if (!crypto.timingSafeEqual(digest(given), digest(process.env.ADMIN_PASSWORD))) {
    return res.status(401).json({ message: 'Wrong password' });
  }
  const token = jwt.sign({ role: 'coordinator' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Sign in again' });
  }
}

module.exports = { login, requireAuth };
