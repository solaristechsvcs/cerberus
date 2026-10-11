const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ts=require("typescript");
function moduleApi(file,deps,extra={}){
 const exports={};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,"../src",file),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,require(name){if(name in deps)return deps[name];throw Error("Unexpected dependency "+name)},console,process:{env:{TWITCH_CLIENT_ID:"client",TWITCH_CLIENT_SECRET:"secret",YOUTUBE_API_KEY:"key"}},Date,Map,Set,URL,URLSearchParams,AbortSignal,...extra});return exports;
}
function record(data){return {...data,async update(values){Object.assign(this,values);return this},async destroy(){}}}
function database(){
 const states=new Map(),monitors=[],deliveries=[];
 const matches=(row,where)=>Object.entries(where||{}).every(([k,v])=>row[k]===v);
 const sequelize={transaction:async fn=>fn({LOCK:{UPDATE:"UPDATE"}})};
 const models={
  LiveMonitor:{findByPk:async id=>monitors.find(m=>m.id===id)||null,findAll:async({where}={})=>monitors.filter(m=>matches(m,where))},
  LiveDelivery:{findOne:async({where})=>deliveries.find(m=>matches(m,where))||null,create:async values=>{const r=record({messageId:null,...values});deliveries.push(r);return r}},
  LiveProviderState:{findOrCreate:async({where,defaults})=>{if(!states.has(where.key))states.set(where.key,record({key:where.key,data:{},...defaults}));return [states.get(where.key),false]},findByPk:async key=>states.get(key)}
 };
 return {sequelize,models,states,monitors,deliveries};
}
function worker(db=database(),providers={}){
 const sent=[];let fail=false;
 class Embed{constructor(){this.data={}}setTitle(v){this.data.title=v;return this}setURL(v){this.data.url=v;return this}setDescription(v){this.data.description=v;return this}setColor(){return this}setFooter(v){this.data.footer=v;return this}setThumbnail(){return this}setTimestamp(){return this}}
 const channel={id:"channel",type:0,permissionsFor:()=>({has:()=>true}),async send(payload){if(fail)throw Error("send failed");sent.push(payload);return {id:"message"+sent.length,url:"https://discord.com/channels/guild/channel/message"}}};
 const guild={id:"guild",channels:{fetch:async()=>channel},members:{fetchMe:async()=>({id:"bot"})},roles:{everyone:{id:"guild"},fetch:async id=>({id,mentionable:true})}};
 const client={guilds:{cache:new Map([["guild",guild]])}};
 const defaults={providerStatus:()=>({twitch:{ready:true},youtube:{ready:true},tiktok:{ready:true}}),checkTwitch:async()=>new Map(),checkYouTube:async()=>[],checkTikTok:async()=>[]};
 const api=moduleApi("services/liveNotifications.ts",{"node:crypto":require("node:crypto"),"discord.js":{EmbedBuilder:Embed,ChannelType:{GuildText:0,GuildAnnouncement:5},PermissionFlagsBits:{ViewChannel:1,SendMessages:2,EmbedLinks:4,MentionEveryone:8}},"../database":{sequelize:db.sequelize},"../database/models/LiveMonitor":db.models,"./liveProviders":{...defaults,...providers}});
 return {api,db,client,guild,channel,sent,setFailure(value){fail=value}};
}
const monitor=()=>record({id:1,guildId:"guild",platform:"twitch",sourceId:"creator",displayName:"Creator",channelId:"channel",mentionRoleId:"role",messageTemplate:"{creator}: {title} {url} @everyone <@123>",enabled:true});
const stream={id:"stream1",creator:"Creator",title:"Playing Fallout",url:"https://www.twitch.tv/creator"};
test("one alert per broadcast persists across workers and new broadcasts alert again",async()=>{
 const db=database(),m=monitor();db.monitors.push(m);const h=worker(db);
 assert.equal(await h.api.deliverLiveAlert(h.client,m,stream),true);
 assert.equal(await h.api.deliverLiveAlert(h.client,m,stream),false);assert.equal(h.sent.length,1);
 const restarted=worker(db);assert.equal(await restarted.api.deliverLiveAlert(restarted.client,m,stream),false);
 assert.equal(await restarted.api.deliverLiveAlert(restarted.client,m,{...stream,id:"stream2"}),true);assert.equal(restarted.sent.length,1);
 assert.equal(h.sent[0].enforceNonce,true);assert.equal(h.sent[0].nonce.length,24);
});
test("failed Discord sends retry and paused monitors do not send",async()=>{
 const h=worker(),m=monitor();h.db.monitors.push(m);h.setFailure(true);
 await assert.rejects(h.api.deliverLiveAlert(h.client,m,stream),/send failed/);assert.equal(h.db.deliveries[0].messageId,null);
 h.setFailure(false);assert.equal(await h.api.deliverLiveAlert(h.client,m,stream),true);
 m.enabled=false;assert.equal(await h.api.deliverLiveAlert(h.client,m,{...stream,id:"stream2"}),false);assert.equal(h.sent.length,1);
});
test("only the configured role is allowed to ping and tests do not consume delivery history",async()=>{
 const h=worker(),m=monitor();h.db.monitors.push(m);
 await h.api.sendLiveTest(h.client,m);assert.equal(h.db.deliveries.length,0);assert.match(h.sent[0].content,/Test notification/);
 assert.deepEqual(Array.from(h.sent[0].allowedMentions.roles),[]);assert.deepEqual(Array.from(h.sent[0].allowedMentions.parse),[]);
 await h.api.deliverLiveAlert(h.client,m,stream);
 assert.deepEqual(Array.from(h.sent[1].allowedMentions.roles),["role"]);assert.deepEqual(Array.from(h.sent[1].allowedMentions.users),[]);assert.deepEqual(Array.from(h.sent[1].allowedMentions.parse),[]);
});
test("one creator check serves multiple destinations",async()=>{
 let checks=0;const db=database();db.monitors.push(monitor(),record({...monitor(),id:2}));const h=worker(db,{checkTwitch:async ids=>{checks++;assert.equal(ids.length,1);return new Map([["creator",[stream]]])}});
 await h.api.scanLiveNotifications(h.client);assert.equal(checks,1);assert.equal(h.sent.length,2);assert.equal(db.deliveries.length,2);
 await h.api.scanLiveNotifications(h.client);assert.equal(checks,1);
});
function provider(db=database(),fetch){
 return {db,api:moduleApi("services/liveProviders.ts",{"../config":{config:{}},"../database":{sequelize:db.sequelize},"../database/models/LiveMonitor":db.models},{fetch})};
}
const response=data=>({ok:true,status:200,json:async()=>data});
test("creator input normalizes supported URLs and rejects foreign URLs",()=>{
 const {api}=provider();
 assert.equal(api.normalizeCreator("twitch","https://www.twitch.tv/Creator"),"creator");
 assert.throws(()=>api.normalizeCreator("tiktok","<invalid>"),/valid/);
 assert.throws(()=>api.normalizeCreator("youtube","https://example.com/@creator"),/youtube.com/);
 assert.equal(api.normalizeCreator("youtube","https://www.youtube.com/@creator"),"@creator");
});
test("TikTok live rooms use stable broadcast IDs; ended and blocked responses differ",()=>{
 const {api}=provider();
 const live=api.parseTikTokRoom({statusCode:0,data:{user:{nickname:"Creator",roomId:"123"},liveRoom:{status:2,title:"Live"}}},"creator");
 assert.equal(live[0].id,"123");assert.equal(live[0].url,"https://www.tiktok.com/@creator/live");
 assert.equal(api.parseTikTokRoom({statusCode:0,data:{user:{},liveRoom:{status:4}}},"creator").length,0);
 assert.throws(()=>api.parseTikTokRoom({statusCode:10201},"creator"),/unavailable/);
 assert.throws(()=>api.parseTikTokRoom({statusCode:0,data:{user:{},liveRoom:{status:9}}},"creator"),/unknown/);
});
test("Twitch uses app authentication and distinguishes live from offline creators",async()=>{
 const requests=[];const {api}=provider(undefined,async(url,init)=>{requests.push([url,init]);return response(url.includes("oauth2")?{access_token:"token",expires_in:3600}:{data:[{id:"123",user_login:"creator",user_name:"Creator",title:"Live",thumbnail_url:"https://example.com/{width}x{height}",started_at:"2026-10-10T00:00:00Z"}]})});
 const results=await api.checkTwitch(["creator","offline"]);
 assert.equal(results.get("creator")[0].id,"123");assert.equal(results.get("offline").length,0);assert.equal(requests.length,2);
 assert.equal(requests[1][1].headers.Authorization,"Bearer token");await api.checkTwitch(["creator"]);assert.equal(requests.length,3);
});
test("YouTube excludes upcoming, ended and foreign-channel broadcasts and persists search reservations",async()=>{
 const db=database(),channel="UC1234567890123456789012";let searches=0;
 const fetch=async url=>{
  if(url.includes("/feeds/"))return {ok:true,text:async()=>"<feed><yt:videoId>live1234567</yt:videoId><yt:videoId>upcoming123</yt:videoId></feed>"};
  if(url.includes("/search?")){searches++;return response({items:[{id:{videoId:"ended123456"}},{id:{videoId:"foreign1234"}}]})}
  const item=(id,status,start,end,channelId=channel)=>({id,snippet:{channelId,channelTitle:"Creator",title:id,liveBroadcastContent:status},liveStreamingDetails:{actualStartTime:start,actualEndTime:end}});
  return response({items:[item("live1234567","live","2026-10-10T00:00:00Z"),item("upcoming123","upcoming"),item("ended123456","none","2026-10-09T00:00:00Z","2026-10-09T01:00:00Z"),item("foreign1234","live","2026-10-10T00:00:00Z",undefined,"other")]});
 };
 const first=provider(db,fetch);const live=await first.api.checkYouTube(channel,1);assert.equal(live.length,1);assert.equal(live[0].id,"live1234567");assert.equal(searches,1);
 assert.equal(db.states.get("youtube:quota").data.used,1);
 await provider(db,fetch).api.checkYouTube(channel,1);assert.equal(searches,1);
});
test("YouTube exhausted persisted quota skips live search and reports unavailable feeds",async()=>{
 const db=database();db.states.set("youtube:quota",record({key:"youtube:quota",data:{day:new Date().toLocaleDateString("en-CA",{timeZone:"America/Los_Angeles"}),used:90}}));
 const {api}=provider(db,async()=>({ok:false,status:503}));
 await assert.rejects(api.checkYouTube("UC1234567890123456789012",1),/budget/);assert.equal(db.states.get("youtube:quota").data.used,90);
});
test("generated General Settings scripts parse with Live Notifications and existing sections",()=>{
 const source=fs.readFileSync(path.join(__dirname,"../src/dashboard/index.ts"),"utf8");
 const start=source.indexOf("function generalSettingsPage"),end=source.indexOf("\nfunction developerPage",start);
 const html=new Function("sharedStyle","dashboardHeader","dashboardScript",source.slice(start,end).replace("(): string","()")+"return generalSettingsPage()")("",()=>"",()=>"");
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
 for(const id of ["welcome","verification","reactionroles","suggestions","polls","live-notifications"])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/Test Alert/);assert.match(html,/renderLiveNotifications/);
});

