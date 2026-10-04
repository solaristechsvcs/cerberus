import { QueryTypes } from "sequelize";
import { sequelize } from "./index";

export async function runDatabaseMigrations(): Promise<void> {
  const [columns] = await sequelize.query("SHOW COLUMNS FROM guild_settings LIKE 'eventLogChannels'", { type: QueryTypes.SELECT });
  if (!columns) {
    await sequelize.query("ALTER TABLE guild_settings ADD COLUMN eventLogChannels JSON NOT NULL");
    console.log("Database migration: added guild_settings.eventLogChannels.");
  }
}
