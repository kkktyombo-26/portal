const db = require('../config/db');

// GET /api/groups
exports.getGroups = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT g.*, u.full_name as leader_name,
              COUNT(m.id) as member_count
       FROM \`groups\` g
       LEFT JOIN users u ON g.leader_id = u.id
       LEFT JOIN users m ON m.group_id = g.id
       GROUP BY g.id ORDER BY g.name`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// GET /api/groups/:id
exports.getGroup = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT g.*, u.full_name as leader_name,
              COUNT(m.id) as member_count
       FROM \`groups\` g
       LEFT JOIN users u ON g.leader_id = u.id
       LEFT JOIN users m ON m.group_id = g.id
       WHERE g.id = ?
       GROUP BY g.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Group not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// POST /api/groups — pastor only
exports.createGroup = async (req, res, next) => {
  try {
    const { name, name_sw, type, leader_id, description } = req.body;
    const [result] = await db.execute(
      'INSERT INTO `groups` (name, name_sw, type, leader_id, description) VALUES (?, ?, ?, ?, ?)',
      [name, name_sw, type, leader_id || null, description || null]
    );
    const [rows] = await db.execute('SELECT * FROM `groups` WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0], message: 'Group created.' });
  } catch (err) { next(err); }
};

// PUT /api/groups/:id — pastor only
exports.updateGroup = async (req, res, next) => {
  try {
    const { name, name_sw, type, leader_id, description } = req.body;
    await db.execute(
      'UPDATE `groups` SET name=?, name_sw=?, type=?, leader_id=?, description=? WHERE id=?',
      [name, name_sw, type, leader_id || null, description || null, req.params.id]
    );
    const [rows] = await db.execute('SELECT * FROM `groups` WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// DELETE /api/groups/:id — pastor only
exports.deleteGroup = async (req, res, next) => {
  try {
    await db.execute('DELETE FROM `groups` WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Group deleted.' });
  } catch (err) { next(err); }
};

// GET /api/groups/:id/members
exports.getGroupMembers = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, full_name, role, phone FROM users WHERE group_id = ? ORDER BY full_name',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// POST /api/groups/:id/members — pastor only
exports.addGroupMember = async (req, res, next) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id is required' });
    await db.execute(
      'UPDATE users SET group_id = ? WHERE id = ?',
      [req.params.id, user_id]
    );
    res.json({ success: true, message: 'Member added.' });
  } catch (err) { next(err); }
};

// DELETE /api/groups/:id/members/:userId — pastor only
exports.removeGroupMember = async (req, res, next) => {
  try {
    await db.execute(
      'UPDATE users SET group_id = NULL WHERE id = ? AND group_id = ?',
      [req.params.userId, req.params.id]
    );
    res.json({ success: true, message: 'Member removed.' })
  } catch (err) { next(err); }
};