test("a failed destination is recorded without stopping another destination",async()=>{
 const db=database(),first=monitor(),second=record({...monitor(),id:2,channelId:"other"});db.monitors.push(first,second);
 const h=worker(db,{checkTwitch:async()=>new Map([["creator",[stream]]])});
 h.guild.channels.fetch=async id=>id==="channel"?null:h.channel;
 await h.api.scanLiveNotifications(h.client);
 assert.match(first.lastError,/channel/);assert.equal(second.lastError,null);assert.equal(h.sent.length,1);
});
test("dashboard routes require admin middleware and scope every mutation to the requested guild",async()=>{
 const routes=[];const admin=()=>{};const app={};for(const method of ["get","post","put","delete"])app[method]=(...args)=>routes.push({method,args});
 const queries=[];const models={LiveMonitor:{findOne:async query=>{queries.push(query);return null}}};
 const api=moduleApi("dashboard/liveNotifications.ts",{"discord.js":{ChannelType:{GuildText:0,GuildAnnouncement:5}},"../database/models/LiveMonitor":models,"../services/liveProviders":{},"../services/liveNotifications":{}});
 api.registerLiveNotificationRoutes(app,{guilds:{cache:new Map([["guild",{id:"guild"}]])}},admin);
 assert.equal(routes.length,5);assert.ok(routes.every(r=>r.args[1]===admin));
 const res={status(code){this.code=code;return this},json(value){this.value=value;return this}};
 for(const route of routes.filter(r=>r.args[0].includes("/:id"))){
  await route.args[2]({params:{guildId:"guild",id:"123"},body:{enabled:true}},res);
  assert.equal(res.code,404);assert.equal(queries.at(-1).where.guildId,"guild");assert.equal(queries.at(-1).where.id,123);
 }
});
