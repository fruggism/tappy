const { pool } = require('../db');
const { hashToken } = require('../token');

async function requireAuth(req, res, next) {
  try {
    const header = req.get('Authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1].trim() : req.query.token;

    if (!token) {
      return res.status(401).json({ error: 'Token mancante. Usa "Authorization: Bearer <token>".' });
    }

    const { rows } = await pool.query('SELECT id, name FROM users WHERE token_hash = $1', [hashToken(token)]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Token non valido.' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };
