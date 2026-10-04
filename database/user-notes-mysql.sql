-- Cerberus user notes - MySQL 8+
CREATE TABLE IF NOT EXISTS user_notes (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  guildId VARCHAR(32) NOT NULL,
  userId VARCHAR(32) NOT NULL,
  authorId VARCHAR(32) NOT NULL,
  note TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_notes_guild_user (guildId, userId),
  INDEX idx_user_notes_author (guildId, authorId)
) ENGINE=InnoDB;