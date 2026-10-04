import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";
import { Warning } from "../database/models/Warning";

export const moderationCommands = [
  new SlashCommandBuilder()
    .setName("ban").setDescription("Ban a member from the server.")
    .addUserOption((o) => o.setName("user").setDescription("Member to ban").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the ban"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers.toString()),

  new SlashCommandBuilder()
    .setName("kick").setDescription("Kick a member from the server.")
    .addUserOption((o) => o.setName("user").setDescription("Member to kick").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the kick"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers.toString()),

  new SlashCommandBuilder()
    .setName("timeout").setDescription("Timeout a member.")
    .addUserOption((o) => o.setName("user").setDescription("Member to timeout").setRequired(true))
    .addIntegerOption((o) => o.setName("minutes").setDescription("Timeout duration in minutes").setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the timeout"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),

  new SlashCommandBuilder()
    .setName("warn").setDescription("Warn a member and store the warning in SQL.")
    .addUserOption((o) => o.setName("user").setDescription("Member to warn").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the warning").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),

  new SlashCommandBuilder()
    .setName("warnings").setDescription("View a member's warning count.")
    .addUserOption((o) => o.setName("user").setDescription("Member to inspect").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),

  new SlashCommandBuilder()
    .setName("purge").setDescription("Delete recent messages.")
    .addIntegerOption((o) => o.setName("amount").setDescription("Number of messages to delete (1-100)").setMinValue(1).setMaxValue(100).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages.toString())
];

export async function handleModerationCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const user = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason") ?? "No reason provided.";

  switch (interaction.commandName) {
    case "ban": {
      const member = await interaction.guild.members.fetch(user!.id).catch(() => null);
      if (!member?.bannable) {
        await interaction.reply({ content: "I cannot ban that member.", ephemeral: true });
        return;
      }
      await member.ban({ reason });
      await interaction.reply(`Banned **${user!.tag}**. Reason: ${reason}`);
      break;
    }
    case "kick": {
      const member = await interaction.guild.members.fetch(user!.id).catch(() => null);
      if (!member?.kickable) {
        await interaction.reply({ content: "I cannot kick that member.", ephemeral: true });
        return;
      }
      await member.kick(reason);
      await interaction.reply(`Kicked **${user!.tag}**. Reason: ${reason}`);
      break;
    }
    case "timeout": {
      const minutes = interaction.options.getInteger("minutes", true);
      const member = await interaction.guild.members.fetch(user!.id).catch(() => null);
      if (!member?.moderatable) {
        await interaction.reply({ content: "I cannot timeout that member.", ephemeral: true });
        return;
      }
      await member.timeout(minutes * 60_000, reason);
      await interaction.reply(`Timed out **${user!.tag}** for **${minutes} minutes**. Reason: ${reason}`);
      break;
    }
    case "warn": {
      const warning = await Warning.create({
        guildId: interaction.guild.id,
        userId: user!.id,
        moderatorId: interaction.user.id,
        reason
      });
      const count = await Warning.count({ where: { guildId: interaction.guild.id, userId: user!.id } });
      await interaction.reply(`Warned **${user!.tag}**. Warning #${warning.id}. Total warnings: **${count}**. Reason: ${reason}`);
      break;
    }
    case "warnings": {
      const count = await Warning.count({ where: { guildId: interaction.guild.id, userId: user!.id } });
      await interaction.reply(`**${user!.tag}** has **${count}** warning(s).`);
      break;
    }
    case "purge": {
      const amount = interaction.options.getInteger("amount", true);
      if (!interaction.channel || !("bulkDelete" in interaction.channel)) {
        await interaction.reply({ content: "This command is not available in this channel.", ephemeral: true });
        return;
      }
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.reply({ content: `Deleted **${deleted.size}** message(s).`, ephemeral: true });
      break;
    }
  }
}
