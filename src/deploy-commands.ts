import { REST, Routes } from "discord.js";
import { config } from "./config";
import { commandData } from "./commandData";

const rest = new REST({ version: "10" }).setToken(config.discord.token);

async function main(): Promise<void> {
  await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commandData });
  console.log(`Registered ${commandData.length} global slash commands for all guilds. Restart the bot to clear legacy server-specific commands.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
