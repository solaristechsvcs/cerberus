import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { Warning } from "../database/models/Warning";
import { ModerationCase, ModerationAction } from "../database/models/ModerationCase";
import { GuildSettings } from "../database/models/GuildSettings";
import { sendLog } from "../logging/discordLogger";

const reason = (o: any) => o.setName("reason").setDescription("Reason").setMaxLength(500);
const user = (o: any) => o.setName("user").setDescription("Member/user").setRequired(true);

export const moderationCommands = [
  new SlashCommandBuilder().setName("ban").setDescription("Ban a member.").addUserOption(user).addStringOption(reason).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers.toString()),
  new SlashCommandBuilder().setName("unban").setDescription("Unban a user.").addStringOption(o => o.setName("user").setDescription("Discord user ID").setRequired(true)).addStringOption(reason).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers.toString()),
  new SlashCommandBuilder().setName("kick").setDescription("Kick a member.").addUserOption(user).addStringOption(reason).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers.toString()),
  new SlashCommandBuilder().setName("timeout").setDescription("Timeout a member.").addUserOption(user).addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes").setMinValue(1).setMaxValue(40320).setRequired(true)).addStringOption(reason).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),
  new SlashCommandBuilder().setName("warn").setDescription("Warn a member.").addUserOption(user).addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true).setMaxLength(500)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),
  new SlashCommandBuilder().setName("warnings").setDescription("Show a member's warning history.").addUserOption(user).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),
  new SlashCommandBuilder().setName("unwarn").setDescription("Remove a warning.").addIntegerOption(o => o.setName("id").setDescription("Warning ID").setMinValue(1).setRequired(true)).addStringOption(reason).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),
  new SlashCommandBuilder().setName("modlogs").setDescription("Show moderation history for a user.").addUserOption(user).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),
  new SlashCommandBuilder().setName("modlog").setDescription("Configure the moderation log channel.").addChannelOption(o => o.setName("channel").setDescription("Channel for moderation logs").setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString()),
  new SlashCommandBuilder().setName("purge").setDescription("Delete recent messages.").addIntegerOption(o => o.setName("amount").setDescription("Number of messages (1-100)").setMinValue(1).setMaxValue(100).setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages.toString())
];

