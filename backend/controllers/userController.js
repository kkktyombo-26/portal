const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getUsers = async (req, res, next) => {
  try {
    const { role, id: userId, groupId } = req.user;
    let sql, params = [];

    if (role === 'pastor') {
      sql = `SELECT u.id, u.full_name, u.email, u.role, u.phone,
                    u.avatar, u.profile_photo_url,
                    u.is_active, u.created_at,
                    g.name as group_name
             FROM users u LEFT JOIN \`groups\` g ON u.group_id = g.id
             ORDER BY u.created_at DESC`;
    } else if (['elder', 'group_leader'].includes(role)) {
      sql = `SELECT u.id, u.full_name, u.role, u.phone,
                    u.avatar, u.profile_photo_url,
                    u.is_active, u.created_at,
                    g.name as group_name
             FROM users u LEFT JOIN \`groups\` g ON u.group_id = g.id
             WHERE u.group_id = ? ORDER BY u.created_at DESC`;
      params = [groupId];
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [rows] = await db.execute(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getUser = async (req, res, next) => {
  try {
    const { role, groupId } = req.user;
    const [rows] = await db.execute(
      `SELECT u.id, u.full_name, u.email, u.role, u.phone,
              u.avatar, u.profile_photo_url,
              u.is_active, u.created_at,
              g.name as group_name, g.type as group_type
       FROM users u LEFT JOIN \`groups\` g ON u.group_id = g.id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });
    const user = rows[0];
    if (role === 'group_leader' && user.group_id !== groupId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { role } = req.user;
    const targetId = parseInt(req.params.id);
    if (role !== 'pastor' && req.user.id !== targetId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const { full_name, phone, role: newRole, group_id, is_active } = req.body;
    const fields = [], params = [];
    if (full_name)               { fields.push('full_name = ?');  params.push(full_name); }
    if (phone !== undefined)     { fields.push('phone = ?');      params.push(phone); }
    if (role === 'pastor') {
      if (newRole)               { fields.push('role = ?');       params.push(newRole); }
      if (group_id !== undefined) { fields.push('group_id = ?');  params.push(group_id); }
      if (is_active !== undefined){ fields.push('is_active = ?'); params.push(is_active); }
    }
    if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update.' });
    params.push(targetId);
    await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    const [rows] = await db.execute(
      `SELECT id, full_name, email, role, phone, avatar, profile_photo_url, is_active
       FROM users WHERE id = ?`,
      [targetId]
    );
    res.json({ success: true, data: rows[0], message: 'User updated.' });
  } catch (err) { next(err); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const [result] = await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: 'Member removed.' });
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const [[total]]         = await db.execute('SELECT COUNT(*) as count FROM users');
    const [[active]]        = await db.execute('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    const [[groups]]        = await db.execute('SELECT COUNT(*) as count FROM `groups`');
    const [[announcements]] = await db.execute('SELECT COUNT(*) as count FROM announcements WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    res.json({
      success: true,
      data: {
        totalMembers:        total.count,
        activeMembers:       active.count,
        totalGroups:         groups.count,
        recentAnnouncements: announcements.count,
      },
    });
  } catch (err) { next(err); }
};