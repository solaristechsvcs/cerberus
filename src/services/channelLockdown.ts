import { ChannelType, Guild, OverwriteType, PermissionFlagsBits } from "discord.js";
import { ChannelLockdown } from "../database/models/ChannelLockdown";

const flags = ["SendMessages","SendMessagesInThreads","CreatePublicThreads","CreatePrivateThreads"] as const;
type Flag = typeof flags[number];
type Snapshot = {id:string; values:Record<Flag,boolean|null>; existed?:boolean; type?:number};
const busy = new Set<string>();
function textChannels(guild:Guild) {
 return [...guild.channels.cache.values()].filter(ch=>ch.type===ChannelType.GuildText||ch.type===ChannelType.GuildAnnouncement);
}
function targets(guild:Guild,channel:ReturnType<typeof textChannels>[number]) {
 const ids = new Set<string>([guild.id,...guild.roles.cache.filter(r=>!r.permissions.has(PermissionFlagsBits.Administrator)).keys()]);
 // Member-specific channel overwrites can override role restrictions.
 for(const overwrite of channel.permissionOverwrites.cache.values()) {
  if(overwrite.type===OverwriteType.Member)ids.add(overwrite.id);
 }
 return [...ids];
}
function snapshot(channel:ReturnType<typeof textChannels>[number],id:string):Snapshot {
 const overwrite=channel.permissionOverwrites.cache.get(id);
 const values={} as Snapshot["values"];
 for(const flag of flags){const bit=PermissionFlagsBits[flag];values[flag]=overwrite?.allow.has(bit)?true:overwrite?.deny.has(bit)?false:null;}
 return {id,values,existed:!!overwrite,type:overwrite?.type};
}
function needsDeny(channel:ReturnType<typeof textChannels>[number],id:string) {
 const overwrite=channel.permissionOverwrites.cache.get(id);
 return flags.some(flag=>!overwrite?.deny.has(PermissionFlagsBits[flag]));
}
async function applyDeny(channel:ReturnType<typeof textChannels>[number],id:string) {
 await channel.permissionOverwrites.edit(id,{SendMessages:false,SendMessagesInThreads:false,CreatePublicThreads:false,CreatePrivateThreads:false},{reason:"Cerberus emergency raid lockdown"});
}
export async function lockdownStatus(guild:Guild){
 const rows=await ChannelLockdown.findAll({where:{guildId:guild.id}});
 return {lockedChannelIds:rows.map(r=>r.channelId),channels:textChannels(guild).map(ch=>({id:ch.id,name:ch.name,locked:rows.some(r=>r.channelId===ch.id)}))};
}
export async function setLockdown(guild:Guild,channelIds:string[],locked:boolean) {
 if(busy.has(guild.id))throw new Error("A lockdown operation is already running for this server.");
 busy.add(guild.id);
 const results:{channelId:string;ok:boolean;error?:string}[]=[];
 try{
  await guild.roles.fetch();await guild.channels.fetch();
  for(const id of channelIds){
   const channel=guild.channels.cache.get(id);
   if(!channel||(channel.type!==ChannelType.GuildText&&channel.type!==ChannelType.GuildAnnouncement)){results.push({channelId:id,ok:false,error:"Not a supported text channel"});continue;}
   try{
    const row=await ChannelLockdown.findByPk(id);
    if(locked){
     // Reconcile incomplete prior attempts rather than assuming a DB row means locked.
     const ids=targets(guild,channel);
     if(!row)await ChannelLockdown.create({channelId:id,guildId:guild.id,backups:ids.map(target=>snapshot(channel,target))});
     else {
      const saved=row.backups as Snapshot[];
      const additions=ids.filter(target=>!saved.some(entry=>entry.id===target)).map(target=>snapshot(channel,target));
      if(additions.length){row.backups=[...saved,...additions];await row.save();}
     }
     for(const target of ids)if(needsDeny(channel,target))await applyDeny(channel,target);
     await guild.channels.fetch(id);
     const refreshed=guild.channels.cache.get(id);
     if(!refreshed||(refreshed.type!==ChannelType.GuildText&&refreshed.type!==ChannelType.GuildAnnouncement))throw new Error("Channel unavailable after permission update");
     const stillOpen=targets(guild,refreshed).filter(target=>needsDeny(refreshed,target));
     if(stillOpen.length)throw new Error("Discord did not apply the required send-message restrictions");
    }else{
     if(!row){results.push({channelId:id,ok:true});continue;}
     for(const backup of row.backups as Snapshot[]){
      const exists=backup.id===guild.id||guild.roles.cache.has(backup.id)||channel.permissionOverwrites.cache.has(backup.id);
      if(!exists)continue;
      await channel.permissionOverwrites.edit(backup.id,backup.values,{reason:"Cerberus emergency lockdown released"});
      // Remove an overwrite that Cerberus created only if it has no remaining permissions.
      if(backup.existed===false){
       const current=channel.permissionOverwrites.cache.get(backup.id);
       if(current&&current.allow.bitfield===0n&&current.deny.bitfield===0n)
        await channel.permissionOverwrites.delete(backup.id,"Cerberus lockdown permission cleanup");
      }
     }
     await row.destroy();
    }
    results.push({channelId:id,ok:true});
   }catch(error){const detail=error instanceof Error?error.message:"Discord permission update failed";console.error("[Cerberus lockdown]",guild.id,id,detail);results.push({channelId:id,ok:false,error:detail});}
  }
  return results;
 }finally{busy.delete(guild.id);}
}
export function lockdownChannelIds(guild:Guild){return textChannels(guild).map(ch=>ch.id);}
