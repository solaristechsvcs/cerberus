import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChangelogSettings } from "../database/models/ChangelogSettings";
import { ChangelogEntry } from "../database/models/ChangelogEntry";

export const changelogCommands=[new SlashCommandBuilder().setName("changelog").setDescription("Configure and publish server changelogs.")
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
 .addSubcommand(s=>s.setName("setup").setDescription("Set the changelog channel.").addChannelOption(o=>o.setName("channel").setDescription("Channel where changelogs are posted").addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement).setRequired(true)))
 .addSubcommand(s=>s.setName("post").setDescription("Publish a changelog.")
  .addStringOption(o=>o.setName("title").setDescription("Changelog title or version").setMaxLength(256))
  .addStringOption(o=>o.setName("new").setDescription("New features or additions").setMaxLength(1000))
  .addStringOption(o=>o.setName("removed").setDescription("Removed features or items").setMaxLength(1000))
  .addStringOption(o=>o.setName("changed").setDescription("Changed or updated features").setMaxLength(1000)))
];

function lines(prefix:string,text:string){return text.split(/\r?\n/).map(v=>v.trim()).filter(Boolean).map(v=>prefix+" "+v.replace(/^[-+~]\s*/,"")).join("\n")}
export async function sendChangelog(guild:any,data:{title?:string;newItems?:string;removed?:string;changed?:string},authorId?:string){
 const settings=await ChangelogSettings.findByPk(guild.id);if(!settings?.channelId)throw new Error("Changelog channel is not configured.");
 const channel=await guild.channels.fetch(settings.channelId).catch(()=>null);if(!channel?.isTextBased()||!("send" in channel))throw new Error("Configured changelog channel is unavailable.");
 const fields:any[]=[];
 if(data.newItems?.trim())fields.push({name:"🟢 + New",value:lines("+",data.newItems).slice(0,1024)});
 if(data.removed?.trim())fields.push({name:"🔴 - Removed",value:lines("-",data.removed).slice(0,1024)});
 if(data.changed?.trim())fields.push({name:"🟡 ~ Changed",value:lines("~",data.changed).slice(0,1024)});
 if(!fields.length)throw new Error("Add at least one New, Removed, or Changed item.");
 const embed=new EmbedBuilder().setTitle(data.title?.trim()||"Cerberus Changelog").setColor(0x8f315c).addFields(fields).setFooter({text:guild.name+" • Changelog"}).setTimestamp();
 const icon=guild.iconURL({size:256});if(icon)embed.setThumbnail(icon);
 const sent=await channel.send({embeds:[embed]});if(channel.type===ChannelType.GuildAnnouncement&&"crosspost" in sent)await sent.crosspost().catch(()=>null);await ChangelogEntry.create({guildId:guild.id,channelId:channel.id,messageId:sent.id,title:data.title?.trim()||"Cerberus Changelog",newItems:data.newItems?.trim()||null,removed:data.removed?.trim()||null,changedItems:data.changed?.trim()||null,authorId:authorId||null});return sent;
}
export async function handleChangelogCommand(i:ChatInputCommandInteraction):Promise<void>{
 if(!i.guild)return void await i.reply({content:"Server only.",ephemeral:true});
 if(i.options.getSubcommand()==="setup"){const channel=i.options.getChannel("channel",true);const [s]=await ChangelogSettings.findOrCreate({where:{guildId:i.guild.id}});s.channelId=channel.id;await s.save();return void await i.reply({content:"Changelog channel set to <#"+channel.id+">.",ephemeral:true});}
 const title=i.options.getString("title")?.trim()||undefined,newItems=i.options.getString("new")?.trim()||undefined,removed=i.options.getString("removed")?.trim()||undefined,changed=i.options.getString("changed")?.trim()||undefined;
 await i.deferReply({ephemeral:true});try{const sent=await sendChangelog(i.guild,{title,newItems,removed,changed},i.user.id);await i.editReply("Changelog posted: "+sent.url);}catch(e){await i.editReply(e instanceof Error?e.message:"Failed to post changelog.");}
}
