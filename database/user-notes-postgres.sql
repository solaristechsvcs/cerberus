-- Cerberus user notes - PostgreSQL
CREATE TABLE IF NOT EXISTS user_notes (
  id SERIAL PRIMARY KEY,
  "guildId" VARCHAR(32) NOT NULL,
  "userId" VARCHAR(32) NOT NULL,
  "authorId" VARCHAR(32) NOT NULL,
  note TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_notes_guild_user ON user_notes ("guildId", "userId");
CREATE INDEX IF NOT EXISTS idx_user_notes_author ON user_notes ("guildId", "authorId");