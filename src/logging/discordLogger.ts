import { Client, EmbedBuilder, Guild, Message, PartialMessage, TextChannel } from "discord.js";
import { GuildSettings } from "../database/models/GuildSettings";

export const LOG_EVENTS = [
  "moderation","messageDelete","messageBulkDelete","memberJoin","memberLeave","memberUpdate",
  "banAdd","banRemove","channelCreate","channelDelete","channelUpdate","roleCreate","roleDelete",
  "roleUpdate","voiceUpdate","threadCreate","threadDelete","threadUpdate","inviteCreate","inviteDelete",
  "webhookUpdate","guildUpdate"
] as const;

export type LogEvent = typeof LOG_EVENTS[number];

type CachedMessage = { content: string; authorId: string; channelId: string; createdAt: number };
const recentMessages = new Map<string, CachedMessage>();
const MAX_CACHED_MESSAGES = 10000;
const MESSAGE_CACHE_TTL = 60 * 60 * 1000;

function cacheMessage(message: Message): void {
  if (!message.guild) return;
  recentMessages.set(message.id, { content: message.content, authorId: message.author.id, channelId: message.channelId, createdAt: Date.now() });
  if (recentMessages.size > MAX_CACHED_MESSAGES) {
    const oldest = recentMessages.keys().next().value;
    if (oldest) recentMessages.delete(oldest);
  }
}

function cachedMessage(message: Message | PartialMessage): CachedMessage | undefined {
  const cached = recentMessages.get(message.id);
  if (!cached) return undefined;
  if (Date.now() - cached.createdAt > MESSAGE_CACHE_TTL) { recentMessages.delete(message.id); return undefined; }
  return cached;
}

export const LOG_EVENT_LABELS: Record<LogEvent, string> = {
  moderation:"Moderation commands", messageDelete:"Message deleted", messageBulkDelete:"Messages bulk deleted",
  memberJoin:"Member joined", memberLeave:"Member left", memberUpdate:"Member updated", banAdd:"Member banned",
  banRemove:"Member unbanned", channelCreate:"Channel created", channelDelete:"Channel deleted", channelUpdate:"Channel updated",
  roleCreate:"Role created", roleDelete:"Role deleted", roleUpdate:"Role updated", voiceUpdate:"Voice activity",
  threadCreate:"Thread created", threadDelete:"Thread deleted", threadUpdate:"Thread updated", inviteCreate:"Invite created",
  inviteDelete:"Invite deleted", webhookUpdate:"Webhook updated", guildUpdate:"Server updated"
};

async function channelFor(guild: Guild, event: LogEvent): Promise<TextChannel | null> {
  const settings = await GuildSettings.findByPk(guild.id);
  const id = settings?.eventLogChannels?.[event] ?? (event === "moderation" ? settings?.modLogChannelId : null);
  if (!id) return null;
  const channel = await guild.channels.fetch(id).catch(() => null);
  return channel?.isTextBased() && "send" in channel ? channel as TextChannel : null;
}

export async function sendLog(guild: Guild, event: LogEvent, title: string, description: string): Promise<void> {
  const channel = await channelFor(guild, event);
  if (!channel) return;
  await channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(0x8f315c).setTimestamp()] }).catch(() => undefined);
}

export async function logMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.guild) return;
  const cached = cachedMessage(message);
  const content = message.content || cached?.content || "(content unavailable — message was not received by the bot before deletion)";
  const authorId = message.author?.id ?? cached?.authorId ?? "unknown";
  const channelId = message.channelId || cached?.channelId;
  await sendLog(message.guild, "messageDelete", "Message Deleted",
    "**Channel:** <#" + channelId + ">\n**Author:** <@" + authorId + ">\n**Content:** " + content.slice(0, 3500));
  recentMessages.delete(message.id);
}

