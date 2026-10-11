import crypto from "node:crypto";
import { ChannelType, Client, EmbedBuilder, Guild, PermissionFlagsBits } from "discord.js";
import { sequelize } from "../database";
import { LiveDelivery, LiveMonitor, LivePlatform } from "../database/models/LiveMonitor";
import { checkTikTok, checkTwitch, checkYouTube, LiveStream, providerStatus } from "./liveProviders";

export const defaultLiveTemplate="{creator} is live on {platform}! {url}";
export async function validateLiveDestination(guild:Guild,channelId:string,mentionRoleId:string|null){
 const channel=await guild.channels.fetch(channelId).catch(()=>null);
 if(!channel||(channel.type!==ChannelType.GuildText&&channel.type!==ChannelType.GuildAnnouncement))throw new Error("Select a text or announcement channel.");
 const me=await guild.members.fetchMe(),permissions=channel.permissionsFor(me);
 if(!permissions?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks]))throw new Error("Cerberus needs View Channel, Send Messages and Embed Links in the notification channel.");
 if(mentionRoleId){
  const role=await guild.roles.fetch(mentionRoleId).catch(()=>null);
  if(!role||role.id===guild.roles.everyone.id)throw new Error("Select a valid notification role; @everyone is not supported.");
  if(!role.mentionable&&!permissions.has(PermissionFlagsBits.MentionEveryone))throw new Error("Make the selected role mentionable or grant Cerberus Mention Everyone in the notification channel.");
 }
 return channel;
}
export function liveMessage(monitor:LiveMonitor,stream:LiveStream,test=false){
 const platform=monitor.platform==="twitch"?"Twitch":monitor.platform==="youtube"?"YouTube":"TikTok";
 const replacements:Record<string,string>={creator:stream.creator,platform,title:stream.title,url:stream.url};
 const body=(monitor.messageTemplate||defaultLiveTemplate).replace(/\{(creator|platform|title|url)\}/g,(_,key:string)=>replacements[key]).slice(0,1800);
 const prefix=test?"[Test notification] ":monitor.mentionRoleId?"<@&"+monitor.mentionRoleId+"> ":"";
 const embed=new EmbedBuilder().setTitle((stream.title||stream.creator+" is live").slice(0,256)).setURL(stream.url).setDescription(stream.creator+" is live on "+platform).setColor(monitor.platform==="twitch"?0x9146ff:monitor.platform==="youtube"?0xff0000:0x25f4ee).setFooter({text:(test?"Test • ":"")+platform+" Live Notifications"});
 if(stream.thumbnail&&/^https:\/\//.test(stream.thumbnail))embed.setThumbnail(stream.thumbnail);
 if(stream.startedAt&&Number.isFinite(Date.parse(stream.startedAt)))embed.setTimestamp(new Date(stream.startedAt));
 return {content:prefix+body,embeds:[embed],allowedMentions:{parse:[] as [],users:[] as string[],roles:test?[]:monitor.mentionRoleId?[monitor.mentionRoleId]:[]}};
}
export async function deliverLiveAlert(client:Client,monitor:LiveMonitor,stream:LiveStream){
 // Lock the monitor to coordinate multiple workers and configuration edits.
 return sequelize.transaction(async transaction=>{
  const current=await LiveMonitor.findByPk(monitor.id,{transaction,lock:transaction.LOCK.UPDATE});
  if(!current?.enabled)return false;
  const existing=await LiveDelivery.findOne({where:{monitorId:current.id,streamId:stream.id},transaction});
  if(existing?.messageId)return false;
  const guild=client.guilds.cache.get(current.guildId);if(!guild)throw new Error("Cerberus is no longer in this server.");
  const channel=await validateLiveDestination(guild,current.channelId,current.mentionRoleId);
  const delivery=existing||await LiveDelivery.create({monitorId:current.id,streamId:stream.id,channelId:current.channelId},{transaction});
  const nonce=crypto.createHash("sha256").update(current.id+":"+stream.id).digest("hex").slice(0,24);
  const message=await channel.send({...liveMessage(current,stream),nonce,enforceNonce:true});
  await delivery.update({messageId:message.id,sentAt:new Date(),channelId:channel.id},{transaction});
  return true;
 });
}
export async function sendLiveTest(client:Client,monitor:LiveMonitor){
 const guild=client.guilds.cache.get(monitor.guildId);if(!guild)throw new Error("Server not found.");
 const channel=await validateLiveDestination(guild,monitor.channelId,monitor.mentionRoleId);
 const url=monitor.platform==="twitch"?"https://www.twitch.tv/"+monitor.sourceId:monitor.platform==="youtube"?"https://www.youtube.com/channel/"+monitor.sourceId+"/live":"https://www.tiktok.com/@"+monitor.sourceId+"/live";
 const message=await channel.send(liveMessage(monitor,{id:"test",creator:monitor.displayName,title:"Live notification preview",url},true));
 return message.url;
}
const lastChecks=new Map<string,number>();
let scanRunning=false;
export async function scanLiveNotifications(client:Client){
 if(scanRunning)return;scanRunning=true;
 try{
  const monitors=await LiveMonitor.findAll({where:{enabled:true},order:[["id","ASC"]]});
  const groups=new Map<string,LiveMonitor[]>();
  for(const monitor of monitors){
   if(!client.guilds.cache.has(monitor.guildId))continue;
   const key=monitor.platform+":"+monitor.sourceId;groups.set(key,[...(groups.get(key)||[]),monitor]);
  }
  const youtubeCreators=[...groups.keys()].filter(key=>key.startsWith("youtube:")).length;
  const statuses=providerStatus(),due=new Map<string,LiveMonitor[]>();
  for(const [key,items] of groups){
   const interval=items[0].platform==="twitch"?60_000:120_000;
   if(Date.now()-(lastChecks.get(key)||0)>=interval)due.set(key,items);
  }
  let twitchStreams:Map<string,LiveStream[]>|undefined,twitchError:string|undefined;
  const twitchIds=[...due.values()].filter(items=>items[0].platform==="twitch").map(items=>items[0].sourceId);
  if(twitchIds.length&&statuses.twitch.ready){
   try{twitchStreams=await checkTwitch(twitchIds)}catch(error){twitchError=error instanceof Error?error.message:"Twitch check failed."}
  }
  for(const [key,items] of due){
   lastChecks.set(key,Date.now());
   const platform=items[0].platform;
   let streams:LiveStream[]=[];
   try{
    if(!statuses[platform].ready)throw new Error(platform==="twitch"?"Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET on the bot host.":"Set YOUTUBE_API_KEY on the bot host.");
    if(platform==="twitch"){if(twitchError)throw new Error(twitchError);streams=twitchStreams?.get(items[0].sourceId)||[]}
    else if(platform==="youtube")streams=await checkYouTube(items[0].sourceId,youtubeCreators);
    else streams=await checkTikTok(items[0].sourceId);
   }catch(error){
    const message=(error instanceof Error?error.message:"Live status check failed.").slice(0,1000);
    for(const monitor of items)await monitor.update({lastCheckedAt:new Date(),lastError:message});
    continue;
   }
   for(const monitor of items){
    try{for(const stream of streams)await deliverLiveAlert(client,monitor,stream);await monitor.update({lastCheckedAt:new Date(),lastError:null})}
    catch(error){await monitor.update({lastCheckedAt:new Date(),lastError:(error instanceof Error?error.message:"Discord delivery failed.").slice(0,1000)})}
   }
  }
  for(const key of lastChecks.keys())if(!groups.has(key))lastChecks.delete(key);
 }finally{scanRunning=false}
}
export function startLiveNotifications(client:Client){
 const tick=()=>void scanLiveNotifications(client).catch(error=>console.error("Live notification scan failed:",error));
 tick();const timer=setInterval(tick,30000);timer.unref();return timer;
}
