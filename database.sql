-- ============================================================
-- Church Portal — Database Setup
-- ============================================================

CREATE DATABASE IF NOT EXISTS church_portal
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE church_portal;

-- Groups (choirs, youth, elders, etc.)
CREATE TABLE IF NOT EXISTS `groups` (
  id          INT           NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)  NOT NULL,
  description TEXT,
  leader_id   INT,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            INT           NOT NULL AUTO_INCREMENT,
  full_name     VARCHAR(150)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  password      VARCHAR(255)  NOT NULL,
  role          ENUM('pastor','elder','group_leader','member') NOT NULL DEFAULT 'member',
  group_id      INT,
  phone         VARCHAR(20),
  profile_photo VARCHAR(255),
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  last_login    TIMESTAMP,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id         INT       NOT NULL AUTO_INCREMENT,
  title      VARCHAR(255) NOT NULL,
  body       TEXT      NOT NULL,
  author_id  INT       NOT NULL,
  audience   ENUM('church','group') NOT NULL DEFAULT 'church',
  group_id   INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id)  REFERENCES `groups`(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
