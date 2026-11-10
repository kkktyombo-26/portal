/**
 * import-members-from-xlsx.js
 * ────────────────────────────
 * One-time bulk import: YOMBO KKKT member register → users table
 * Ref: BSS-KKKT-2026-002
 *
 * What this script does
 * ─────────────────────
 * 1. Reads the Excel workbook (WANAUME + WANAWAKE sheets).
 * 2. Fixes the MARITAL STATUS column:
 *      • If the cell holds a known status word  → stored in marital_status
 *      • If the cell holds a spouse's full name → marital_status is inferred
 *        from gender (Ameoa / Ameolewa) and the name goes into spouse_name
 *      • Unknown / empty values                 → both columns left NULL
 * 3. Normalises phone numbers to the 0XXXXXXXXX format.
 * 4. Skips rows that already exist (phone, ahadi_number, or full_name match).
 * 5. Logs every row outcome and prints a final summary.
 *
 * Prerequisites
 * ─────────────
 *   npm install xlsx bcryptjs   (in backend/ or project root)
 *
 * Usage (run from project root):
 *   node backend/import-members-from-xlsx.js [path/to/workbook.xlsx]
 *
 * Default workbook path (if none supplied):
 *   ./YOMBO_KKKT_DATA_BASE_DETAILS_-_Copy.xlsx
 */

const path   = require('path');
const fs     = require('fs');
const bcrypt = require('bcryptjs');

// ── env ──────────────────────────────────────────────────────────────────────
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../config/db');

// ── config ───────────────────────────────────────────────────────────────────
const XLSX_PATH = process.argv[2]
  || path.join(__dirname, '..', 'YOMBO_KKKT_DATA_BASE_DETAILS_-_Copy.xlsx');

const DEFAULT_ROLE     = 'member';
const DEFAULT_GROUP_ID = null;   // set to a number if all bulk members share a group
const MAX_BATCH        = 1200;   // safety cap (matches the API route)

// ── ENUM values exactly as defined in migrate-member-profile.js ───────────────
const VALID_STATUSES = new Set([
  'Ameoa', 'Hajaoa', 'Ameolewa', 'Hajaolewa',
  'Mjane', 'Mgane', 'Talikiwa', 'Tengana',
]);

// Raw cell value → canonical ENUM value (title-case, matches DB definition)
const STATUS_NORMALISE = {
  AMEOA:    'Ameoa',
  HAJAOA:   'Hajaoa',
  AMEOLEWA: 'Ameolewa',
  HAJAOLEWA:'Hajaolewa',
  MJANE:    'Mjane',
  MGANE:    'Mgane',
  TALIKIWA: 'Talikiwa',
  TENGANA:  'Tengana',
  // common variants / typos found in this workbook
  MAJANE:   'Mjane',
  JAOLEWA:  'Ameolewa',
  NDOA:     null,   // resolved by gender below
  MPWEKE:   null,   // not in ENUM — left NULL
};

/**
 * Decide marital_status and spouse_name from one spreadsheet cell.
 * @param {string|null} raw     - raw cell value
 * @param {string}      gender  - 'Male' | 'Female'
 * @returns {{ marital_status: string|null, spouse_name: string|null }}
 */
function resolveMarital(raw, gender) {
  if (!raw || !raw.trim()) return { marital_status: null, spouse_name: null };

  const up = raw.trim().toUpperCase();

  // Direct or normalised ENUM hit
  if (STATUS_NORMALISE[up] !== undefined) {
    let status = STATUS_NORMALISE[up];
    if (status === null && up === 'NDOA') {
      status = gender === 'Male' ? 'Ameoa' : 'Ameolewa';
    }
    return { marital_status: status, spouse_name: null };
  }

  // Also handle the case where the spreadsheet already used title-case
  for (const v of VALID_STATUSES) {
    if (v.toUpperCase() === up) {
      return { marital_status: v, spouse_name: null };
    }
  }

  // Anything else is treated as a spouse's name
  const marital_status = gender === 'Male' ? 'Ameoa' : 'Ameolewa';
  return { marital_status, spouse_name: raw.trim() };
}

/**
 * Normalise Tanzanian phone numbers to 0XXXXXXXXX (10 digits).
 * Returns null for unrecognisable inputs.
 */
