// controllers/uploadedFormController.js
const db = require('../config/db');

// ── visibility helper (mirrors formTemplateController) ─────────────────────
function visibilityWhere(user) {
  if (user.role === 'pastor' || user.role === 'elder') {
    return { clause: 'uf.is_active = 1', params: [] };
  }
  const groupId = user.group_id || 0;
  return {
    clause: "uf.is_active = 1 AND (uf.scope = 'church' OR uf.group_id = ?)",
    params: [groupId],
  };
}

// ═══════════════════════════════════════════════════════════
// GET /api/uploaded-forms
// ═══════════════════════════════════════════════════════════
exports.getUploadedForms = async (req, res) => {
  try {
    const { clause, params } = visibilityWhere(req.user);

    const [rows] = await db.query(
      `SELECT uf.id, uf.title_en, uf.title_sw,
              uf.description_en, uf.description_sw,
              uf.pdf_url, uf.public_id,
              uf.scope, uf.group_id,
              uf.created_by, uf.is_active,
              uf.created_at, uf.updated_at,
              u.full_name  AS author_name,
              g.name       AS group_name
       FROM   uploaded_forms uf
       JOIN   users  u ON u.id  = uf.created_by
       LEFT JOIN \`groups\` g ON g.id = uf.group_id
       WHERE  ${clause}
       ORDER  BY uf.created_at DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getUploadedForms:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════
// GET /api/uploaded-forms/:id
// ═══════════════════════════════════════════════════════════
exports.getUploadedForm = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT uf.*, u.full_name AS author_name, g.name AS group_name
       FROM   uploaded_forms uf
       JOIN   users  u ON u.id  = uf.created_by
       LEFT JOIN \`groups\` g ON g.id = uf.group_id
       WHERE  uf.id = ? AND uf.is_active = 1`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Form not found' });
    }

    const form = rows[0];
    const user = req.user;

    // Scope check for non-leaders
    if (user.role !== 'pastor' && user.role !== 'elder') {
      if (form.scope === 'group' && form.group_id !== user.group_id) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }

    res.json({ success: true, data: form });
  } catch (err) {
    console.error('getUploadedForm:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════
// POST /api/uploaded-forms
// Body: { title_en, title_sw, description_en?, description_sw?,
//         pdf_url, public_id, scope, group_id? }
// Only pastor / elder.
// ═══════════════════════════════════════════════════════════
exports.createUploadedForm = async (req, res) => {
  try {
    const {
      title_en, title_sw,
      description_en = '', description_sw = '',
      pdf_url, public_id,
      scope = 'church',
      group_id = null,
    } = req.body;

    if (!title_en?.trim() || !title_sw?.trim()) {
      return res.status(400).json({ success: false, message: 'Both title_en and title_sw are required' });
    }
    if (!pdf_url || !public_id) {
      return res.status(400).json({ success: false, message: 'pdf_url and public_id are required' });
    }

    const [result] = await db.query(
      `INSERT INTO uploaded_forms
         (title_en, title_sw, description_en, description_sw,
          pdf_url, public_id, scope, group_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title_en.trim(), title_sw.trim(),
        description_en.trim(), description_sw.trim(),
        pdf_url, public_id,
        scope,
        scope === 'group' ? group_id : null,
        req.user.id,
      ]
    );

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error('createUploadedForm:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════
// PUT /api/uploaded-forms/:id
// Allows replacing the PDF file or updating metadata.
// Elder can only edit their own.
// ═══════════════════════════════════════════════════════════
exports.updateUploadedForm = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM uploaded_forms WHERE id = ?', [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const existing = rows[0];
    if (req.user.role === 'elder' && existing.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const {
      title_en, title_sw,
      description_en, description_sw,
      pdf_url, public_id,
      scope, group_id,
    } = req.body;

    await db.query(
      `UPDATE uploaded_forms SET
         title_en       = COALESCE(?, title_en),
         title_sw       = COALESCE(?, title_sw),
         description_en = COALESCE(?, description_en),
         description_sw = COALESCE(?, description_sw),
         pdf_url        = COALESCE(?, pdf_url),
         public_id      = COALESCE(?, public_id),
         scope          = COALESCE(?, scope),
         group_id       = ?
       WHERE id = ?`,
      [
        title_en       ?? null,
        title_sw       ?? null,
        description_en ?? null,
        description_sw ?? null,
        pdf_url        ?? null,
        public_id      ?? null,
        scope          ?? null,
        scope === 'group' ? (group_id ?? null) : null,
        req.params.id,
      ]
    );

    res.json({ success: true, message: 'Form updated' });
  } catch (err) {
    console.error('updateUploadedForm:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE /api/uploaded-forms/:id  (soft-delete, pastor only)
// ═══════════════════════════════════════════════════════════
exports.deleteUploadedForm = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id FROM uploaded_forms WHERE id = ?', [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    await db.query(
      'UPDATE uploaded_forms SET is_active = 0 WHERE id = ?', [req.params.id]
    );

    res.json({ success: true, message: 'Form deleted' });
  } catch (err) {
    console.error('deleteUploadedForm:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};