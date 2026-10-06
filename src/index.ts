import { Client, Events, GatewayIntentBits, Partials, REST, Routes } from "discord.js";
import { config } from "./config";
import { connectDatabase } from "./database";
import "./database/models/Warning";
import "./database/models/ModerationCase";
import "./database/models/GuildSettings";
import "./database/models/UserNote";
import "./database/models/TicketSettings";
import "./database/models/TicketPanel";
import "./database/models/Ticket";
import "./database/models/TicketTranscript";
import "./database/models/VerificationSettings";
import "./database/models/VerificationPanel";
import "./database/models/AnnouncementSettings";
import "./database/models/DeveloperDmSettings";
import "./database/models/DeveloperDmThread";
import { handleModerationCommand } from "./commands/moderation";
import { handleNoteCommand, noteCommands } from "./commands/notes";
import { codeCommands, handleCodeCommand } from "./commands/codes";
import { moderationCommands } from "./commands/moderation";
import { startDashboard } from "./dashboard";
import { registerDiscordLogging } from "./logging/discordLogger";
import { runDatabaseMigrations } from "./database/migrations";
import { handleTicketButton, handleTicketCommand, ticketCommands } from "./commands/tickets";
import { TicketPanel } from "./database/models/TicketPanel";
import { developerCommands, handleDeveloperCommand } from "./commands/developer";
import { handleVerificationButton, handleVerificationCommand, verificationCommands } from "./commands/verification";
import { VerificationPanel } from "./database/models/VerificationPanel";
import { announcementCommands, handleAnnouncementCommand } from "./commands/announcements";
import { developerDmCommands, handleDeveloperDm, handleDeveloperDmButton, handleDeveloperDmCommand } from "./commands/developerDm";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildScheduledEvents, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.DirectMessages], partials: [Partials.Channel] });

registerDiscordLogging(client);

const commandData = [...moderationCommands, ...noteCommands, ...codeCommands, ...ticketCommands, ...developerCommands, ...verificationCommands, ...announcementCommands, ...developerDmCommands].map(command => command.toJSON());

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

client.on(Events.MessageDelete, async message => {
  try {
    await TicketPanel.destroy({ where: { guildId: message.guildId ?? "", messageId: message.id } });
    await VerificationPanel.destroy({ where: { guildId: message.guildId ?? "", messageId: message.id } });
  } catch (error) {
    console.error("Ticket panel cleanup failed:", error);
  }
});

client.on(Events.MessageCreate, async message => {
  try {
    await handleDeveloperDm(message);
  } catch (error) {
    console.error("Developer DM relay failed:", error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isButton() && interaction.customId.startsWith("ticket:")) { await handleTicketButton(interaction); return; }
    if (interaction.isButton() && interaction.customId.startsWith("verify:")) { await handleVerificationButton(interaction); return; }
    if (interaction.isButton() && interaction.customId.startsWith("developer-dm:")) { await handleDeveloperDmButton(interaction); return; }
    if (!interaction.isChatInputCommand()) return;
    if (["note", "notes", "delnote"].includes(interaction.commandName)) await handleNoteCommand(interaction);
    else if (interaction.commandName === "codes") await handleCodeCommand(interaction);
    else if (interaction.commandName === "ticket") await handleTicketCommand(interaction);
    else if (interaction.commandName === "gannounce") await handleDeveloperCommand(interaction);
    else if (interaction.commandName === "verify") await handleVerificationCommand(interaction);
    else if (interaction.commandName === "announce") await handleAnnouncementCommand(interaction);
    else if (interaction.commandName === "dmrelay" || interaction.commandName === "dr") await handleDeveloperDmCommand(interaction);
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
  await runDatabaseMigrations();
  startDashboard(client);
  await client.login(config.discord.token);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
main().catch(error => { console.error("Fatal startup error:", error); process.exit(1); });
