-- Cerberus moderation schema - MySQL 8+
-- Run this against the existing Cerberus database.

CREATE TABLE IF NOT EXISTS warnings (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guildId VARCHAR(32) NOT NULL,
  userId VARCHAR(32) NOT NULL,
  moderatorId VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_warnings_guild_user (guildId, userId),
  INDEX idx_warnings_created_at (createdAt)
);

CREATE TABLE IF NOT EXISTS moderation_cases (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guildId VARCHAR(32) NOT NULL,
  userId VARCHAR(32) NOT NULL,
  moderatorId VARCHAR(32) NOT NULL,
  action VARCHAR(16) NOT NULL,
  reason TEXT NOT NULL,
  durationSeconds INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cases_guild_user (guildId, userId),
  INDEX idx_cases_guild_created (guildId, createdAt),
  INDEX idx_cases_moderator (guildId, moderatorId)
);

CREATE TABLE IF NOT EXISTS guild_settings (
  guildId VARCHAR(32) NOT NULL PRIMARY KEY,
  modLogChannelId VARCHAR(32) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
