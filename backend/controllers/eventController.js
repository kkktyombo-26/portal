const db = require('../config/db');

// GET /api/events
exports.getEvents = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT e.*, u.full_name as created_by_name
       FROM events e
       LEFT JOIN users u ON e.created_by = u.id
       ORDER BY e.event_date ASC, e.start_time ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// POST /api/events — pastor only
exports.createEvent = async (req, res, next) => {
  try {
    const { title_en, title_sw, description_en, description_sw, event_date, start_time, end_time, location } = req.body;
    const [result] = await db.execute(
      `INSERT INTO events (title_en, title_sw, description_en, description_sw, event_date, start_time, end_time, location, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title_en, title_sw, description_en || null, description_sw || null, event_date, start_time, end_time || null, location || null, req.user.id]
    );
    const [rows] = await db.execute(
      `SELECT e.*, u.full_name as created_by_name FROM events e
       LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?`, [result.insertId]
    );
    res.status(201).json({ success: true, data: rows[0], message: 'Event created.' });
  } catch (err) { next(err); }
};

// DELETE /api/events/:id — pastor only
exports.deleteEvent = async (req, res, next) => {
  try {
    const [result] = await db.execute('DELETE FROM events WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, message: 'Event deleted.' });
  } catch (err) { next(err); }
};

// PUT /api/events/:id — pastor only
exports.updateEvent = async (req, res, next) => {
  try {
    const { title_en, title_sw, description_en, description_sw, event_date, start_time, end_time, location } = req.body;
    await db.execute(
      `UPDATE events SET title_en=?, title_sw=?, description_en=?, description_sw=?,
       event_date=?, start_time=?, end_time=?, location=? WHERE id=?`,
      [title_en, title_sw, description_en || null, description_sw || null, event_date, start_time, end_time || null, location || null, req.params.id]
    );
    const [rows] = await db.execute(
      `SELECT e.*, u.full_name as created_by_name FROM events e
       LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?`, [req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};
