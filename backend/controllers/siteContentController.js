// controllers/siteContentController.js
// Manages editable UI content blocks stored in the site_content table.
// Auth: read is public; write requires pastor or elder.

const db = require('../config/db');

// ─── Allowed block keys ───────────────────────────────────────────────────────
// Whitelist prevents arbitrary keys being injected by a bad actor.
const ALLOWED_KEYS = new Set([
  'hero_slides',
  'gallery_slides',
  'schedule',
  'pastor_hours',
  'translations_en',
  'translations_sw',
  'staff',
]);

// ─── GET /api/site-content (public) ──────────────────────────────────────────
// Returns all blocks as { block_key: data, … } — one request, zero N+1.
exports.getAllContent = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      'SELECT block_key, data FROM site_content ORDER BY block_key'
    );
    const map = {};
    rows.forEach(r => { map[r.block_key] = r.data; });
    res.json({ success: true, data: map });
  } catch (err) { next(err); }
};

// ─── GET /api/site-content/:key (public) ─────────────────────────────────────
exports.getContent = async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(404).json({ success: false, message: 'Unknown content block.' });
    }
    const [rows] = await db.execute(
      'SELECT block_key, data, updated_at FROM site_content WHERE block_key = ?',
      [key]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Content block not found.' });
    }
    res.json({ success: true, data: rows[0].data, updatedAt: rows[0].updated_at });
  } catch (err) { next(err); }
};

// ─── PUT /api/site-content/:key (pastor | elder) ─────────────────────────────
// Upserts a block. Body must be the JSON value directly (not wrapped).
exports.upsertContent = async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ success: false, message: 'Unknown content block key.' });
    }

    const payload = req.body;
    if (payload === undefined || payload === null) {
      return res.status(400).json({ success: false, message: 'Request body is required.' });
    }

    // MySQL's JSON column accepts a serialised string
    const jsonValue = JSON.stringify(payload);

    await db.execute(
      `INSERT INTO site_content (block_key, data, updated_by)
         VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         data       = VALUES(data),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [key, jsonValue, req.user.id]
    );

    const [rows] = await db.execute(
      'SELECT block_key, data, updated_at FROM site_content WHERE block_key = ?',
      [key]
    );

    res.json({
      success:   true,
      message:   `Block "${key}" saved.`,
      data:      rows[0].data,
      updatedAt: rows[0].updated_at,
    });
  } catch (err) { next(err); }
};

// ─── DELETE /api/site-content/:key (pastor only) ─────────────────────────────
// Resets a block to the hardcoded default (removes DB row so frontend falls back).
exports.deleteContent = async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(404).json({ success: false, message: 'Unknown content block.' });
    }
    const [result] = await db.execute(
      'DELETE FROM site_content WHERE block_key = ?', [key]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Block not found.' });
    }
    res.json({ success: true, message: `Block "${key}" reset to default.` });
  } catch (err) { next(err); }
};