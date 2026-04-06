const db = require('../config/db');
const bcrypt = require('bcryptjs');

// GET /api/members — role-restricted
const getMembers = async (req, res, next) => {
  try {
    const { role, id, group_id } = req.user;
    let sql, params = [];

    if (role === 'pastor') {
      sql = `SELECT u.id, u.full_name, u.email, u.role, u.phone,
                    u.avatar, u.profile_photo_url,
                    u.is_active, u.created_at, u.last_login,
                    g.name as group_name
             FROM users u LEFT JOIN \`groups\` g ON u.group_id = g.id
             ORDER BY u.role, u.full_name`;
    } else if (role === 'elder') {
      sql = `SELECT u.id, u.full_name, u.email, u.role, u.phone,
                    u.avatar, u.profile_photo_url,
                    u.is_active, u.created_at, g.name as group_name
             FROM users u LEFT JOIN \`groups\` g ON u.group_id = g.id
             WHERE u.role != 'pastor'
             ORDER BY u.role, u.full_name`;
    } else if (role === 'group_leader') {
      sql = `SELECT u.id, u.full_name, u.email, u.role, u.phone,
                    u.avatar, u.profile_photo_url,
                    u.is_active, u.created_at, g.name as group_name
             FROM users u LEFT JOIN \`groups\` g ON u.group_id = g.id
             WHERE u.group_id = ?
             ORDER BY u.full_name`;
      params = [group_id];
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [rows] = await db.execute(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// GET /api/members/:id
const getMember = async (req, res, next) => {
  try {
    const { role, group_id } = req.user;
    const targetId = parseInt(req.params.id);

    const [rows] = await db.execute(
      `SELECT u.id, u.full_name, u.email, u.role, u.phone,
              u.avatar, u.profile_photo_url,
              u.is_active, u.created_at, u.last_login,
              g.name as group_name, g.id as group_id
       FROM users u LEFT JOIN \`groups\` g ON u.group_id = g.id
       WHERE u.id = ?`,
      [targetId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const member = rows[0];

    if (role === 'member' && member.id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (role === 'group_leader' && member.group_id !== group_id && member.id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: member });
  } catch (err) { next(err); }
};

// POST /api/members — pastor only
const createMember = async (req, res, next) => {
  try {
    const { full_name, email, password, role, group_id, phone } = req.body;

    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    const hashed = await bcrypt.hash(password || 'Church@2024', 12);
    const [result] = await db.execute(
      'INSERT INTO users (full_name, email, password, role, group_id, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [full_name, email, hashed, role || 'member', group_id || null, phone || null]
    );

    const [rows] = await db.execute(
      `SELECT id, full_name, email, role, group_id, phone,
              avatar, profile_photo_url, created_at
       FROM users WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, data: rows[0], message: 'Member created successfully' });
  } catch (err) { next(err); }
};

// PUT /api/members/:id
const updateMember = async (req, res, next) => {
  try {
    const { role } = req.user;
    const targetId = parseInt(req.params.id);
    const { full_name, email, phone, group_id, is_active, role: newRole } = req.body;

    if ((newRole || is_active !== undefined) && role !== 'pastor') {
      return res.status(403).json({ success: false, message: 'Only the pastor can change roles or account status' });
    }

    await db.execute(
      `UPDATE users SET full_name = ?, email = ?, phone = ?,
       group_id = ?, is_active = ?, role = ? WHERE id = ?`,
      [full_name, email, phone || null, group_id || null,
       is_active !== undefined ? is_active : 1, newRole || 'member', targetId]
    );

    const [rows] = await db.execute(
      `SELECT id, full_name, email, role, group_id, phone,
              avatar, profile_photo_url, is_active
       FROM users WHERE id = ?`,
      [targetId]
    );

    res.json({ success: true, data: rows[0], message: 'Member updated successfully' });
  } catch (err) { next(err); }
};

// DELETE /api/members/:id — pastor only
const deleteMember = async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }
    const [result] = await db.execute('UPDATE users SET is_active = 0 WHERE id = ?', [targetId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    res.json({ success: true, message: 'Member deactivated successfully' });
  } catch (err) { next(err); }
};

module.exports = { getMembers, getMember, createMember, updateMember, deleteMember };