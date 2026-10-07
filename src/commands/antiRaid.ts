import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { AntiRaidSettings } from "../database/models/AntiRaidSettings";
const joins=new Map<string,number[]>();

export const antiRaidCommands=[new SlashCommandBuilder().setName("antiraid").setDescription("Configure Cerberus anti-raid protection.").setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
 .addSubcommand(s=>s.setName("setup").setDescription("Configure and enable anti-raid.")
  .addIntegerOption(o=>o.setName("threshold").setDescription("Joins required to trigger protection").setMinValue(3).setMaxValue(100).setRequired(true))
  .addIntegerOption(o=>o.setName("window").setDescription("Join window in seconds").setMinValue(5).setMaxValue(300).setRequired(true))
  .addStringOption(o=>o.setName("action").setDescription("Action against members joining while raid mode is active").setRequired(true).addChoices({name:"Kick",value:"kick"},{name:"Ban",value:"ban"},{name:"Alert only",value:"none"}))
  .addChannelOption(o=>o.setName("alerts").setDescription("Staff alert channel").addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement))
  .addIntegerOption(o=>o.setName("duration").setDescription("Raid mode duration in minutes").setMinValue(1).setMaxValue(1440)))
 .addSubcommand(s=>s.setName("enable").setDescription("Enable anti-raid protection."))
 .addSubcommand(s=>s.setName("disable").setDescription("Disable anti-raid protection."))
 .addSubcommand(s=>s.setName("status").setDescription("Show anti-raid status."))
 .addSubcommand(s=>s.setName("stop").setDescription("End active raid mode immediately."))
];

async function alert(member:GuildMember,settings:AntiRaidSettings,title:string,description:string){
 if(!settings.alertChannelId)return;const ch=await member.guild.channels.fetch(settings.alertChannelId).catch(()=>null);if(!ch?.isTextBased()||!("send" in ch))return;
 await ch.send({embeds:[new EmbedBuilder().setTitle(title).setDescription(description).setColor(0xb42318).setTimestamp()]}).catch(()=>null);
}
export async function handleAntiRaidJoin(member:GuildMember):Promise<boolean>{
 const s=await AntiRaidSettings.findByPk(member.guild.id);if(!s?.enabled)return false;
 const now=Date.now(),cutoff=now-s.windowSeconds*1000;let list=(joins.get(member.guild.id)||[]).filter(t=>t>=cutoff);list.push(now);joins.set(member.guild.id,list);
 let active=!!s.activeUntil&&s.activeUntil.getTime()>now;
 if(!active&&list.length>=s.joinThreshold){s.activeUntil=new Date(now+s.lockdownMinutes*60000);await s.save();active=true;await alert(member,s,"🚨 Anti-Raid Triggered",list.length+" members joined within "+s.windowSeconds+" seconds. Raid mode is active for "+s.lockdownMinutes+" minute(s).\n\n**Join action:** "+s.action.toUpperCase());}
 if(!active)return false;
 if(s.action==="kick"&&member.kickable){await member.kick("Cerberus anti-raid: joined during active raid mode").catch(()=>null);return true;}
 if(s.action==="ban"&&member.bannable){await member.ban({reason:"Cerberus anti-raid: joined during active raid mode",deleteMessageSeconds:0}).catch(()=>null);return true;}
 return false;
}
export async function handleAntiRaidCommand(i:ChatInputCommandInteraction):Promise<void>{
 if(!i.guild)return void await i.reply({content:"Server only.",ephemeral:true});const sub=i.options.getSubcommand();const [s]=await AntiRaidSettings.findOrCreate({where:{guildId:i.guild.id}});
 if(sub==="setup"){s.joinThreshold=i.options.getInteger("threshold",true);s.windowSeconds=i.options.getInteger("window",true);s.action=i.options.getString("action",true) as any;s.alertChannelId=i.options.getChannel("alerts")?.id||null;s.lockdownMinutes=i.options.getInteger("duration")||10;s.enabled=true;await s.save();return void await i.reply({content:"Anti-raid enabled: "+s.joinThreshold+" joins / "+s.windowSeconds+"s, action **"+s.action+"**, raid mode "+s.lockdownMinutes+"m.",ephemeral:true});}
 if(sub==="enable"){s.enabled=true;await s.save();return void await i.reply({content:"Anti-raid enabled.",ephemeral:true});}
 if(sub==="disable"){s.enabled=false;s.activeUntil=null;await s.save();joins.delete(i.guild.id);return void await i.reply({content:"Anti-raid disabled.",ephemeral:true});}
 if(sub==="stop"){s.activeUntil=null;await s.save();joins.delete(i.guild.id);return void await i.reply({content:"Active raid mode ended.",ephemeral:true});}
 const active=!!s.activeUntil&&s.activeUntil.getTime()>Date.now();await i.reply({content:"**Anti-Raid:** "+(s.enabled?"Enabled":"Disabled")+"\n**Trigger:** "+s.joinThreshold+" joins / "+s.windowSeconds+" seconds\n**Action:** "+s.action+"\n**Raid duration:** "+s.lockdownMinutes+" minutes\n**Currently active:** "+(active?"Yes, until <t:"+Math.floor(s.activeUntil!.getTime()/1000)+":R>":"No"),ephemeral:true});
}