function cleanPhone(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.startsWith('255') && digits.length === 12) return '0' + digits.slice(3);
  if (digits.length === 9) return '0' + digits;
  if (digits.length === 10 && digits.startsWith('0')) return digits;
  return digits.length >= 10 ? digits : null;
}

/** Generate a random temp password (same logic as authController) */
function generateTempPassword(length = 10) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#';
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ── helpers ───────────────────────────────────────────────────────────────────
function str(val) { return val != null ? String(val).trim() || null : null; }
function ok(label)   { console.log(`  ✓  ${label}`); }
function skip(label) { console.log(`  ~  ${label}`); }
function fail(label, err) {
  console.error(`  ✗  ${label}`);
  console.error(`       ${err.message}`);
}

// ═════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  KKKT — Bulk Member Import from XLSX        ║');
  console.log('║  Ref: BSS-KKKT-2026-002                     ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ── 0. Verify xlsx library ───────────────────────────────────────────────
  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch {
    console.error('❌  Missing dependency: run  npm install xlsx  then retry.');
    process.exit(1);
  }

  // ── 1. Load workbook ─────────────────────────────────────────────────────
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`❌  Workbook not found: ${XLSX_PATH}`);
    process.exit(1);
  }

  console.log(`📂  Reading: ${path.basename(XLSX_PATH)}`);
  const wb = XLSX.readFile(XLSX_PATH);
  console.log(`    Sheets: ${wb.SheetNames.join(', ')}\n`);

  // ── 2. Parse all sheets ──────────────────────────────────────────────────
  // Column indices (0-based): S/NO | AHADI | JINA | SIMU | GENDER | MARITAL | KAZI | JUMUIYA
  // The workbook has a 2-row header; row 0 = main headers, row 1 = sub-headers for AHADI columns.
  const COL = { SNO: 0, AHADI: 1, NAME: 2, PHONE: 3, GENDER: 4, MARITAL: 5, KAZI: 6, JUMUIYA: 7 };

  const members = [];

  for (const sheetName of wb.SheetNames) {
    const ws   = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const dataRows = rows.slice(2);   // skip 2-row header

    console.log(`── Sheet: ${sheetName}  (${dataRows.length} data rows)`);

    let sheetCreated = 0;
    let sheetSkipped = 0;

    for (const row of dataRows) {
      const fullName    = str(row[COL.NAME]);
      const ahadiNumber = str(row[COL.AHADI]);
      const phone       = cleanPhone(row[COL.PHONE]);
      const maritalRaw  = str(row[COL.MARITAL]);
      const occupation  = str(row[COL.KAZI]);
      const jumuiya     = str(row[COL.JUMUIYA]);

      // Gender: use cell value or fall back to sheet name
      let gender = str(row[COL.GENDER]);
      if (!gender || !['male', 'female'].includes(gender.toLowerCase())) {
        gender = sheetName === 'WANAUME' ? 'Male' : 'Female';
      } else {
        gender = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
      }

      if (!fullName) { sheetSkipped++; continue; }
      if (!phone && !ahadiNumber) { sheetSkipped++; skip(`${fullName}: no phone and no ahadi_number`); continue; }

      const { marital_status, spouse_name } = resolveMarital(maritalRaw, gender);

      members.push({
        full_name:      fullName,
        phone:          phone       || null,
        ahadi_number:   ahadiNumber || null,
        gender,
        marital_status: marital_status || null,
        spouse_name:    spouse_name    || null,
        occupation:     occupation     || null,
        jumuiya:        jumuiya        || null,
      });
      sheetCreated++;
    }

    console.log(`   → ${sheetCreated} prepared, ${sheetSkipped} skipped\n`);
  }

  if (members.length === 0) {
    console.log('⚠️   No members to import. Exiting.');
    process.exit(0);
  }

  if (members.length > MAX_BATCH) {
    console.error(`❌  ${members.length} members exceeds the ${MAX_BATCH}-row safety cap. Split the file and re-run.`);
    process.exit(1);
  }

  // ── 3. Import row by row ─────────────────────────────────────────────────
  console.log(`── Importing ${members.length} members into the database...\n`);

  const stats = { created: 0, skipped: 0, errored: 0 };
  const seenPhones  = new Set();
  const seenAhadis  = new Set();
  const seenNames   = new Set();

  for (let i = 0; i < members.length; i++) {
    const m   = members[i];
    const row = i + 1;
    const tag = `[${String(row).padStart(4, '0')}] ${m.full_name}`;

    try {

      // ── Intra-batch duplicate guard ───────────────────────
      if (m.phone && seenPhones.has(m.phone)) {
        skip(`${tag} — duplicate phone in batch`);
        stats.skipped++;
        continue;
      }
      if (m.ahadi_number && seenAhadis.has(m.ahadi_number)) {
        skip(`${tag} — duplicate ahadi_number in batch`);
        stats.skipped++;
        continue;
      }
      if (seenNames.has(m.full_name.toLowerCase())) {
        skip(`${tag} — duplicate name in batch`);
        stats.skipped++;
        continue;
      }

      // ── Database duplicate guard ──────────────────────────
      if (m.phone) {
        const [dup] = await pool.execute('SELECT id FROM users WHERE phone = ?', [m.phone]);
        if (dup.length > 0) {
          skip(`${tag} — phone already in DB`);
          stats.skipped++;
          if (m.phone)        seenPhones.add(m.phone);
          if (m.ahadi_number) seenAhadis.add(m.ahadi_number);
          seenNames.add(m.full_name.toLowerCase());
          continue;
        }
      }

      if (m.ahadi_number) {
        const [dup] = await pool.execute('SELECT id FROM users WHERE ahadi_number = ?', [m.ahadi_number]);
        if (dup.length > 0) {
          skip(`${tag} — ahadi_number already in DB`);
          stats.skipped++;
          if (m.phone)        seenPhones.add(m.phone);
          if (m.ahadi_number) seenAhadis.add(m.ahadi_number);
          seenNames.add(m.full_name.toLowerCase());
          continue;
        }
      }

      const [dupName] = await pool.execute(
        "SELECT id FROM users WHERE LOWER(full_name) = LOWER(?) AND role = 'member'",
        [m.full_name]
      );
      if (dupName.length > 0) {
        skip(`${tag} — name already in DB`);
        stats.skipped++;
        if (m.phone)        seenPhones.add(m.phone);
        if (m.ahadi_number) seenAhadis.add(m.ahadi_number);
        seenNames.add(m.full_name.toLowerCase());
        continue;
      }

      // ── Password ──────────────────────────────────────────
      const rawPassword = generateTempPassword();
      const hashed      = await bcrypt.hash(rawPassword, 10); // cost 10 is fine for bulk

      // ── INSERT ────────────────────────────────────────────
      await pool.execute(
        `INSERT INTO users (
          full_name, phone, ahadi_number,
          gender, marital_status, spouse_name,
          occupation, jumuiya,
          role, group_id, password,
          is_active, is_verified
        ) VALUES (
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          1, 1
        )`,
        [
          m.full_name,
          m.phone,
          m.ahadi_number,
          m.gender,
          m.marital_status,
          m.spouse_name,
          m.occupation,
          m.jumuiya,
          DEFAULT_ROLE,
          DEFAULT_GROUP_ID,
          hashed,
        ]
      );

      const spouseNote = m.spouse_name ? `  (spouse: ${m.spouse_name})` : '';
      ok(`${tag}${spouseNote}`);
      stats.created++;

      if (m.phone)        seenPhones.add(m.phone);
      if (m.ahadi_number) seenAhadis.add(m.ahadi_number);
      seenNames.add(m.full_name.toLowerCase());

    } catch (err) {
      fail(tag, err);
      stats.errored++;
    }
  }

  // ── 4. Summary ───────────────────────────────────────────────────────────
  const total = members.length;
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  Import Summary                             ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Total rows processed : ${String(total).padEnd(20)} ║`);
  console.log(`║  ✅  Created          : ${String(stats.created).padEnd(20)} ║`);
  console.log(`║  ~   Skipped (dup)    : ${String(stats.skipped).padEnd(20)} ║`);
  console.log(`║  ❌  Errors           : ${String(stats.errored).padEnd(20)} ║`);
  console.log('╚══════════════════════════════════════════════╝\n');

  if (stats.errored > 0) process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
main()
  .catch(err => {
    console.error('\n❌  Fatal error:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());