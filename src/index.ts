import { Client, Events, GatewayIntentBits, Partials, REST, Routes } from "discord.js";
import { config } from "./config";
import { commandData } from "./commandData";
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
import "./database/models/DeveloperDmLog";
import "./database/models/WelcomeSettings";
import "./database/models/ChangelogSettings";
import "./database/models/ChangelogEntry";
import "./database/models/AntiRaidSettings";
import "./database/models/InviteTrackingSettings";
import "./database/models/ReactionRole";
import { handleModerationCommand } from "./commands/moderation";
import { handleNoteCommand } from "./commands/notes";
import { handleCodeCommand } from "./commands/codes";
import { startDashboard } from "./dashboard";
import { registerDiscordLogging } from "./logging/discordLogger";
import { runDatabaseMigrations } from "./database/migrations";
import { handleTicketButton, handleTicketCommand } from "./commands/tickets";
import { TicketPanel } from "./database/models/TicketPanel";
import { handleDeveloperCommand } from "./commands/developer";
import { handleVerificationButton, handleVerificationCommand } from "./commands/verification";
import { VerificationPanel } from "./database/models/VerificationPanel";
import { handleAnnouncementCommand } from "./commands/announcements";
import { handleDeveloperDm, handleDeveloperDmButton, handleDeveloperDmCommand, handleDeveloperDmModal } from "./commands/developerDm";
import { handleWelcomeCommand, sendWelcome } from "./commands/welcome";
import { handleChangelogCommand } from "./commands/changelog";
import { handleAntiRaidCommand, handleAntiRaidJoin } from "./commands/antiRaid";
import { handleInviteCommand, handleInviteJoin, primeInviteCache, refreshInviteCache } from "./commands/invites";
import { handleBuildCommand } from "./commands/builds";
import { handleNukaTraderCommand } from "./commands/nukaTrader";
import { handleReactionRoleButton, handleReactionRoleCommand } from "./commands/reactionRoles";
import { handleSuggestionButton, handleSuggestionModal } from "./commands/suggestions";
import { SuggestionPanel } from "./database/models/SuggestionPanel";
import "./database/models/SuggestionSettings";
import "./database/models/Suggestion";
import { handlePollButton, handlePollCommand, startPollExpiry } from "./commands/polls";
let pollExpiry:ReturnType<typeof startPollExpiry>|undefined;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildScheduledEvents, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.DirectMessages], partials: [Partials.Channel] });

registerDiscordLogging(client);



async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.discord.token);

  await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commandData });

  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId, guild.id), { body: [] });
  }

  console.log(`Registered ${commandData.length} global slash commands; cleared server-specific commands in ${client.guilds.cache.size} server(s).`);
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  pollExpiry=startPollExpiry(client);
  for(const guild of readyClient.guilds.cache.values())await primeInviteCache(guild).catch(()=>null);
  try {
    await registerCommands();
  } catch (error) {
    console.error("Slash command registration failed:", error);
  }
});

client.on(Events.GuildCreate, async guild => {
  try {
    const rest = new REST({ version: "10" }).setToken(config.discord.token);
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId, guild.id), { body: [] });
    console.log(`Cleared server-specific slash commands in new server: ${guild.name}`);
    await primeInviteCache(guild).catch(()=>null);
  } catch (error) {
    console.error(`Slash command registration failed for ${guild.id}:`, error);
  }
});

client.on(Events.GuildMemberAdd, async member => {
  try { await handleInviteJoin(member); const blocked=await handleAntiRaidJoin(member); if(blocked)return; await sendWelcome(member); }
  catch (error) { console.error("Welcome message failed:", error); }
});

client.on(Events.InviteCreate, invite => { const guild=invite.guild?client.guilds.cache.get(invite.guild.id):undefined;if(guild)void refreshInviteCache(guild).catch(()=>null); });
client.on(Events.InviteDelete, invite => { const guild=invite.guild?client.guilds.cache.get(invite.guild.id):undefined;if(guild)void refreshInviteCache(guild).catch(()=>null); });

client.on(Events.MessageDelete, async message => {
  try {
    await SuggestionPanel.destroy({ where: { guildId: message.guildId ?? "", messageId: message.id } });
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
    if (interaction.isButton() && interaction.customId.startsWith("poll:")) { await handlePollButton(interaction); return; }
    if (interaction.isButton() && interaction.customId.startsWith("suggestion:")) { await handleSuggestionButton(interaction); return; }
    if (interaction.isModalSubmit() && interaction.customId.startsWith("suggestion:")) { await handleSuggestionModal(interaction); return; }
    if (interaction.isButton() && interaction.customId.startsWith("reactionrole:")) { await handleReactionRoleButton(interaction); return; }
    if (interaction.isButton() && interaction.customId.startsWith("ticket:")) { await handleTicketButton(interaction); return; }
    if (interaction.isButton() && interaction.customId.startsWith("verify:")) { await handleVerificationButton(interaction); return; }
    if (interaction.isButton() && interaction.customId.startsWith("developer-dm:")) { await handleDeveloperDmButton(interaction); return; }
    if (interaction.isModalSubmit() && interaction.customId === "developer-dm:close-modal") { await handleDeveloperDmModal(interaction); return; }
    if (!interaction.isChatInputCommand()) return;
    if (["note", "notes", "delnote"].includes(interaction.commandName)) await handleNoteCommand(interaction);
    else if (interaction.commandName === "codes") await handleCodeCommand(interaction);
    else if (interaction.commandName === "ticket") await handleTicketCommand(interaction);
    else if (interaction.commandName === "gannounce") await handleDeveloperCommand(interaction);
    else if (interaction.commandName === "verify") await handleVerificationCommand(interaction);
    else if (interaction.commandName === "announce") await handleAnnouncementCommand(interaction);
    else if (interaction.commandName === "dmrelay" || interaction.commandName === "dr") await handleDeveloperDmCommand(interaction);
    else if (interaction.commandName === "welcome") await handleWelcomeCommand(interaction);
    else if (interaction.commandName === "changelog") await handleChangelogCommand(interaction);
    else if (interaction.commandName === "antiraid") await handleAntiRaidCommand(interaction);
    else if (interaction.commandName === "invites") await handleInviteCommand(interaction);
    else if (interaction.commandName === "builds") await handleBuildCommand(interaction);
    else if (interaction.commandName === "price" || interaction.commandName === "market") await handleNukaTraderCommand(interaction);
    else if (interaction.commandName === "poll") await handlePollCommand(interaction);
    else if (interaction.commandName === "reactionrole") await handleReactionRoleCommand(interaction);
    else await handleModerationCommand(interaction);
  } catch (error) {
    console.error("Command error:", error);
    if (!interaction.isRepliable()) return;
    const message = { content: "Something went wrong while executing that command.", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(message);
    else await interaction.reply(message);
  }
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}; shutting down.`);
  if(pollExpiry)clearInterval(pollExpiry);
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
