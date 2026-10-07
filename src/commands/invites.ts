import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, Guild, GuildMember, Invite, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { InviteTrackingSettings } from "../database/models/InviteTrackingSettings";
const cache=new Map<string,Map<string,number>>();

export const inviteCommands=[new SlashCommandBuilder().setName("invites").setDescription("Configure Cerberus invite tracking.").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
 .addSubcommand(s=>s.setName("setup").setDescription("Set the invite tracking log channel.").addChannelOption(o=>o.setName("channel").setDescription("Invite tracking channel").addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement).setRequired(true)))
 .addSubcommand(s=>s.setName("enable").setDescription("Enable invite tracking."))
 .addSubcommand(s=>s.setName("disable").setDescription("Disable invite tracking."))
 .addSubcommand(s=>s.setName("status").setDescription("Show invite tracking status."))
];

async function fetchInvites(guild:Guild){return guild.invites.fetch().catch(()=>null)}
function snapshot(invites:any){const m=new Map<string,number>();if(invites)for(const inv of invites.values())m.set(inv.code,inv.uses??0);return m}
export async function primeInviteCache(guild:Guild){const s=await InviteTrackingSettings.findByPk(guild.id);if(!s?.enabled)return;const invites=await fetchInvites(guild);if(invites)cache.set(guild.id,snapshot(invites));}
export async function refreshInviteCache(guild:Guild){const invites=await fetchInvites(guild);if(invites)cache.set(guild.id,snapshot(invites));}
export async function handleInviteJoin(member:GuildMember){
 const s=await InviteTrackingSettings.findByPk(member.guild.id);if(!s?.enabled||!s.channelId)return;
 const previous=cache.get(member.guild.id)||new Map<string,number>(),invites=await fetchInvites(member.guild);let used:Invite|null=null;
 if(invites){for(const inv of invites.values()){if((inv.uses??0)>(previous.get(inv.code)??0)){used=inv;break}}cache.set(member.guild.id,snapshot(invites));}
 const channel=await member.guild.channels.fetch(s.channelId).catch(()=>null);if(!channel?.isTextBased()||!("send" in channel))return;
 const embed=new EmbedBuilder().setTitle("Member Joined • Invite Tracking").setColor(0x57f287).setThumbnail(member.user.displayAvatarURL({size:256})).addFields({name:"Member",value:"<@"+member.id+">\n"+member.user.tag+"\nID: "+member.id,inline:true});
 if(used)embed.addFields({name:"Invited By",value:used.inviter?"<@"+used.inviter.id+">\n"+used.inviter.tag:"Unknown",inline:true},{name:"Invite",value:used.code+"\nUses: **"+(used.uses??0)+"**",inline:true});else embed.addFields({name:"Invite",value:"Could not determine the invite used. This can occur with vanity URLs, expired or single-use invites, or missing invite permissions."});
 await channel.send({embeds:[embed.setTimestamp()]});
}
export async function handleInviteCommand(i:ChatInputCommandInteraction):Promise<void>{
 if(!i.guild)return void await i.reply({content:"Server only.",ephemeral:true});const sub=i.options.getSubcommand();const [s]=await InviteTrackingSettings.findOrCreate({where:{guildId:i.guild.id}});
 if(sub==="setup"){const channel=i.options.getChannel("channel",true);s.channelId=channel.id;s.enabled=true;await s.save();await refreshInviteCache(i.guild);return void await i.reply({content:"Invite tracking enabled in <#"+channel.id+">.",ephemeral:true});}
 if(sub==="enable"){if(!s.channelId)return void await i.reply({content:"Configure a tracking channel first with /invites setup.",ephemeral:true});s.enabled=true;await s.save();await refreshInviteCache(i.guild);return void await i.reply({content:"Invite tracking enabled.",ephemeral:true});}
 if(sub==="disable"){s.enabled=false;await s.save();cache.delete(i.guild.id);return void await i.reply({content:"Invite tracking disabled.",ephemeral:true});}
 await i.reply({content:"**Invite Tracking:** "+(s.enabled?"Enabled":"Disabled")+"\n**Channel:** "+(s.channelId?"<#"+s.channelId+">":"Not configured"),ephemeral:true});
}
