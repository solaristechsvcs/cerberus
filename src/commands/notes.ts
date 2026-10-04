import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { UserNote } from "../database/models/UserNote";

export const noteCommands = [
  new SlashCommandBuilder().setName("note").setDescription("Add a private staff note about a user.")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("note").setDescription("Internal note").setRequired(true).setMaxLength(2000))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),
  new SlashCommandBuilder().setName("notes").setDescription("View private staff notes for a user.")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),
  new SlashCommandBuilder().setName("delnote").setDescription("Delete a private staff note.")
    .addIntegerOption(o => o.setName("id").setDescription("Note ID").setMinValue(1).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
];

export async function handleNoteCommand(i: ChatInputCommandInteraction): Promise<void> {
  if (!i.guild) return void await i.reply({ content: "Server only.", ephemeral: true });
  if (!i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) return void await i.reply({ content: "Staff only.", ephemeral: true });
  if (i.commandName === "note") {
    const user = i.options.getUser("user", true);
    const note = i.options.getString("note", true);
    const row = await UserNote.create({ guildId: i.guild.id, userId: user.id, authorId: i.user.id, note });
    return void await i.reply({ content: `Added note #${row.id} for **${user.tag}**.`, ephemeral: true });
  }
  if (i.commandName === "notes") {
    const user = i.options.getUser("user", true);
    const rows = await UserNote.findAll({ where: { guildId: i.guild.id, userId: user.id }, order: [["createdAt", "DESC"]], limit: 20 });
    const description = rows.length ? rows.map(n => `**#${n.id}** • <t:${Math.floor(n.createdAt.getTime()/1000)}:f> • <@${n.authorId}>\n${n.note}`).join("\n\n") : "No staff notes found.";
    const embed = new EmbedBuilder().setTitle(`Staff Notes • ${user.tag}`).setDescription(description).setFooter({ text: `User ID: ${user.id}` });
    return void await i.reply({ embeds: [embed], ephemeral: true });
  }
  if (i.commandName === "delnote") {
    const id = i.options.getInteger("id", true);
    const row = await UserNote.findOne({ where: { id, guildId: i.guild.id } });
    if (!row) return void await i.reply({ content: "Note not found.", ephemeral: true });
    await row.destroy();
    return void await i.reply({ content: `Deleted note #${id}.`, ephemeral: true });
  }
}
