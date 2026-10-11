import { Express, RequestHandler } from "express";
import { Client, ChannelType } from "discord.js";
import { LiveMonitor, LivePlatform } from "../database/models/LiveMonitor";
import { providerStatus, resolveCreator, youtubeSearchInterval } from "../services/liveProviders";
import { defaultLiveTemplate, sendLiveTest, validateLiveDestination } from "../services/liveNotifications";

export function registerLiveNotificationRoutes(app:Express,client:Client,requireGuildAdmin:RequestHandler){
 const base="/api/guild/:guildId/live-notifications";
 app.get(base,requireGuildAdmin,async(req,res)=>{
  try{
   const guild=client.guilds.cache.get(String(req.params.guildId));if(!guild)return void res.status(404).json({error:"Server not found."});
   const monitors=await LiveMonitor.findAll({where:{guildId:guild.id},order:[["id","ASC"]]});
   const youtube=await LiveMonitor.findAll({where:{platform:"youtube",enabled:true},attributes:["sourceId"]});
   const creators=new Set(youtube.map(row=>row.sourceId)).size;
   res.json({monitors,providers:providerStatus(),youtubeSearchMinutes:Math.ceil(youtubeSearchInterval(creators)/60000),channels:[...guild.channels.cache.values()].filter(ch=>ch.type===ChannelType.GuildText||ch.type===ChannelType.GuildAnnouncement).map(ch=>({id:ch.id,name:"#"+ch.name})),roles:[...guild.roles.cache.values()].filter(role=>role.id!==guild.id&&!role.managed).map(role=>({id:role.id,name:role.name}))});
  }catch{res.status(500).json({error:"Could not load live notifications."})}
 });
 app.post(base,requireGuildAdmin,async(req,res)=>{
  try{
   const guild=client.guilds.cache.get(String(req.params.guildId));if(!guild)return void res.status(404).json({error:"Server not found."});
   const platform=req.body?.platform as LivePlatform;if(!["twitch","youtube","tiktok"].includes(platform))throw new Error("Choose Twitch, YouTube or TikTok.");
   if(typeof req.body.creator!=="string")throw new Error("Enter a creator.");
   const channelId=String(req.body.channelId||""),mentionRoleId=req.body.mentionRoleId?String(req.body.mentionRoleId):null;
   const messageTemplate=String(req.body.messageTemplate||defaultLiveTemplate).trim();if(!messageTemplate||messageTemplate.length>1000)throw new Error("Use a message between 1 and 1,000 characters.");
   await validateLiveDestination(guild,channelId,mentionRoleId);
   const creator=await resolveCreator(platform,req.body.creator);
   const existing=await LiveMonitor.findOne({where:{guildId:guild.id,platform,sourceId:creator.sourceId}});
   if(existing)throw new Error("This creator already has a notification configuration in this server. Edit that configuration.");
   if(await LiveMonitor.count({where:{guildId:guild.id}})>=50)throw new Error("This server can configure up to 50 creators.");
   const monitor=await LiveMonitor.create({guildId:guild.id,platform,...creator,channelId,mentionRoleId,messageTemplate,enabled:true});res.json({ok:true,monitor});
  }catch(error){res.status(400).json({error:error instanceof Error?error.message:"Could not add this creator."})}
 });
 app.put(base+"/:id",requireGuildAdmin,async(req,res)=>{
  try{
   const guild=client.guilds.cache.get(String(req.params.guildId));if(!guild)return void res.status(404).json({error:"Server not found."});
   const monitor=await LiveMonitor.findOne({where:{id:Number(req.params.id),guildId:guild.id}});if(!monitor)return void res.status(404).json({error:"Configuration not found."});
   if(typeof req.body?.enabled!=="boolean")throw new Error("Enabled must be true or false.");
   const channelId=req.body.channelId===undefined?monitor.channelId:String(req.body.channelId);
   const mentionRoleId=req.body.mentionRoleId===undefined?monitor.mentionRoleId:req.body.mentionRoleId?String(req.body.mentionRoleId):null;
   const messageTemplate=req.body.messageTemplate===undefined?monitor.messageTemplate:String(req.body.messageTemplate).trim();
   if(!messageTemplate||messageTemplate.length>1000)throw new Error("Use a message between 1 and 1,000 characters.");
   await validateLiveDestination(guild,channelId,mentionRoleId);
   await monitor.update({channelId,mentionRoleId,messageTemplate,enabled:req.body.enabled});res.json({ok:true});
  }catch(error){res.status(400).json({error:error instanceof Error?error.message:"Could not save this configuration."})}
 });
 app.delete(base+"/:id",requireGuildAdmin,async(req,res)=>{
  try{const monitor=await LiveMonitor.findOne({where:{id:Number(req.params.id),guildId:String(req.params.guildId)}});if(!monitor)return void res.status(404).json({error:"Configuration not found."});await monitor.destroy();res.json({ok:true})}catch{res.status(500).json({error:"Could not remove this configuration."})}
 });
 app.post(base+"/:id/test",requireGuildAdmin,async(req,res)=>{
  try{const monitor=await LiveMonitor.findOne({where:{id:Number(req.params.id),guildId:String(req.params.guildId)}});if(!monitor)return void res.status(404).json({error:"Configuration not found."});const url=await sendLiveTest(client,monitor);res.json({ok:true,url})}catch(error){res.status(400).json({error:error instanceof Error?error.message:"Could not send the test alert."})}
 });
}
