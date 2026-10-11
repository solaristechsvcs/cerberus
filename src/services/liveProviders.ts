import { config } from "../config";
import { sequelize } from "../database";
import { LivePlatform, LiveProviderState } from "../database/models/LiveMonitor";

export type LiveStream={id:string;creator:string;title:string;url:string;thumbnail?:string;startedAt?:string};
type TwitchUser={id:string;login:string;display_name:string};
type TwitchStream={id:string;user_name:string;user_login:string;title:string;thumbnail_url:string;started_at:string};
type YouTubeChannel={id:string;snippet:{title:string}};
type YouTubeVideo={id:string;snippet:{channelId:string;channelTitle:string;title:string;liveBroadcastContent:string;thumbnails?:{medium?:{url:string}}};liveStreamingDetails?:{actualStartTime?:string;actualEndTime?:string}};
const minute=60_000;
const credentials=()=>({
 twitchClientId:process.env.TWITCH_CLIENT_ID||config.liveNotifications?.twitchClientId||"",
 twitchClientSecret:process.env.TWITCH_CLIENT_SECRET||config.liveNotifications?.twitchClientSecret||"",
 youtubeApiKey:process.env.YOUTUBE_API_KEY||config.liveNotifications?.youtubeApiKey||""
});
export function providerStatus(){
 const keys=credentials();
 return {twitch:{ready:!!keys.twitchClientId&&!!keys.twitchClientSecret,experimental:false},youtube:{ready:!!keys.youtubeApiKey,experimental:false},tiktok:{ready:true,experimental:true}};
}
export function youtubeSearchInterval(creators:number){
 const raw=Number(process.env.YOUTUBE_DAILY_SEARCH_LIMIT||config.liveNotifications?.youtubeDailySearchLimit||90);
 const budget=Number.isFinite(raw)?Math.max(1,Math.min(1000,Math.floor(raw))):90;
 return Math.max(15*minute,Math.ceil(24*60*minute*Math.max(1,creators)/budget));
}
export function normalizeCreator(platform:LivePlatform,input:string){
 let value=input.trim();
 if(/^https?:\/\//i.test(value)){
  const url=new URL(value);if(url.protocol!=="https:")throw new Error("Use a HTTPS creator URL.");
  const host=url.hostname.toLowerCase().replace(/^www\./,"");
  const expected=platform==="twitch"?"twitch.tv":platform==="tiktok"?"tiktok.com":"youtube.com";
  if(host!==expected)throw new Error("Use a creator URL from "+expected+".");
  value=decodeURIComponent(url.pathname).replace(/^\/|\/$/g,"");
  if(platform==="youtube")value=value.replace(/^channel\//,"");
 }
 value=value.replace(/^@/,"");
 if(platform==="youtube"){
  if(/^UC[A-Za-z0-9_-]{22}$/.test(value))return value;
  if(!/^[\p{L}\p{N}_.-]{3,50}$/u.test(value))throw new Error("Enter a YouTube channel ID (UC...) or @handle.");
  return "@"+value;
 }
 if(!(platform==="twitch"?/^[A-Za-z0-9_]{1,25}$/:/^[A-Za-z0-9_.]{2,24}$/).test(value))throw new Error("Enter a valid "+platform+" username or creator URL.");
 return value.toLowerCase();
}
async function json<T>(url:string,init:RequestInit={},provider="Provider"):Promise<T>{
 let response:Response;
 try{response=await fetch(url,{...init,signal:AbortSignal.timeout(10000)})}catch{throw new Error(provider+" could not be reached. The next check will retry.")}
 if(!response.ok)throw new Error(provider+" returned HTTP "+response.status+". Check credentials, quota and provider availability.");
 try{return await response.json() as T}catch{throw new Error(provider+" returned an unsupported response or blocked this request.")}
}
let token:{value:string;until:number}|null=null;
let tokenRequest:Promise<string>|null=null;
async function twitchToken(){
 if(token&&token.until>Date.now())return token.value;
 if(tokenRequest)return tokenRequest;
 tokenRequest=(async()=>{
  const keys=credentials();if(!keys.twitchClientId||!keys.twitchClientSecret)throw new Error("Configure TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET on the bot host.");
  const data=await json<{access_token:string;expires_in:number}>("https://id.twitch.tv/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:keys.twitchClientId,client_secret:keys.twitchClientSecret,grant_type:"client_credentials"})},"Twitch authentication");
  if(!data.access_token)throw new Error("Twitch did not return an access token.");
  token={value:data.access_token,until:Date.now()+Math.max(1,data.expires_in-60)*1000};return data.access_token;
 })();
 try{return await tokenRequest}finally{tokenRequest=null}
}
async function twitch<T>(path:string):Promise<T>{
 try{return await json<T>("https://api.twitch.tv/helix/"+path,{headers:{"Client-Id":credentials().twitchClientId,Authorization:"Bearer "+await twitchToken()}},"Twitch")}
 catch(error){if(error instanceof Error&&error.message.includes("HTTP 401"))token=null;throw error}
}
async function youtube<T>(path:string,params:Record<string,string>):Promise<T>{
 const key=credentials().youtubeApiKey;if(!key)throw new Error("Configure YOUTUBE_API_KEY on the bot host.");
 return json<T>("https://www.googleapis.com/youtube/v3/"+path+"?"+new URLSearchParams({...params,key}),{},"YouTube");
}
export async function resolveCreator(platform:LivePlatform,input:string){
 const value=normalizeCreator(platform,input);
 if(platform==="twitch"){
  const data=await twitch<{data:TwitchUser[]}>("users?login="+encodeURIComponent(value));
  const user=data.data?.[0];if(!user)throw new Error("Twitch creator not found.");
  return {sourceId:user.login.toLowerCase(),displayName:user.display_name};
 }
 if(platform==="youtube"){
  const data=await youtube<{items:YouTubeChannel[]}>("channels",{part:"snippet",...(value.startsWith("@")?{forHandle:value}:{id:value})});
  const channel=data.items?.[0];if(!channel)throw new Error("YouTube channel not found.");
  return {sourceId:channel.id,displayName:channel.snippet.title.slice(0,100)};
 }
 return {sourceId:value,displayName:value};
}
export async function checkTwitch(sourceIds:string[]):Promise<Map<string,LiveStream[]>>{
 const out=new Map<string,LiveStream[]>();for(const id of sourceIds)out.set(id,[]);
 for(let start=0;start<sourceIds.length;start+=100){
  const params=new URLSearchParams({first:"100"});for(const id of sourceIds.slice(start,start+100))params.append("user_login",id);
  const data=await twitch<{data:TwitchStream[]}>("streams?"+params);
  if(!Array.isArray(data.data))throw new Error("Twitch returned an unsupported stream response.");
  for(const stream of data.data)out.set(stream.user_login.toLowerCase(),[{id:stream.id,creator:stream.user_name,title:stream.title,url:"https://www.twitch.tv/"+stream.user_login,thumbnail:stream.thumbnail_url?.replace("{width}","640").replace("{height}","360"),startedAt:stream.started_at}]);
 }
 return out;
}
async function reserveYouTubeSearch(){
 const limitRaw=Number(process.env.YOUTUBE_DAILY_SEARCH_LIMIT||config.liveNotifications?.youtubeDailySearchLimit||90);
 const limit=Number.isFinite(limitRaw)?Math.max(1,Math.min(1000,Math.floor(limitRaw))):90;
 const day=new Date().toLocaleDateString("en-CA",{timeZone:"America/Los_Angeles"});
 await LiveProviderState.findOrCreate({where:{key:"youtube:quota"},defaults:{key:"youtube:quota",data:{day,used:0}}});
 return sequelize.transaction(async transaction=>{
  const state=await LiveProviderState.findByPk("youtube:quota",{transaction,lock:transaction.LOCK.UPDATE});if(!state)return false;
  const used=state.data.day===day?Number(state.data.used)||0:0;
  if(used>=limit)return false;
  await state.update({data:{day,used:used+1}},{transaction});return true;
 });
}
export async function checkYouTube(sourceId:string,creatorCount:number):Promise<LiveStream[]>{
 if(!credentials().youtubeApiKey)throw new Error("Configure YOUTUBE_API_KEY on the bot host.");
 const [state]=await LiveProviderState.findOrCreate({where:{key:"youtube:"+sourceId}});
 const candidateIds=new Set<string>(Array.isArray(state.data.candidates)?state.data.candidates.filter((v):v is string=>typeof v==="string"):[]);
 let feedWorked=false;
 try{
  const response=await fetch("https://www.youtube.com/feeds/videos.xml?channel_id="+encodeURIComponent(sourceId),{signal:AbortSignal.timeout(10000)});
  if(response.ok){const xml=await response.text();if(!xml.includes("<feed"))throw new Error("Invalid feed");feedWorked=true;for(const match of xml.matchAll(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/g))candidateIds.add(match[1])}
 }catch{ /* The official live-search fallback remains available. */ }
 const interval=youtubeSearchInterval(creatorCount);
 const due=Date.now()-Number(state.data.lastSearchAt||0)>=interval;
 let searched=false;
 if(due&&await reserveYouTubeSearch()){
  // Reserve before sending so restarts and retries cannot reset the daily budget.
  await state.update({data:{...state.data,lastSearchAt:Date.now(),candidates:[...candidateIds]}});
  const data=await youtube<{items:{id:{videoId?:string}}[]}>("search",{part:"id",channelId:sourceId,type:"video",eventType:"live",maxResults:"50"});
  for(const item of data.items||[])if(item.id.videoId)candidateIds.add(item.id.videoId);searched=true;
 }
 if(!feedWorked&&!searched&&!candidateIds.size)throw new Error("YouTube feed is unavailable and live-search budget is exhausted or cooling down.");
 const ids=[...candidateIds].slice(-100),live:LiveStream[]=[],keep:string[]=[];
 for(let offset=0;offset<ids.length;offset+=50){
  const data=await youtube<{items:YouTubeVideo[]}>("videos",{part:"snippet,liveStreamingDetails",id:ids.slice(offset,offset+50).join(",")});
  for(const video of data.items||[]){
   if(video.snippet.channelId!==sourceId)continue;
   const details=video.liveStreamingDetails;
   if(video.snippet.liveBroadcastContent==="upcoming"||(details?.actualStartTime&&!details.actualEndTime))keep.push(video.id);
   // Upcoming streams and completed broadcasts must not generate live alerts.
   if(video.snippet.liveBroadcastContent!=="live"||!details?.actualStartTime||details.actualEndTime)continue;
   live.push({id:video.id,creator:video.snippet.channelTitle,title:video.snippet.title,url:"https://www.youtube.com/watch?v="+video.id,thumbnail:video.snippet.thumbnails?.medium?.url,startedAt:details.actualStartTime});
  }
 }
 await state.update({data:{...state.data,candidates:keep}});
 return live;
}
type TikTokRoom={statusCode?:number;data?:{user?:{roomId?:string;nickname?:string};liveRoom?:{status?:number;roomId?:string;id?:string;title?:string;coverUrl?:string;startTime?:number}}};
export function parseTikTokRoom(data:TikTokRoom,username:string):LiveStream[]{
 if(data.statusCode!==0||!data.data?.user)throw new Error("TikTok status checks are unavailable, blocked, or the creator was not found.");
 const room=data.data.liveRoom;
 if(!room||room.status===4||room.status===0)return [];
 if(room.status!==2)throw new Error("TikTok returned an unknown live status.");
 const id=room.roomId||room.id||data.data.user.roomId;
 if(!id||id==="0")throw new Error("TikTok did not return a stable live room ID.");
 return [{id,creator:data.data.user.nickname||username,title:room.title||username+" is live",url:"https://www.tiktok.com/@"+username+"/live",thumbnail:room.coverUrl,startedAt:room.startTime?new Date(room.startTime*1000).toISOString():undefined}];
}
export async function checkTikTok(username:string){
 // Public website status endpoint; unofficial and may be blocked or change.
 const data=await json<TikTokRoom>("https://www.tiktok.com/api-live/user/room/?aid=1988&sourceType=54&uniqueId="+encodeURIComponent(username),{headers:{"User-Agent":"Mozilla/5.0","Referer":"https://www.tiktok.com/"}},"TikTok (unofficial)");
 return parseTikTokRoom(data,username);
}
