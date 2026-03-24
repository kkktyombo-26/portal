const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const generateToken = (user) => jwt.sign(
  { id: user.id, role: user.role, name: user.full_name, groupId: user.group_id },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { full_name, email, password, role, group_id, phone } = req.body;
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(409).json({ success: false, message: 'Email already registered.' });
    const hashed = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      'INSERT INTO users (full_name, email, password, role, group_id, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [full_name, email, hashed, role || 'member', group_id || null, phone || null]
    );
    const [rows] = await db.execute('SELECT id, full_name, email, role, group_id, phone, created_at FROM users WHERE id = ?', [result.insertId]);
    const token = generateToken(rows[0]);
    res.status(201).json({ success: true, token, user: rows[0] });
  } catch (err) { next(err); }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const user = rows[0];
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Account has been deactivated. Contact your pastor.' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const token = generateToken(user);
    const { password: _, ...safeUser } = user;
    res.json({ success: true, token, user: safeUser });
  } catch (err) { next(err); }
};

// GET /api/auth/me
exports.me = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.full_name, u.email, u.role, u.phone, u.avatar, u.is_active, u.created_at,
              g.name as group_name, g.type as group_type
       FROM users u
       LEFT JOIN groups g ON u.group_id = g.id
       WHERE u.id = ?`, [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: rows[0] });
  } catch (err) { next(err); }
};
