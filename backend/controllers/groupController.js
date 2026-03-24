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
      [name, name_sw, type, leader_id, description, req.params.id]
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