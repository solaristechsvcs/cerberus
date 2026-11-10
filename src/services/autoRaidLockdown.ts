import { Client, Guild } from "discord.js";
import { Op } from "sequelize";
import { AutoRaidLockdown } from "../database/models/AutoRaidLockdown";
import { lockdownStatus, setLockdown } from "./channelLockdown";

export async function startAutomaticLockdown(guild:Guild,unlockAt:Date):Promise<void>{
 const existing=await AutoRaidLockdown.findByPk(guild.id);
 if(existing){existing.unlockAt=unlockAt;await existing.save();return;}
 const status=await lockdownStatus(guild);
 const ids=status.channels.filter(ch=>!ch.locked).map(ch=>ch.id);
 // Create a durable record first; a failed channel remains safely retryable on unlock.
 const record=await AutoRaidLockdown.create({guildId:guild.id,channelIds:ids,unlockAt});
 if(!ids.length)return;
 try{
  const results=await setLockdown(guild,ids,true);
  const failed=results.filter(r=>!r.ok);
  if(failed.length)console.error("[Cerberus] Automatic lockdown failed for",guild.id,failed);
 }catch(error){console.error("[Cerberus] Automatic lockdown error",guild.id,error);}
}
export async function releaseAutomaticLockdown(guild:Guild):Promise<void>{
 const record=await AutoRaidLockdown.findByPk(guild.id);
 if(!record)return;
 const ids=record.channelIds;
 if(!ids.length){await record.destroy();return;}
 const results=await setLockdown(guild,ids,false);
 const remaining=results.filter(r=>!r.ok).map(r=>r.channelId);
 if(remaining.length){record.channelIds=remaining;await record.save();console.error("[Cerberus] Failed to restore channels",guild.id,remaining);}
 else await record.destroy();
}
export function startAutoLockdownRecovery(client:Client):NodeJS.Timeout {
 const check=async()=>{
  const records=await AutoRaidLockdown.findAll({where:{unlockAt:{[Op.lte]:new Date()}}});
  for(const record of records){
   const guild=client.guilds.cache.get(record.guildId);
   if(!guild)continue;
   try{await releaseAutomaticLockdown(guild)}catch(error){console.error("[Cerberus] Automatic unlock failed",record.guildId,error)}
  }
 };
 void check().catch(console.error);
 const timer=setInterval(()=>void check().catch(console.error),30000);
 timer.unref();
 return timer;
}
