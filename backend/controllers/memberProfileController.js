const pool = require('../config/db');

// ── GET /members/:id/profile ──────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         id, full_name, email, phone, role, group_id,
         gender, date_of_birth, place_of_birth, member_status,
         marital_status, marriage_type, marriage_date, marriage_place,
         spouse_name, spouse_phone, cohabiting_partner_name,
         occupation, workplace, education, profession, willing_to_volunteer,
         jumuiya, block_no, area_name, slp,
         neighbour_member_name, neighbour_member_phone,
         elder_name, elder_phone, previous_church,
         created_at, updated_at
       FROM users WHERE id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Member not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /members/:id/profile ──────────────────────────────────
exports.updateProfile = async (req, res) => {
  const allowed = [
    'gender', 'date_of_birth', 'place_of_birth', 'member_status',
    'marital_status', 'marriage_type', 'marriage_date', 'marriage_place',
    'spouse_name', 'spouse_phone', 'cohabiting_partner_name',
    'occupation', 'workplace', 'education', 'profession', 'willing_to_volunteer',
    'jumuiya', 'block_no', 'area_name', 'slp',
    'neighbour_member_name', 'neighbour_member_phone',
    'elder_name', 'elder_phone', 'previous_church',
  ];

  // Only pick fields that were actually sent
  const fields = {};
  for (const key of allowed) {
    if (key in req.body) fields[key] = req.body[key];
  }

  if (!Object.keys(fields).length) {
    return res.status(400).json({ message: 'No valid fields provided' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE users SET ? WHERE id = ?',
      [fields, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Member not found' });
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /members/:id/dependants ───────────────────────────────
exports.getDependants = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM member_dependants WHERE member_id = ? ORDER BY date_of_birth',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /members/:id/dependants ──────────────────────────────
exports.addDependant = async (req, res) => {
  const { full_name, date_of_birth, relationship } = req.body;
  if (!full_name) return res.status(400).json({ message: 'full_name is required' });

  try {
    const [result] = await pool.query(
      'INSERT INTO member_dependants (member_id, full_name, date_of_birth, relationship) VALUES (?, ?, ?, ?)',
      [req.params.id, full_name, date_of_birth || null, relationship || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Dependant added' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /members/:id/dependants/:depId ─────────────────────
exports.removeDependant = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM member_dependants WHERE id = ? AND member_id = ?',
      [req.params.depId, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Dependant not found' });
    res.json({ message: 'Dependant removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};