import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { Warning } from "../database/models/Warning";
export const moderationCommands = [
  new SlashCommandBuilder().setName("ban").setDescription("Ban a member.")
    .addUserOption(o => o.setName("user").setDescription("Member to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers.toString()),
  new SlashCommandBuilder().setName("kick").setDescription("Kick a member.")
    .addUserOption(o => o.setName("user").setDescription("Member to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers.toString()),
  new SlashCommandBuilder().setName("timeout").setDescription("Timeout a member.")
    .addUserOption(o => o.setName("user").setDescription("Member to timeout").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes").setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),
  new SlashCommandBuilder().setName("warn").setDescription("Warn a member; save warning to SQL.")
    .addUserOption(o => o.setName("user").setDescription("Member to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),
  new SlashCommandBuilder().setName("warnings").setDescription("Show a member's warning count.")
    .addUserOption(o => o.setName("user").setDescription("Member to inspect").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),
  new SlashCommandBuilder().setName("purge").setDescription("Delete recent messages.")
    .addIntegerOption(o => o.setName("amount").setDescription("Number of messages (1-100)").setMinValue(1).setMaxValue(100).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages.toString())
];
export async function handleModerationCommand(i: ChatInputCommandInteraction): Promise<void> {
  if (!i.guild) { await i.reply({ content: "Server only.", ephemeral: true }); return; }
  const user = i.options.getUser("user");
  const reason = i.options.getString("reason") ?? "No reason provided.";
  switch (i.commandName) {
    case "ban": {
      const m = await i.guild.members.fetch(user!.id).catch(() => null);
      if (!m?.bannable) { await i.reply({ content: "I cannot ban that member.", ephemeral: true }); return; }
      await m.ban({ reason }); await i.reply(`Banned **${user!.tag}**. Reason: ${reason}`); break;
    }
    case "kick": {
      const m = await i.guild.members.fetch(user!.id).catch(() => null);
      if (!m?.kickable) { await i.reply({ content: "I cannot kick that member.", ephemeral: true }); return; }
      await m.kick(reason); await i.reply(`Kicked **${user!.tag}**. Reason: ${reason}`); break;
    }
    case "timeout": {
      const mins = i.options.getInteger("minutes", true);
      const m = await i.guild.members.fetch(user!.id).catch(() => null);
      if (!m?.moderatable) { await i.reply({ content: "I cannot timeout that member.", ephemeral: true }); return; }
      await m.timeout(mins * 60000, reason); await i.reply(`Timed out **${user!.tag}** for **${mins} minutes**. Reason: ${reason}`); break;
    }
    case "warn": {
      const w = await Warning.create({ guildId: i.guild.id, userId: user!.id, moderatorId: i.user.id, reason });
      const count = await Warning.count({ where: { guildId: i.guild.id, userId: user!.id } });
      await i.reply(`Warned **${user!.tag}**. Warning #${w.id}. Total: **${count}**. Reason: ${reason}`); break;
    }
    case "warnings": {
      const count = await Warning.count({ where: { guildId: i.guild.id, userId: user!.id } });
      await i.reply(`**${user!.tag}** has **${count}** warning(s).`); break;
    }
    case "purge": {
      const amount = i.options.getInteger("amount", true);
      if (!i.channel || !("bulkDelete" in i.channel)) { await i.reply({ content: "Unavailable in this channel.", ephemeral: true }); return; }
      const deleted = await i.channel.bulkDelete(amount, true);
      await i.reply({ content: `Deleted **${deleted.size}** message(s).`, ephemeral: true }); break;
    }
  }
}
