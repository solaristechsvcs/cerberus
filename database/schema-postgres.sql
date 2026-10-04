-- Cerberus moderation schema - PostgreSQL
-- Run this against the existing Cerberus database.

CREATE TABLE IF NOT EXISTS warnings (
  id SERIAL PRIMARY KEY,
  "guildId" VARCHAR(32) NOT NULL,
  "userId" VARCHAR(32) NOT NULL,
  "moderatorId" VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings ("guildId", "userId");
CREATE INDEX IF NOT EXISTS idx_warnings_created_at ON warnings ("createdAt");

CREATE TABLE IF NOT EXISTS moderation_cases (
  id SERIAL PRIMARY KEY,
  "guildId" VARCHAR(32) NOT NULL,
  "userId" VARCHAR(32) NOT NULL,
  "moderatorId" VARCHAR(32) NOT NULL,
  action VARCHAR(16) NOT NULL,
  reason TEXT NOT NULL,
  "durationSeconds" INTEGER NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cases_guild_user ON moderation_cases ("guildId", "userId");
CREATE INDEX IF NOT EXISTS idx_cases_guild_created ON moderation_cases ("guildId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_cases_moderator ON moderation_cases ("guildId", "moderatorId");

CREATE TABLE IF NOT EXISTS guild_settings (
  "guildId" VARCHAR(32) PRIMARY KEY,
  "modLogChannelId" VARCHAR(32) NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
