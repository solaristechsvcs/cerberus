import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { WelcomeSettings } from "../database/models/WelcomeSettings";

export const welcomeCommands=[new SlashCommandBuilder().setName("welcome").setDescription("Configure server welcome messages.")
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
 .addSubcommand(s=>s.setName("setup").setDescription("Configure the welcome embed.")
  .addChannelOption(o=>o.setName("channel").setDescription("Welcome channel").addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement).setRequired(true))
  .addStringOption(o=>o.setName("title").setDescription("Embed title. Supports {user}, {username}, {server}, {memberCount}.").setMaxLength(256))
  .addStringOption(o=>o.setName("message").setDescription("Welcome message. Supports welcome placeholders.").setMaxLength(4000)))
 .addSubcommand(s=>s.setName("enable").setDescription("Enable welcome messages."))
 .addSubcommand(s=>s.setName("disable").setDescription("Disable welcome messages."))
 .addSubcommand(s=>s.setName("test").setDescription("Preview the welcome embed in the configured channel."))
];

function format(text:string,member:GuildMember){
 return text.replaceAll("{user}","<@"+member.id+">").replaceAll("{username}",member.user.username).replaceAll("{server}",member.guild.name).replaceAll("{memberCount}",String(member.guild.memberCount));
}
export async function sendWelcome(member:GuildMember){
 const settings=await WelcomeSettings.findByPk(member.guild.id);
 if(!settings?.enabled||!settings.channelId)return null;
 const channel=await member.guild.channels.fetch(settings.channelId).catch(()=>null);
 if(!channel?.isTextBased()||!("send" in channel))throw new Error("Configured welcome channel is unavailable.");
 const embed=new EmbedBuilder().setTitle(format(settings.title,member)).setDescription(format(settings.message,member)).setColor(0x8f315c).setThumbnail(member.user.displayAvatarURL({size:256})).setFooter({text:"Welcome to "+member.guild.name}).setTimestamp();
 const icon=member.guild.iconURL({size:256});if(icon)embed.setAuthor({name:member.guild.name,iconURL:icon});
 return channel.send({content:"<@"+member.id+">",embeds:[embed],allowedMentions:{users:[member.id]}});
}
export async function handleWelcomeCommand(i:ChatInputCommandInteraction):Promise<void>{
 if(!i.guild)return void await i.reply({content:"Server only.",ephemeral:true});
 const sub=i.options.getSubcommand();
 const [settings]=await WelcomeSettings.findOrCreate({where:{guildId:i.guild.id}});
 if(sub==="setup"){
  const channel=i.options.getChannel("channel",true);settings.channelId=channel.id;
  const title=i.options.getString("title")?.trim(),message=i.options.getString("message")?.trim();
  if(title)settings.title=title;if(message)settings.message=message;settings.enabled=true;await settings.save();
  return void await i.reply({content:"Welcome embed configured for <#"+channel.id+">.",ephemeral:true});
 }
 if(sub==="enable"){settings.enabled=true;await settings.save();return void await i.reply({content:"Welcome messages enabled.",ephemeral:true});}
 if(sub==="disable"){settings.enabled=false;await settings.save();return void await i.reply({content:"Welcome messages disabled.",ephemeral:true});}
 if(sub==="test"){
  if(!i.member||typeof i.member==="string")return void await i.reply({content:"Could not load your server member.",ephemeral:true});
  await i.deferReply({ephemeral:true});try{const sent=await sendWelcome(i.member as GuildMember);await i.editReply(sent?"Welcome preview posted.":"Welcome messages are disabled or not configured.");}catch(e){await i.editReply(e instanceof Error?e.message:"Failed to send welcome preview.");}
 }
}
