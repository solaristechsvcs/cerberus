import { REST, Routes } from "discord.js";
import { config } from "./config";
import { moderationCommands } from "./commands/moderation";

const rest = new REST({ version: "10" }).setToken(config.discord.token);
const body = moderationCommands.map((command) => command.toJSON());

async function main(): Promise<void> {
  if (config.discord.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId), { body });
    console.log("Registered guild slash commands.");
  } else {
    await rest.put(Routes.applicationCommands(config.discord.clientId), { body });
    console.log("Registered global slash commands.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
