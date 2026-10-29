/**
 * seed-site-content.js
 * ────────────────────
 * Creates the site_content table if it doesn't exist, then seeds
 * all CMS content blocks. Safe to re-run at any time.
 *
 * Usage (run from project root):
 *   node backend/seed-site-content.js            ← migrate + upsert
 *   node backend/seed-site-content.js --fresh    ← truncate then re-seed
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = require('./config/db');

// ── Block definitions ────────────────────────────────────────────────────────

const BLOCKS = [
  {
    block_key: 'translations_en',
    data: {
      hero_tag:           'Kanisa La Kiinjili La Kilutheri',
      hero_sub:           'A community of faith, love, and worship in Dar es Salaam.',
      hero_cta:           'Join Our Community',
      hero_cta2:          'Sign In',
      carousel_title:     'Life at Yombo',
      carousel_sub:       'Sundays, ministries, and the moments that make us one.',
      schedule_title:     'Weekly Timetable',
      schedule_sub:       'Our regular services and ministry programmes.',
      schedule_note:      'Times may vary on special occasions.',
      map_title:          'Find Us',
      map_sub:            'We are located in Yombo, Dar es Salaam — Tanzania.',
      portal_title:       'Get Personalised Updates',
      portal_sub:         'Register through our portal to access the full service schedule, group announcements, and exclusive church resources — tailored for you.',
      portal_cta:         'Register Now',
      portal_login:       'Already a member? Sign In',
      portal_features:    ['Announcements & alerts', 'Group schedules', 'Event reminders', 'Digital resources'],
      pastor_title:       'Meet Our Pastor',
      pastor_name:        'Mchungaji Joshua Delem',
      pastor_role:        'Senior Pastor, KKKT DMP Yombo',
      pastor_bio:         'Leading our congregation with faith, wisdom, and love.',
      pastor_meet:        'Meet with Pastor Delem',
      pastor_hours_title: 'Pastoral Office Hours',
      pastor_hours_note:  'Walk-ins welcome. For urgent matters, contact the church office.',
      youtube_title:      'Watch & Worship',
      youtube_sub:        'Sermons, praise, and worship — anytime, anywhere.',
      youtube_cta:        'Subscribe on YouTube',
      youtube_empty:      'New videos coming soon. Subscribe to get notified!',
      footer_rights:      'All rights reserved.',
    },
  },
  {
    block_key: 'translations_sw',
    data: {
      hero_tag:           'Kanisa La Kiinjili La Kilutheri',
      hero_sub:           'Jumuia ya imani, upendo, na ibada huko Dar es Salaam.',
      hero_cta:           'Jiunge Nasi',
      hero_cta2:          'Ingia',
      carousel_title:     'KARIBU Yombo',
      carousel_sub:       'Ibada za Jumapili, huduma, na nyakati zinazotufanya tuwe moja.',
      schedule_title:     'Ratiba ya Wiki',
      schedule_sub:       'Huduma zetu za kawaida na mipango ya wizara.',
      schedule_note:      'Nyakati zinaweza kubadilika kwa matukio maalum.',
      map_title:          'Tukuta',
      map_sub:            'Tuko Yombo, Dar es Salaam — Tanzania.',
      portal_title:       'Pata Taarifa Maalum Kwako',
      portal_sub:         'Jiandikishe kupitia mfumo wetu ili upate ratiba kamili, matangazo ya vikundi, na rasilimali za kanisa — maalum kwako.',
      portal_cta:         'Jiandikishe Sasa',
      portal_login:       'Tayari mwanachama? Ingia',
      portal_features:    ['Matangazo & arifa', 'Ratiba za vikundi', 'Ukumbusho wa matukio', 'Rasilimali za kidijitali'],
      pastor_title:       'Kukutana na Mchungaji Wetu',
      pastor_name:        'Mchungaji Joshua Delem',
      pastor_role:        'Mchungaji Mkuu, KKKT DMP Yombo',
      pastor_bio:         'Anaongoza mkutano wetu kwa imani, hekima, na upendo.',
      pastor_meet:        'Kukutana na Mchungaji Delemi',
      pastor_hours_title: 'Masaa ya Ofisi ya Uchungaji',
      pastor_hours_note:  'Karibu bila miadi. Kwa mambo ya haraka, wasiliana na ofisi ya kanisa.',
      youtube_title:      'Tazama & Abudu',
      youtube_sub:        'Mahubiri, sifa, na ibada — wakati wowote, mahali popote.',
      youtube_cta:        'Jiunge YouTube',
      youtube_empty:      'Video mpya zinakuja hivi karibuni. Jiunge ili upate arifa!',
      footer_rights:      'Haki zote zimehifadhiwa.',
    },
  },
  {
    block_key: 'schedule',
    data: [
      { dayKey: 'sunday',    time: '7:00 AM',  serviceEn: 'Early Morning Service',     serviceSw: 'Ibada ya Asubuhi',         highlight: true  },
      { dayKey: 'sunday',    time: '10:00 AM', serviceEn: 'Main Sunday Worship',        serviceSw: 'Ibada Kuu ya Jumapili',    highlight: true  },
      { dayKey: 'sunday',    time: '3:00 PM',  serviceEn: 'Youth & Children Service',   serviceSw: 'Ibada ya Vijana & Watoto', highlight: false },
      { dayKey: 'wednesday', time: '5:30 PM',  serviceEn: 'Midweek Bible Study',        serviceSw: 'Mafunzo ya Biblia',        highlight: false },
      { dayKey: 'friday',    time: '6:00 PM',  serviceEn: 'Friday Prayer Night',        serviceSw: 'Usiku wa Sala',            highlight: true  },
      { dayKey: 'saturday',  time: '9:00 AM',  serviceEn: 'Choir & Ministry Rehearsal', serviceSw: 'Mazoezi ya Kwaya',         highlight: false },
    ],
  },
  {
    block_key: 'pastor_hours',
    data: [
      { dayKey: 'monday',    timeEn: '9:00 AM – 12:00 PM',  timeSw: '9:00 – 12:00 Asubuhi'  },
      { dayKey: 'tuesday',   timeEn: '2:00 PM – 5:00 PM',   timeSw: '2:00 – 5:00 Mchana'    },
      { dayKey: 'wednesday', timeEn: '9:00 AM – 11:00 AM',  timeSw: '9:00 – 11:00 Asubuhi'  },
      { dayKey: 'thursday',  timeEn: '2:00 PM – 5:00 PM',   timeSw: '2:00 – 5:00 Mchana'    },
      { dayKey: 'friday',    timeEn: '10:00 AM – 12:00 PM', timeSw: '10:00 – 12:00 Asubuhi' },
    ],
  },
  {
    block_key: 'gallery_slides',
    data: [
      { url: '/sunday.jpeg',    captionEn: 'Sunday Worship',         captionSw: 'Ibada ya Jumapili' },
      { url: '/community.jpeg', captionEn: 'Community & Fellowship', captionSw: 'Ushirika & Umoja' },
      { url: '/kwaya.jpeg',     captionEn: 'Choir Ministration',     captionSw: 'Huduma ya Kwaya'   },
      { url: '/worship2.jpeg',  captionEn: 'Prayer & Intercession',  captionSw: 'Sala na Uombezi'   },
      { url: '/vijana.jpeg',    captionEn: 'Youth Ministry',         captionSw: 'Huduma ya Vijana'  },
      { url: '/special.jpeg',   captionEn: 'Special Events',         captionSw: 'Matukio Maalum'    },
    ],
  },
  {
    block_key: 'hero_slides',
    data: [],
  },
  {
    block_key: 'staff',
    data: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  Church Portal — Site Content Seed  ║');
  console.log('╚══════════════════════════════════════╝\n');

  try {
    // ── 1. Create table — updated_by is INT (signed) to match users.id ──
    console.log('⚙️   Running migration...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_content (
        id          INT           NOT NULL AUTO_INCREMENT,
        block_key   VARCHAR(60)   NOT NULL,
        data        JSON          NOT NULL,
        updated_by  INT           NULL,
        updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
        created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT uq_site_content_block_key UNIQUE (block_key),
        CONSTRAINT fk_sc_updated_by FOREIGN KEY (updated_by)
          REFERENCES users (id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,
        INDEX idx_sc_block_key  (block_key),
        INDEX idx_sc_updated_by (updated_by),
        INDEX idx_sc_updated_at (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ site_content table ready\n');

    // ── 2. Optionally wipe ───────────────────────────────────
    const flag = process.argv[2];
    if (flag === '--fresh') {
      await pool.query('TRUNCATE TABLE site_content');
      console.log('🗑️  Cleared site_content\n');
    }

    // ── 3. Upsert blocks ─────────────────────────────────────
    console.log('Seeding blocks...');
    for (const block of BLOCKS) {
      await pool.query(
        `INSERT INTO site_content (block_key, data)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data)`,
        [block.block_key, JSON.stringify(block.data)]
      );
      console.log(`  ✓ ${block.block_key}`);
    }

    // ── 4. Verify ────────────────────────────────────────────
    const [rows] = await pool.query(
      'SELECT block_key, updated_at FROM site_content ORDER BY id'
    );

    console.log('\n✅  Seeding complete.\n');
    console.log('📋  Blocks in database:');
    rows.forEach(r =>
      console.log(`   • ${r.block_key.padEnd(20)} updated_at: ${r.updated_at}`)
    );
    console.log('');

  } catch (err) {
    console.error('\n❌  Error:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();