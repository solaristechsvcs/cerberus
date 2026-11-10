import { ChannelType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { lockdownChannelIds, lockdownStatus, setLockdown } from "../services/channelLockdown";

export const lockdownCommands = [
 new SlashCommandBuilder().setName("lockdown").setDescription("Lock or unlock server text channels during a raid.")
  .setDMPermission(false).setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(s=>s.setName("lock").setDescription("Lock one channel, or the current channel when omitted.")
   .addChannelOption(o=>o.setName("channel").setDescription("Text channel to lock").addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement)))
  .addSubcommand(s=>s.setName("unlock").setDescription("Restore a channel's original permissions.")
   .addChannelOption(o=>o.setName("channel").setDescription("Text channel to unlock").addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement)))
  .addSubcommand(s=>s.setName("server").setDescription("Lock all supported text channels."))
  .addSubcommand(s=>s.setName("release").setDescription("Restore all channels locked through Cerberus."))
  .addSubcommand(s=>s.setName("status").setDescription("Show currently locked channels."))
];

export async function handleLockdownCommand(i:ChatInputCommandInteraction):Promise<void>{
 if(!i.guild)return void await i.reply({content:"This command is only available in a server.",ephemeral:true});
 if(!i.memberPermissions?.has(PermissionFlagsBits.Administrator))return void await i.reply({content:"Administrator permission is required.",ephemeral:true});
 await i.deferReply({ephemeral:true});
 const sub=i.options.getSubcommand();
 if(sub==="status"){
  const status=await lockdownStatus(i.guild);
  return void await i.editReply("**Lockdown status:** "+status.lockedChannelIds.length+" locked channel(s)."+(status.lockedChannelIds.length?"\n"+status.lockedChannelIds.slice(0,25).map(id=>"<#"+id+">").join(", ")+(status.lockedChannelIds.length>25?" …":""):""));
 }
 const locking=sub==="lock"||sub==="server";
 const all=sub==="server"||sub==="release";
 const selected=i.options.getChannel("channel")?.id||i.channelId;
 const ids=all?(locking?lockdownChannelIds(i.guild):(await lockdownStatus(i.guild)).lockedChannelIds):[selected];
 if(!ids.length)return void await i.editReply("No channels need updating.");
 if(!all&&!lockdownChannelIds(i.guild).includes(selected))return void await i.editReply("Select a text or announcement channel.");
 const results=await setLockdown(i.guild,ids,locking);
 const failed=results.filter(r=>!r.ok),success=results.length-failed.length;
 let message=(locking?"Locked ":"Unlocked ")+success+" of "+results.length+" channel(s).";
 if(failed.length)message+="\n**Failed:** "+failed.slice(0,8).map(r=>"<#"+r.channelId+">: "+(r.error||"Unknown error")).join("\n");
 if(failed.length>8)message+="\n…and "+(failed.length-8)+" more failures. Check the Wisp console.";
 await i.editReply(message.slice(0,1900));
}
