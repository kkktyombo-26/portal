const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

async function seed() {
  let conn;
  try {
    console.log('🌱 Connecting...');
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'church_portal',
      ...(isProduction && { ssl: { rejectUnauthorized: false } }),
    });
    console.log('✅ Connected\n');

    const flag = process.argv[2];
    if (flag === '--fresh') {
      await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
      await conn.execute('TRUNCATE TABLE announcements');
      await conn.execute('TRUNCATE TABLE users');
      await conn.execute('TRUNCATE TABLE `groups`');
      await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
      console.log('🗑️  Cleared all data\n');
    }

    // Groups
    console.log('Creating groups...');
    const [g1] = await conn.execute("INSERT INTO `groups` (name, name_sw, type, description) VALUES ('Choir', 'Kwaya', 'choir', 'Church choir group')");
    const [g2] = await conn.execute("INSERT INTO `groups` (name, name_sw, type, description) VALUES ('Youth', 'Vijana', 'youth', 'Youth fellowship')");
    const [g3] = await conn.execute("INSERT INTO `groups` (name, name_sw, type, description) VALUES ('Elders', 'Wazee', 'elders', 'Church elders council')");
    const [g4] = await conn.execute("INSERT INTO `groups` (name, name_sw, type, description) VALUES ('Women', 'Wanawake', 'women', 'Women fellowship')");
    console.log('✓ Groups created\n');

    // Users
    console.log('Creating users...');
    const hash = async (p) => bcrypt.hash(p, 12);

    const [pastor] = await conn.execute(
      'INSERT INTO users (full_name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      ['Pastor John Swai', 'pastor@church.com', await hash('pastor123'), 'pastor', '+255712000001']
    );
    await conn.execute(
      'INSERT INTO users (full_name, email, password, role, group_id, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Elder Samuel Mwaipaja', 'elder@church.com', await hash('elder123'), 'elder', g3.insertId, '+255712000002']
    );
    await conn.execute(
      'INSERT INTO users (full_name, email, password, role, group_id, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Choir Leader Grace Massawe', 'choir@church.com', await hash('choir123'), 'group_leader', g1.insertId, '+255712000003']
    );
    await conn.execute(
      'INSERT INTO users (full_name, email, password, role, group_id, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Youth Leader David Rutta', 'youth@church.com', await hash('youth123'), 'group_leader', g2.insertId, '+255712000004']
    );
    await conn.execute(
      'INSERT INTO users (full_name, email, password, role, group_id, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Mary Mshana', 'mary@church.com', await hash('member123'), 'member', g1.insertId, '+255712000005']
    );
    await conn.execute(
      'INSERT INTO users (full_name, email, password, role, group_id, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['James Makule', 'james@church.com', await hash('member123'), 'member', g2.insertId, '+255712000006']
    );
    await conn.execute(
      'INSERT INTO users (full_name, email, password, role, group_id, phone) VALUES (?, ?, ?, ?, ?, ?)',
      ['Sarah Binamungu', 'sarah@church.com', await hash('member123'), 'member', g4.insertId, '+255712000007']
    );
    console.log('✓ Users created\n');

    // Announcements
    console.log('Creating announcements...');
    await conn.execute(
      'INSERT INTO announcements (title_en, title_sw, body_en, body_sw, scope, author_id) VALUES (?, ?, ?, ?, ?, ?)',
      ['Sunday Service This Week', 'Ibada ya Jumapili Wiki Hii',
       'Join us this Sunday at 9:00 AM for our weekly worship service. All are welcome.',
       'Jiunge nasi Jumapili hii saa tatu asubuhi kwa ibada yetu ya kila wiki. Wote mnakaribishwa.',
       'church', pastor.insertId]
    );
    await conn.execute(
      'INSERT INTO announcements (title_en, title_sw, body_en, body_sw, scope, author_id) VALUES (?, ?, ?, ?, ?, ?)',
      ['Welcome to the Portal', 'Karibu kwenye Mfumo',
       'Welcome to our new church management portal. This system will help us stay connected.',
       'Karibu kwenye mfumo wetu mpya wa usimamizi wa kanisa. Mfumo huu utatusaidia kuendelea kuungana.',
       'church', pastor.insertId]
    );
    await conn.execute(
      'INSERT INTO announcements (title_en, title_sw, body_en, body_sw, scope, group_id, author_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['Choir Rehearsal Friday', 'Mazoezi ya Kwaya Ijumaa',
       'Choir rehearsal this Friday at 6:00 PM. Please bring your hymn books.',
       'Mazoezi ya kwaya Ijumaa hii saa kumi na mbili jioni. Tafadhali lete vitabu vyako vya nyimbo.',
       'group', g1.insertId, g1.insertId]
    );
    console.log('✓ Announcements created\n');

    console.log('✅ Seeding complete!\n');
    console.log('📋 Test credentials:');
    console.log('   Pastor:       pastor@church.com  / pastor123');
    console.log('   Elder:        elder@church.com   / elder123');
    console.log('   Choir Leader: choir@church.com   / choir123');
    console.log('   Youth Leader: youth@church.com   / youth123');
    console.log('   Member:       mary@church.com    / member123');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
    process.exit(0);
  }
}

seed();