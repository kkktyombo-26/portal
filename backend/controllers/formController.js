// controllers/formTemplateController.js
const db = require('../config/db'); // adjust path to your mysql2 pool

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Parse fields JSON safely; always returns an array.
 */
function parseFields(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

/**
 * Build a WHERE clause that respects scope visibility:
 *  - pastor / elder : see all active templates
 *  - group_leader   : church-wide + their group
 *  - member         : church-wide + their group
 */
function visibilityWhere(user) {
  if (user.role === 'pastor' || user.role === 'elder') {
    return { clause: 'ft.is_active = 1', params: [] };
  }
  const groupId = user.group_id || 0;
  return {
    clause: "ft.is_active = 1 AND (ft.scope = 'church' OR ft.group_id = ?)",
    params: [groupId],
  };
}

// ── controllers ────────────────────────────────────────────────────────────

/**
 * GET /api/form-templates
 * Returns templates the current user is allowed to see.
 */
exports.getTemplates = async (req, res) => {
  try {
    const { clause, params } = visibilityWhere(req.user);

    const [rows] = await db.query(
      `SELECT ft.id, ft.title_en, ft.title_sw,
              ft.description_en, ft.description_sw,
              ft.fields, ft.scope, ft.group_id,
              ft.created_by, ft.is_active,
              ft.created_at, ft.updated_at,
              u.full_name  AS author_name,
              g.name       AS group_name
       FROM   form_templates ft
       JOIN   users  u ON u.id = ft.created_by
       LEFT JOIN groups g ON g.id = ft.group_id
       WHERE  ${clause}
       ORDER  BY ft.created_at DESC`,
      params
    );

    const templates = rows.map(r => ({ ...r, fields: parseFields(r.fields) }));
    res.json({ success: true, data: templates });
  } catch (err) {
    console.error('getTemplates:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/form-templates/:id
 */
exports.getTemplate = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ft.*, u.full_name AS author_name, g.name AS group_name
       FROM   form_templates ft
       JOIN   users  u ON u.id = ft.created_by
       LEFT JOIN groups g ON g.id = ft.group_id
       WHERE  ft.id = ? AND ft.is_active = 1`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: 'Template not found' });

    const tpl = { ...rows[0], fields: parseFields(rows[0].fields) };

    // Non-pastor/elder can only see templates in their scope
    const user = req.user;
    if (user.role !== 'pastor' && user.role !== 'elder') {
      if (tpl.scope === 'group' && tpl.group_id !== user.group_id) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }

    res.json({ success: true, data: tpl });
  } catch (err) {
    console.error('getTemplate:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/form-templates
 * Only pastor / elder.
 * Body: { title_en, title_sw, description_en?, description_sw?, fields, scope, group_id? }
 */
exports.createTemplate = async (req, res) => {
  try {
    const {
      title_en, title_sw,
      description_en = '', description_sw = '',
      fields = [],
      scope = 'church',
      group_id = null,
    } = req.body;

    if (!title_en?.trim() || !title_sw?.trim()) {
      return res.status(400).json({ success: false, message: 'Both title_en and title_sw are required' });
    }
    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one field is required' });
    }

    // Validate each field has minimum shape
    for (const f of fields) {
      if (!f.id || !f.label_en || !f.type) {
        return res.status(400).json({ success: false, message: 'Each field needs id, label_en, and type' });
      }
    }

    const [result] = await db.query(
      `INSERT INTO form_templates
         (title_en, title_sw, description_en, description_sw, fields, scope, group_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title_en.trim(), title_sw.trim(),
        description_en.trim(), description_sw.trim(),
        JSON.stringify(fields),
        scope,
        scope === 'group' ? group_id : null,
        req.user.id,
      ]
    );

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error('createTemplate:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/form-templates/:id
 * Only pastor / elder (and only own templates for elder).
 */
exports.updateTemplate = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM form_templates WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });

    const tpl = rows[0];

    // Elder can only edit their own templates
    if (req.user.role === 'elder' && tpl.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const {
      title_en, title_sw,
      description_en, description_sw,
      fields, scope, group_id,
    } = req.body;

    await db.query(
      `UPDATE form_templates SET
         title_en       = COALESCE(?, title_en),
         title_sw       = COALESCE(?, title_sw),
         description_en = COALESCE(?, description_en),
         description_sw = COALESCE(?, description_sw),
         fields         = COALESCE(?, fields),
         scope          = COALESCE(?, scope),
         group_id       = ?
       WHERE id = ?`,
      [
        title_en   ?? null,
        title_sw   ?? null,
        description_en ?? null,
        description_sw ?? null,
        fields ? JSON.stringify(fields) : null,
        scope  ?? null,
        scope === 'group' ? (group_id ?? null) : null,
        req.params.id,
      ]
    );

    res.json({ success: true, message: 'Template updated' });
  } catch (err) {
    console.error('updateTemplate:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * DELETE /api/form-templates/:id  (soft-delete)
 * Only pastor.
 */
exports.deleteTemplate = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id FROM form_templates WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });

    await db.query('UPDATE form_templates SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    console.error('deleteTemplate:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};