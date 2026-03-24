const db = require('../config/db');

// GET /api/announcements — each role sees relevant announcements
exports.getAnnouncements = async (req, res, next) => {
  try {
    const { role, id: userId, groupId } = req.user;
    let sql, params = [];

    if (role === 'pastor') {
      // Pastor sees all announcements
      sql = `SELECT a.*, u.full_name as author_name, u.role as author_role,
                    g.name as group_name
             FROM announcements a
             JOIN users u ON a.author_id = u.id
             LEFT JOIN \`groups\` g ON a.group_id = g.id
             ORDER BY a.created_at DESC`;
    } else {
      // Members/leaders see church-wide + their group announcements
      sql = `SELECT a.*, u.full_name as author_name, u.role as author_role,
                    g.name as group_name
             FROM announcements a
             JOIN users u ON a.author_id = u.id
             LEFT JOIN \`groups\` g ON a.group_id = g.id
             WHERE a.scope = 'church'
                OR (a.scope = 'group' AND a.group_id = ?)
             ORDER BY a.created_at DESC`;
      params = [groupId || 0];
    }

    const [rows] = await db.execute(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// POST /api/announcements — pastor broadcasts to church, leaders to their group
exports.createAnnouncement = async (req, res, next) => {
  try {
    const { role, id: authorId, groupId } = req.user;
    const { title_en, title_sw, body_en, body_sw, scope } = req.body;

    // Members cannot broadcast
    if (role === 'member') return res.status(403).json({ success: false, message: 'Members cannot post announcements.' });

    // Group leaders can only broadcast to their group
    const finalScope = role === 'pastor' ? (scope || 'church') : 'group';
    const finalGroupId = finalScope === 'group' ? groupId : null;

    const [result] = await db.execute(
      `INSERT INTO announcements (title_en, title_sw, body_en, body_sw, scope, group_id, author_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title_en, title_sw, body_en, body_sw, finalScope, finalGroupId, authorId]
    );
    const [rows] = await db.execute(
      `SELECT a.*, u.full_name as author_name FROM announcements a
       JOIN users u ON a.author_id = u.id WHERE a.id = ?`, [result.insertId]
    );
    res.status(201).json({ success: true, data: rows[0], message: 'Announcement published.' });
  } catch (err) { next(err); }
};

// DELETE /api/announcements/:id — pastor or original author
exports.deleteAnnouncement = async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;
    const [rows] = await db.execute('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Announcement not found.' });
    if (role !== 'pastor' && rows[0].author_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    await db.execute('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Announcement deleted.' });
  } catch (err) { next(err); }
};