import { ChannelType, Guild, PermissionFlagsBits } from "discord.js";
import { ChannelLockdown } from "../database/models/ChannelLockdown";

const flags = ["SendMessages","SendMessagesInThreads","CreatePublicThreads","CreatePrivateThreads"] as const;
type Flag = typeof flags[number];
type Snapshot = {id:string; values:Record<Flag,boolean|null>};
const busy = new Set<string>();
function targets(guild:Guild) {
 return [guild.roles.everyone,...guild.roles.cache.filter(r=>r.id!==guild.id&&!r.permissions.has(PermissionFlagsBits.Administrator)).values()];
}
function textChannels(guild:Guild) {
 return [...guild.channels.cache.values()].filter(ch=>ch.type===ChannelType.GuildText||ch.type===ChannelType.GuildAnnouncement);
}
function snapshot(channel:any,roleId:string):Snapshot {
 const overwrite=channel.permissionOverwrites.cache.get(roleId);
 const values={} as Snapshot["values"];
 for(const flag of flags){const bit=PermissionFlagsBits[flag];values[flag]=overwrite?.allow.has(bit)?true:overwrite?.deny.has(bit)?false:null;}
 return {id:roleId,values};
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
     if(row){results.push({channelId:id,ok:true});continue;}
     const backups=targets(guild).map(role=>snapshot(channel,role.id));
     // Save first so a partial failure can be reversed by unlocking.
     await ChannelLockdown.create({channelId:id,guildId:guild.id,backups});
     for(const role of targets(guild)){
      await channel.permissionOverwrites.edit(role,{SendMessages:false,SendMessagesInThreads:false,CreatePublicThreads:false,CreatePrivateThreads:false},{reason:"Cerberus emergency raid lockdown"});
     }
    }else{
     if(!row){results.push({channelId:id,ok:true});continue;}
     for(const backup of row.backups as Snapshot[]){
      const role=guild.roles.cache.get(backup.id);if(!role)continue;
      await channel.permissionOverwrites.edit(role,backup.values,{reason:"Cerberus emergency lockdown released"});
     }
     await row.destroy();
    }
    results.push({channelId:id,ok:true});
   }catch(error){results.push({channelId:id,ok:false,error:error instanceof Error?error.message:"Discord permission update failed"});}
  }
  return results;
 }finally{busy.delete(guild.id);}
}
export function lockdownChannelIds(guild:Guild){return textChannels(guild).map(ch=>ch.id);}
