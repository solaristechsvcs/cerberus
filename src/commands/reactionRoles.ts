import { ChatInputCommandInteraction, MessageReaction, PartialMessageReaction, PartialUser, PermissionFlagsBits, SlashCommandBuilder, User } from "discord.js";
import { ReactionRole } from "../database/models/ReactionRole";

export function normalizeReactionEmoji(input: string): string {
  const custom = input.trim().match(/^<a?:[^:]+:(\d+)>$/);
  return custom ? custom[1] : input.trim();
}

export const reactionRoleCommands = [
  new SlashCommandBuilder().setName("reactionrole").setDescription("Configure reaction roles").setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName("add").setDescription("Add a reaction role").addChannelOption(o => o.setName("channel").setDescription("Channel containing the message").setRequired(true)).addStringOption(o => o.setName("message").setDescription("Message ID").setRequired(true)).addStringOption(o => o.setName("emoji").setDescription("Unicode or server custom emoji").setRequired(true)).addRoleOption(o => o.setName("role").setDescription("Role to grant").setRequired(true)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove a reaction role").addStringOption(o => o.setName("message").setDescription("Message ID").setRequired(true)).addStringOption(o => o.setName("emoji").setDescription("Configured emoji").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("List reaction roles"))
];

export async function createReactionRole(guild: any, channelId: string, messageId: string, emojiInput: string, roleId: string): Promise<ReactionRole> {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !("messages" in channel)) throw new Error("Select a text channel.");
  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) throw new Error("Message not found in that channel.");
  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) throw new Error("Role not found.");
  const me = guild.members.me;
  if (!me || role.position >= me.roles.highest.position) throw new Error("Cerberus role must be above the reaction role.");
  const emoji = normalizeReactionEmoji(emojiInput);
  const [row] = await ReactionRole.upsert({ guildId: guild.id, channelId, messageId, roleId, emoji }, { returning: true });
  await message.react(emoji);
  return row;
}

export async function handleReactionRoleCommand(i: ChatInputCommandInteraction): Promise<void> {
  if (!i.guild) { await i.reply({ content: "Use this command in a server.", ephemeral: true }); return; }
  const sub = i.options.getSubcommand();
  if (sub === "add") {
    try {
      const channel = i.options.getChannel("channel", true), messageId = i.options.getString("message", true), emoji = i.options.getString("emoji", true), role = i.options.getRole("role", true);
      await createReactionRole(i.guild, channel.id, messageId, emoji, role.id);
      await i.reply({ content: "Reaction role configured.", ephemeral: true });
    } catch (e) { await i.reply({ content: e instanceof Error ? e.message : "Could not configure reaction role.", ephemeral: true }); }
    return;
  }
  if (sub === "remove") {
    const messageId = i.options.getString("message", true), emoji = normalizeReactionEmoji(i.options.getString("emoji", true));
    const count = await ReactionRole.destroy({ where: { guildId: i.guild.id, messageId, emoji } });
    await i.reply({ content: count ? "Reaction role removed." : "No matching reaction role was found.", ephemeral: true });
    return;
  }
  const rows = await ReactionRole.findAll({ where: { guildId: i.guild.id }, order: [["id", "ASC"]] });
  const content = rows.length ? rows.map(r => "• " + r.emoji + " → <@&" + r.roleId + "> on message " + r.messageId).join("\n") : "No reaction roles configured.";
  await i.reply({ content: content.slice(0, 1900), ephemeral: true });
}

async function applyReactionRole(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, add: boolean): Promise<void> {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
    const guild = reaction.message.guild;
    if (!guild) return;
    const emoji = reaction.emoji.id || reaction.emoji.name || "";
    const row = await ReactionRole.findOne({ where: { guildId: guild.id, messageId: reaction.message.id, emoji } });
    if (!row) return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;
    if (add) await member.roles.add(row.roleId, "Reaction role");
    else await member.roles.remove(row.roleId, "Reaction role");
  } catch (error) { console.error("Reaction role update failed:", error); }
}
export const handleReactionRoleAdd = (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => applyReactionRole(reaction, user, true);
export const handleReactionRoleRemove = (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => applyReactionRole(reaction, user, false);
