-- Cerberus schema for MySQL.
-- Import this into the database configured with dialect: "mysql".

CREATE TABLE IF NOT EXISTS `warnings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `guildId` VARCHAR(32) NOT NULL,
  `userId` VARCHAR(32) NOT NULL,
  `moderatorId` VARCHAR(32) NOT NULL,
  `reason` TEXT NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;
