const pool = require('../config/db');

async function fixAdmin() {
  try {
    console.log('🔄 Fixing admin account...');

    await pool.query(
      `UPDATE users SET is_active = 1, is_verified = 1 WHERE email = 'kkktyombo@gmail.com'`
    );

    const [rows] = await pool.query(
      `SELECT id, email, role, is_active, is_verified FROM users WHERE email = 'kkktyombo@gmail.com'`
    );

    if (rows.length === 0) {
      console.error('❌ User not found. Run create-admin.js first.');
    } else {
      const u = rows[0];
      console.log('✅ Admin account updated:');
      console.log(`   id         : ${u.id}`);
      console.log(`   email      : ${u.email}`);
      console.log(`   role       : ${u.role}`);
      console.log(`   is_active  : ${u.is_active}`);
      console.log(`   is_verified: ${u.is_verified}`);
    }
  } catch (err) {
    console.error('❌ Failed:', err.message);
  } finally {
    await pool.end();
  }
}

fixAdmin();