import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { AnnouncementSettings } from "../database/models/AnnouncementSettings";

export const announcementCommands=[new SlashCommandBuilder().setName("announce").setDescription("Configure or send server announcements.")
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
 .addSubcommand(s=>s.setName("setup").setDescription("Set the server announcement channel.").addChannelOption(o=>o.setName("channel").setDescription("Channel where announcements are posted").addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement).setRequired(true)))
 .addSubcommand(s=>s.setName("message").setDescription("Post an announcement to the configured channel.")
  .addStringOption(o=>o.setName("message").setDescription("Announcement message").setRequired(true).setMaxLength(4000))
  .addStringOption(o=>o.setName("title").setDescription("Announcement title").setMaxLength(256)))
];

export async function sendServerAnnouncement(guild:any,message:string,authorId:string,title="Server Announcement"){
 const settings=await AnnouncementSettings.findByPk(guild.id);
 if(!settings?.channelId)throw new Error("Announcement channel is not configured.");
 const channel=await guild.channels.fetch(settings.channelId).catch(()=>null);
 if(!channel?.isTextBased()||!("send" in channel))throw new Error("Configured announcement channel is unavailable.");
 const embed=new EmbedBuilder().setTitle(title).setDescription(message).setColor(0x8f315c).setFooter({text:"Posted by server administration"}).setTimestamp();
 const icon=guild.iconURL({size:256});if(icon)embed.setThumbnail(icon);
 const sent=await channel.send({embeds:[embed]});
 if(channel.type===ChannelType.GuildAnnouncement&&"crosspost" in sent)await sent.crosspost().catch(()=>null);
 return sent;
}
export async function handleAnnouncementCommand(i:ChatInputCommandInteraction):Promise<void>{
 if(!i.guild)return void await i.reply({content:"Server only.",ephemeral:true});
 const sub=i.options.getSubcommand();
 if(sub==="setup"){const channel=i.options.getChannel("channel",true);const [settings]=await AnnouncementSettings.findOrCreate({where:{guildId:i.guild.id}});settings.channelId=channel.id;await settings.save();return void await i.reply({content:"Announcement channel set to <#"+channel.id+">.",ephemeral:true});}
 const message=i.options.getString("message",true).trim(),title=i.options.getString("title")?.trim()||"Server Announcement";
 await i.deferReply({ephemeral:true});
 try{const sent=await sendServerAnnouncement(i.guild,message,i.user.id,title);await i.editReply("Announcement posted: "+sent.url);}catch(error){await i.editReply(error instanceof Error?error.message:"Failed to post announcement.");}
}
