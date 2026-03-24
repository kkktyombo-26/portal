-- Run this in phpMyAdmin → church_portal database
-- Adds image_url support to announcements

USE church_portal;

ALTER TABLE announcements
  ADD COLUMN image_url VARCHAR(500) DEFAULT NULL AFTER body_sw;
