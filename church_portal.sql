CREATE DATABASE IF NOT EXISTS church_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE church_portal;

CREATE TABLE IF NOT EXISTS groups (
  id          INT          NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  name_sw     VARCHAR(100) NOT NULL,
  type        ENUM('choir','youth','elders','women','men','children','other') NOT NULL DEFAULT 'other',
  leader_id   INT          DEFAULT NULL,
  description TEXT,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id          INT          NOT NULL AUTO_INCREMENT,
  full_name   VARCHAR(150) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('pastor','elder','group_leader','member') NOT NULL DEFAULT 'member',
  group_id    INT          DEFAULT NULL,
  phone       VARCHAR(20)  DEFAULT NULL,
  avatar      VARCHAR(255) DEFAULT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE groups ADD CONSTRAINT fk_group_leader FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS announcements (
  id          INT          NOT NULL AUTO_INCREMENT,
  title_en    VARCHAR(255) NOT NULL,
  title_sw    VARCHAR(255) NOT NULL,
  body_en     TEXT         NOT NULL,
  body_sw     TEXT         NOT NULL,
  scope       ENUM('church','group') NOT NULL DEFAULT 'church',
  group_id    INT          DEFAULT NULL,
  author_id   INT          NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (group_id)  REFERENCES groups(id)  ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
