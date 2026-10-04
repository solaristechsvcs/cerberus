import { Client, Events, GatewayIntentBits, REST, Routes } from "discord.js";
import { config } from "./config";
import { connectDatabase } from "./database";
import "./database/models/Warning";
import "./database/models/ModerationCase";
import "./database/models/GuildSettings";
import "./database/models/UserNote";
import { handleModerationCommand } from "./commands/moderation";
import { handleNoteCommand, noteCommands } from "./commands/notes";
import { moderationCommands } from "./commands/moderation";
import { startDashboard } from "./dashboard";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const commandData = [...moderationCommands, ...noteCommands].map(command => command.toJSON());

async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.discord.token);

  await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commandData });

  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId, guild.id), { body: commandData });
  }

  console.log(`Registered ${commandData.length} slash commands globally and in ${client.guilds.cache.size} server(s).`);
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  try {
    await registerCommands();
  } catch (error) {
    console.error("Slash command registration failed:", error);
  }
});

client.on(Events.GuildCreate, async guild => {
  try {
    const rest = new REST({ version: "10" }).setToken(config.discord.token);
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId, guild.id), { body: commandData });
    console.log(`Registered slash commands in new server: ${guild.name}`);
  } catch (error) {
    console.error(`Slash command registration failed for ${guild.id}:`, error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (["note", "notes", "delnote"].includes(interaction.commandName)) await handleNoteCommand(interaction);
    else await handleModerationCommand(interaction);
  } catch (error) {
    console.error("Command error:", error);
    const message = { content: "Something went wrong while executing that command.", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(message);
    else await interaction.reply(message);
  }
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}; shutting down.`);
  client.destroy();
  process.exit(0);
}

async function main(): Promise<void> {
  await connectDatabase();
  startDashboard(client);
  await client.login(config.discord.token);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
main().catch(error => { console.error("Fatal startup error:", error); process.exit(1); });
