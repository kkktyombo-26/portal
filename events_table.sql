-- Run this in phpMyAdmin or mysql client to add events support
-- Database: church_portal

USE church_portal;

CREATE TABLE IF NOT EXISTS events (
  id              INT           NOT NULL AUTO_INCREMENT,
  title_en        VARCHAR(255)  NOT NULL,
  title_sw        VARCHAR(255)  NOT NULL,
  description_en  TEXT          DEFAULT NULL,
  description_sw  TEXT          DEFAULT NULL,
  event_date      DATE          NOT NULL,
  start_time      TIME          NOT NULL,
  end_time        TIME          DEFAULT NULL,
  location        VARCHAR(255)  DEFAULT NULL,
  created_by      INT           DEFAULT NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample events
INSERT INTO events (title_en, title_sw, description_en, description_sw, event_date, start_time, end_time, location, created_by)
SELECT
  'Sunday Worship Service', 'Ibada ya Jumapili',
  'Weekly Sunday worship service. All members and visitors are welcome.',
  'Ibada ya ibada ya kila Jumapili. Wanachama wote na wageni wanakaribishwa.',
  DATE_ADD(CURDATE(), INTERVAL (7 - WEEKDAY(CURDATE())) % 7 + 0 DAY),
  '09:00:00', '11:30:00', 'Main Sanctuary', id
FROM users WHERE role = 'pastor' LIMIT 1;

INSERT INTO events (title_en, title_sw, description_en, description_sw, event_date, start_time, end_time, location, created_by)
SELECT
  'Choir Rehearsal', 'Mazoezi ya Kwaya',
  'Weekly choir practice. All choir members must attend.',
  'Mazoezi ya kwaya ya kila wiki. Wanachama wote wa kwaya lazima wahudhuri.',
  DATE_ADD(CURDATE(), INTERVAL 5 DAY),
  '18:00:00', '20:00:00', 'Choir Room', id
FROM users WHERE role = 'pastor' LIMIT 1;

INSERT INTO events (title_en, title_sw, description_en, description_sw, event_date, start_time, end_time, location, created_by)
SELECT
  'Youth Fellowship', 'Ushirika wa Vijana',
  'Monthly youth fellowship meeting with praise, worship and discussions.',
  'Mkutano wa kila mwezi wa ushirika wa vijana na sifa, ibada na majadiliano.',
  DATE_ADD(CURDATE(), INTERVAL 10 DAY),
  '15:00:00', '17:00:00', 'Youth Hall', id
FROM users WHERE role = 'pastor' LIMIT 1;

INSERT INTO events (title_en, title_sw, description_en, description_sw, event_date, start_time, end_time, location, created_by)
SELECT
  'Elders Council Meeting', 'Mkutano wa Baraza la Wazee',
  'Monthly elders council meeting to discuss church matters.',
  'Mkutano wa kila mwezi wa baraza la wazee kujadili mambo ya kanisa.',
  DATE_ADD(CURDATE(), INTERVAL 14 DAY),
  '10:00:00', '12:00:00', 'Conference Room', id
FROM users WHERE role = 'pastor' LIMIT 1;