async function canModerate(i: ChatInputCommandInteraction, targetId: string): Promise<boolean> {
  const [mod, target] = await Promise.all([i.guild!.members.fetch(i.user.id), i.guild!.members.fetch(targetId).catch(() => null)]);
  if (!target || target.id === i.guild!.ownerId) return false;
  if (mod.id === i.guild!.ownerId || mod.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return mod.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

async function makeCase(guildId: string, userId: string, moderatorId: string, action: ModerationAction, why: string, durationSeconds: number | null = null) {
  return ModerationCase.create({ guildId, userId, moderatorId, action, reason: why, durationSeconds });
}

async function logCase(i: ChatInputCommandInteraction, c: ModerationCase, tag: string) {
  const settings = await GuildSettings.findByPk(i.guild!.id);
  if (!settings?.modLogChannelId) return;
  const channel = await i.guild!.channels.fetch(settings.modLogChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder().setTitle(`Case #${c.id} • ${c.action}`).setDescription(`**User:** ${tag} (<@${c.userId}>)\n**Moderator:** <@${c.moderatorId}>\n**Reason:** ${c.reason}`).setTimestamp(c.createdAt);
  await sendLog(i.guild, "moderation", `Case #${c.id} • ${c.action}`, `**User:** ${tag} (<@${c.userId}>)\\n**Moderator:** <@${c.moderatorId}>\\n**Reason:** ${c.reason}`);
}

const reply = (i: ChatInputCommandInteraction, content: string, ephemeral = false) => i.reply({ content, ephemeral });

export async function handleModerationCommand(i: ChatInputCommandInteraction): Promise<void> {
  if (!i.guild) return void await reply(i, "Server only.", true);
  const target = i.options.getUser("user");
  const why = i.options.getString("reason") ?? "No reason provided.";

  switch (i.commandName) {
    case "ban": {
      if (!target || !(await canModerate(i, target.id))) return void await reply(i, "You cannot moderate that member.", true);
      const member = await i.guild.members.fetch(target.id).catch(() => null);
      if (!member?.bannable) return void await reply(i, "I cannot ban that member.", true);
      await member.ban({ reason: why });
      const c = await makeCase(i.guild.id, target.id, i.user.id, "BAN", why);
      await logCase(i, c, target.tag);
      return void await reply(i, `Banned **${target.tag}**. Case #${c.id}.`);
    }
    case "unban": {
      const id = i.options.getString("user", true).trim();
      if (!/^\d{17,20}$/.test(id)) return void await reply(i, "Enter a valid Discord user ID.", true);
      const ban = await i.guild.bans.fetch(id).catch(() => null);
      if (!ban) return void await reply(i, "That user is not banned.", true);
      await i.guild.members.unban(id, why);
      const c = await makeCase(i.guild.id, id, i.user.id, "UNBAN", why);
      await logCase(i, c, ban.user.tag);
      return void await reply(i, `Unbanned **${ban.user.tag}**. Case #${c.id}.`);
    }
    case "kick": {
      if (!target || !(await canModerate(i, target.id))) return void await reply(i, "You cannot moderate that member.", true);
      const member = await i.guild.members.fetch(target.id).catch(() => null);
      if (!member?.kickable) return void await reply(i, "I cannot kick that member.", true);
      await member.kick(why);
      const c = await makeCase(i.guild.id, target.id, i.user.id, "KICK", why);
      await logCase(i, c, target.tag);
      return void await reply(i, `Kicked **${target.tag}**. Case #${c.id}.`);
    }
    case "timeout": {
      if (!target || !(await canModerate(i, target.id))) return void await reply(i, "You cannot moderate that member.", true);
      const mins = i.options.getInteger("minutes", true);
      const member = await i.guild.members.fetch(target.id).catch(() => null);
      if (!member?.moderatable) return void await reply(i, "I cannot timeout that member.", true);
      await member.timeout(mins * 60000, why);
      const c = await makeCase(i.guild.id, target.id, i.user.id, "TIMEOUT", why, mins * 60);
      await logCase(i, c, target.tag);
      return void await reply(i, `Timed out **${target.tag}** for **${mins} minutes**. Case #${c.id}.`);
    }
    case "warn": {
      if (!target || !(await canModerate(i, target.id))) return void await reply(i, "You cannot moderate that member.", true);
      const w = await Warning.create({ guildId: i.guild.id, userId: target.id, moderatorId: i.user.id, reason: why });
      const c = await makeCase(i.guild.id, target.id, i.user.id, "WARN", why);
      const count = await Warning.count({ where: { guildId: i.guild.id, userId: target.id } });
      await logCase(i, c, target.tag);
      return void await reply(i, `Warned **${target.tag}**. Warning #${w.id}, Case #${c.id}. Total: **${count}**.`);
    }
    case "warnings": {
      if (!target) return void await reply(i, "Select a user.", true);
      const rows = await Warning.findAll({ where: { guildId: i.guild.id, userId: target.id }, order: [["createdAt", "DESC"]], limit: 10 });
      if (!rows.length) return void await reply(i, `**${target.tag}** has no warnings.`);
      const count = await Warning.count({ where: { guildId: i.guild.id, userId: target.id } });
      return void await reply(i, `**${target.tag}** has **${count}** warning(s).\n${rows.map(w => `#${w.id} — <t:${Math.floor(w.createdAt.getTime()/1000)}:R> — <@${w.moderatorId}> — ${w.reason}`).join("\n")}`);
    }
    case "unwarn": {
      const id = i.options.getInteger("id", true);
      const warning = await Warning.findOne({ where: { id, guildId: i.guild.id } });
      if (!warning) return void await reply(i, "Warning not found.", true);
      if (!(await canModerate(i, warning.userId))) return void await reply(i, "You cannot remove a warning for that member.", true);
      const account = await i.client.users.fetch(warning.userId).catch(() => null);
      await warning.destroy();
      const c = await makeCase(i.guild.id, warning.userId, i.user.id, "UNWARN", why);
      await logCase(i, c, account?.tag ?? warning.userId);
      return void await reply(i, `Removed warning #${id}. Case #${c.id}.`);
    }
    case "modlogs": {
      if (!target) return void await reply(i, "Select a user.", true);
      const rows = await ModerationCase.findAll({ where: { guildId: i.guild.id, userId: target.id }, order: [["createdAt", "DESC"]], limit: 15 });
      if (!rows.length) return void await reply(i, `No moderation history found for **${target.tag}**.`);
      return void await reply(i, `**Moderation history for ${target.tag}:**\n${rows.map(c => `#${c.id} **${c.action}** — <t:${Math.floor(c.createdAt.getTime()/1000)}:R> — <@${c.moderatorId}> — ${c.reason}`).join("\n")}`);
    }
    case "modlog": {
      const channel = i.options.getChannel("channel", true);
      if (!channel.isTextBased()) return void await reply(i, "Choose a text-based channel.", true);
      const [settings] = await GuildSettings.findOrCreate({ where: { guildId: i.guild.id } });
      settings.modLogChannelId = channel.id;
      await settings.save();
      return void await reply(i, `Moderation logs will be sent to <#${channel.id}>.`);
    }
    case "purge": {
      const amount = i.options.getInteger("amount", true);
      if (!i.channel || !("bulkDelete" in i.channel)) return void await reply(i, "Unavailable in this channel.", true);
      const deleted = await i.channel.bulkDelete(amount, true);
      const c = await makeCase(i.guild.id, i.user.id, i.user.id, "PURGE", why);
      await logCase(i, c, i.user.tag);
      return void await reply(i, `Deleted **${deleted.size}** message(s). Case #${c.id}.`, true);
    }
  }
}