export function registerDiscordLogging(client: Client): void {
  client.on("messageCreate", message => cacheMessage(message));
  client.on("messageDelete", m => void logMessageDelete(m));
  client.on("messageDeleteBulk", messages => {
    const guild = messages.first()?.guild;
    if (guild) void sendLog(guild, "messageBulkDelete", "Messages Bulk Deleted", "**Channel:** <#" + messages.first()?.channelId + ">\n**Messages:** " + messages.size);
  });
  client.on("guildMemberAdd", m => void sendLog(m.guild, "memberJoin", "Member Joined", "**Member:** <@" + m.id + ">\n**Account:** <t:" + Math.floor(m.user.createdTimestamp / 1000) + ":R>"));
  client.on("guildMemberRemove", m => void sendLog(m.guild, "memberLeave", "Member Left", "**Member:** <@" + m.id + ">\n**User:** " + m.user.tag));
  client.on("guildMemberUpdate", (oldM, newM) => void sendLog(newM.guild, "memberUpdate", "Member Updated", "**Member:** <@" + newM.id + ">\n**Roles:** " + (newM.roles.cache.size - 1)));
  client.on("guildBanAdd", b => void sendLog(b.guild, "banAdd", "Member Banned", "**User:** <@" + b.user.id + ">\n**User ID:** " + b.user.id));
  client.on("guildBanRemove", b => void sendLog(b.guild, "banRemove", "Member Unbanned", "**User:** <@" + b.user.id + ">"));
  client.on("channelCreate", c => void sendLog(c.guild, "channelCreate", "Channel Created", "**Channel:** <#" + c.id + ">\n**Name:** " + c.name));
  client.on("channelDelete", c => void sendLog(c.guild, "channelDelete", "Channel Deleted", "**Channel:** " + c.name + "\n**ID:** " + c.id));
  client.on("channelUpdate", (oldC, newC) => void sendLog(newC.guild, "channelUpdate", "Channel Updated", "**Channel:** <#" + newC.id + ">\n**Name:** " + newC.name));
  client.on("roleCreate", r => void sendLog(r.guild, "roleCreate", "Role Created", "**Role:** <@&" + r.id + ">\n**Name:** " + r.name));
  client.on("roleDelete", r => void sendLog(r.guild, "roleDelete", "Role Deleted", "**Role:** " + r.name + "\n**ID:** " + r.id));
  client.on("roleUpdate", (oldR, newR) => void sendLog(newR.guild, "roleUpdate", "Role Updated", "**Role:** <@&" + newR.id + ">\n**Name:** " + newR.name));
  client.on("voiceStateUpdate", (oldS, newS) => {
    const state = newS.channelId ? "joined <#" + newS.channelId + ">" : oldS.channelId ? "left <#" + oldS.channelId + ">" : "voice state changed";
    void sendLog(newS.guild, "voiceUpdate", "Voice Activity", "**Member:** <@" + newS.id + ">\n**Action:** " + state);
  });
  client.on("threadCreate", t => void sendLog(t.guild, "threadCreate", "Thread Created", "**Thread:** <#" + t.id + ">\n**Name:** " + t.name));
  client.on("threadDelete", t => void sendLog(t.guild, "threadDelete", "Thread Deleted", "**Thread:** " + t.name + "\n**ID:** " + t.id));
  client.on("threadUpdate", (oldT, newT) => void sendLog(newT.guild, "threadUpdate", "Thread Updated", "**Thread:** <#" + newT.id + ">\n**Name:** " + newT.name));
  client.on("inviteCreate", invite => { if (invite.guild) void sendLog(invite.guild, "inviteCreate", "Invite Created", "**Channel:** <#" + invite.channel?.id + ">\n**Code:** " + invite.code + "\n**Inviter:** " + (invite.inviter ? "<@" + invite.inviter.id + ">" : "Unknown")); });
  client.on("inviteDelete", invite => { if (invite.guild) void sendLog(invite.guild, "inviteDelete", "Invite Deleted", "**Code:** " + invite.code); });
  client.on("webhookUpdate", channel => void sendLog(channel.guild, "webhookUpdate", "Webhooks Updated", "**Channel:** <#" + channel.id + ">"));
  client.on("guildUpdate", (oldG, newG) => void sendLog(newG, "guildUpdate", "Server Updated", "**Server:** " + newG.name + "\n**ID:** " + newG.id));
}
