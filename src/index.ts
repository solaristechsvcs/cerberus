import { Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "./config";
import { connectDatabase } from "./database";
import "./database/models/Warning";
import "./database/models/ModerationCase";
import "./database/models/GuildSettings";
import { handleModerationCommand } from "./commands/moderation";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleModerationCommand(interaction);
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
  await client.login(config.discord.token);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
