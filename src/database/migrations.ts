import { QueryTypes } from "sequelize";
import crypto from "node:crypto";
import { sequelize } from "./index";

export async function runDatabaseMigrations(): Promise<void> {
  await sequelize.sync();
  if (sequelize.getDialect() === "mysql") {
    const [columns] = await sequelize.query("SHOW COLUMNS FROM guild_settings LIKE 'eventLogChannels'", { type: QueryTypes.SELECT });
    if (!columns) {
      await sequelize.query("ALTER TABLE guild_settings ADD COLUMN eventLogChannels JSON NULL");
      await sequelize.query("UPDATE guild_settings SET eventLogChannels = '{}' WHERE eventLogChannels IS NULL");
      await sequelize.query("ALTER TABLE guild_settings MODIFY eventLogChannels JSON NOT NULL");
      console.log("Database migration: added guild_settings.eventLogChannels.");
    }
    const [accessTokenColumn] = await sequelize.query("SHOW COLUMNS FROM ticket_transcripts LIKE 'accessToken'", { type: QueryTypes.SELECT });
    if (!accessTokenColumn) {
      await sequelize.query("ALTER TABLE ticket_transcripts ADD COLUMN accessToken VARCHAR(64) NULL");
      const transcripts = await sequelize.query<{ id: number }>("SELECT id FROM ticket_transcripts WHERE accessToken IS NULL", { type: QueryTypes.SELECT });
      for (const transcript of transcripts) {
        await sequelize.query("UPDATE ticket_transcripts SET accessToken = ? WHERE id = ?", { replacements: [crypto.randomBytes(32).toString("hex"), transcript.id] });
      }
      await sequelize.query("ALTER TABLE ticket_transcripts MODIFY accessToken VARCHAR(64) NOT NULL");
      await sequelize.query("CREATE UNIQUE INDEX ticket_transcripts_access_token_unique ON ticket_transcripts (accessToken)");
      console.log("Database migration: added ticket_transcripts.accessToken.");
    }
    return;
  }

  const [columns] = await sequelize.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'guild_settings' AND column_name = 'eventLogChannels'",
    { type: QueryTypes.SELECT }
  );
  if (!columns) {
    await sequelize.query("ALTER TABLE guild_settings ADD COLUMN \"eventLogChannels\" JSONB NOT NULL DEFAULT '{}'");
    console.log("Database migration: added guild_settings.eventLogChannels.");
  }
}
