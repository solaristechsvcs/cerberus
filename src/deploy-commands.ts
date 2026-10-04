import { REST, Routes } from "discord.js";
import { config } from "./config";
import { moderationCommands } from "./commands/moderation";

const rest = new REST({ version: "10" }).setToken(config.discord.token);
const body = moderationCommands.map((command) => command.toJSON());

async function main(): Promise<void> {
  await rest.put(Routes.applicationCommands(config.discord.clientId), { body });
  console.log("Registered global slash commands for all guilds.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
