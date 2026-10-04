import { QueryTypes } from "sequelize";
import { sequelize } from "./index";

export async function runDatabaseMigrations(): Promise<void> {
  if (sequelize.getDialect() === "mysql") {
    const [columns] = await sequelize.query("SHOW COLUMNS FROM guild_settings LIKE 'eventLogChannels'", { type: QueryTypes.SELECT });
    if (!columns) {
      await sequelize.query("ALTER TABLE guild_settings ADD COLUMN eventLogChannels JSON NULL");
      await sequelize.query("UPDATE guild_settings SET eventLogChannels = '{}' WHERE eventLogChannels IS NULL");
      await sequelize.query("ALTER TABLE guild_settings MODIFY eventLogChannels JSON NOT NULL");
      console.log("Database migration: added guild_settings.eventLogChannels.");
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
