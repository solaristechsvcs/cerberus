const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ts=require("typescript");

function harness(){
 const polls=[],votes=[],edits=[];let sendFailure=false,editFailure=false;
 class Builder{
  constructor(){this.data={};this.components=[]}
  setName(v){this.data.name=v;return this}setDescription(v){this.data.description=v;return this}
  setTitle(v){this.data.title=v;return this}setFooter(v){this.data.footer=v;return this}
  setColor(){return this}setCustomId(v){this.data.custom_id=v;return this}
  setLabel(v){this.data.label=v;return this}setStyle(){return this}
  setDisabled(v){this.data.disabled=v;return this}setDefaultMemberPermissions(){return this}
  setRequired(){return this}setMaxLength(){return this}setMinValue(){return this}setMaxValue(){return this}
  addChannelTypes(){return this}addFields(){return this}
  addComponents(...values){this.components.push(...values);return this}
  addSubcommand(fn){fn(new Builder());return this}addChannelOption(fn){fn(new Builder());return this}
  addStringOption(fn){fn(new Builder());return this}addIntegerOption(fn){fn(new Builder());return this}
 }
 const Op={lte:Symbol("lte")};
 function matches(row,where){return Object.entries(where||{}).every(([key,value])=>value&&typeof value==="object"&&Op.lte in value?row[key]!==null&&row[key]<=value[Op.lte]:row[key]===value)}
 function record(data,list){const row={id:list.length+1,status:"OPEN",messageId:null,...data,
  async update(values){Object.assign(this,values);return this},async destroy(){list.splice(list.indexOf(this),1)},
  toJSON(){return Object.fromEntries(Object.entries(this).filter(([,v])=>typeof v!=="function"))}};list.push(row);return row}
 const Poll={create:async data=>record(data,polls),findOne:async({where})=>polls.find(row=>matches(row,where))||null,findAll:async({where})=>polls.filter(row=>matches(row,where))};
 const PollVote={create:async data=>{if(votes.some(v=>v.pollId===data.pollId&&v.userId===data.userId))throw Error("duplicate vote");return record(data,votes)},
  findOne:async({where})=>votes.find(row=>matches(row,where))||null,findAll:async({where})=>votes.filter(row=>matches(row,where))};
 const message={id:"message",url:"https://discord.com/channels/guild/channel/message",async edit(payload){if(editFailure)throw Error("Discord unavailable");edits.push(payload)},async delete(){}};
 const channel={id:"channel",type:0,isTextBased:()=>true,permissionsFor:()=>({has:()=>true}),messages:{fetch:async()=>message},async send(payload){if(sendFailure)throw Error("publish failed");edits.push(payload);return message}};
 const guild={id:"guild",channels:{fetch:async()=>channel},members:{fetchMe:async()=>({id:"bot"}),fetch:async()=>({permissions:{has:()=>false}})}};
 const discord={ActionRowBuilder:Builder,ButtonBuilder:Builder,EmbedBuilder:Builder,SlashCommandBuilder:Builder,
  ChannelType:{GuildText:0,GuildAnnouncement:5},ButtonStyle:{Primary:1,Danger:4},PermissionFlagsBits:{ManageGuild:1,ViewChannel:2,SendMessages:4,EmbedLinks:8}};
 const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,"../src/commands/polls.ts"),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const api={};vm.runInNewContext(compiled,{exports:api,require(name){
  if(name==="discord.js")return discord;if(name==="sequelize")return {Op};
  if(name==="../database")return {sequelize:{transaction:async fn=>fn({LOCK:{UPDATE:"UPDATE"}})}};
  if(name.endsWith("/Poll"))return {Poll,PollVote};throw Error("Unexpected dependency: "+name);
 },console:{error(){}},Date,Map,Set,Number,Error,Promise});
 return {api,guild,polls,votes,edits,failSend(){sendFailure=true},failEdit(){editFailure=true}};
}
test("validates choices and rolls back failed publishes",async()=>{
 const h=harness();
 assert.throws(()=>h.api.validatePoll("Question",["Yes"," yes "],0),/different/);
 assert.throws(()=>h.api.validatePoll("Question",["Only one"],0),/2 to 10/);
 assert.throws(()=>h.api.validatePoll("Question",["Yes","No"],1.5),/Duration/);
 h.failSend();await assert.rejects(h.api.createPoll(h.guild,"owner","channel","Question",["Yes","No"]),/publish failed/);
 assert.equal(h.polls.length,0);
});
test("one vote per member supports changing and withdrawing",async()=>{
 const h=harness();await h.api.createPoll(h.guild,"owner","channel","Question",["Yes","No"]);
 await h.api.recordPollVote(h.guild,1,"user",0,"message");assert.equal(h.votes.length,1);
 await h.api.recordPollVote(h.guild,1,"user",1,"message");assert.equal(h.votes.length,1);assert.equal(h.votes[0].optionIndex,1);
 await h.api.recordPollVote(h.guild,1,"user",1,"message");assert.equal(h.votes.length,0);
 assert.equal((await h.api.pollResults(h.polls[0])).total,0);
});
test("concurrent votes are counted and serialized through the message refresh",async()=>{
 const h=harness();await h.api.createPoll(h.guild,"owner","channel","Question",["Yes","No"]);
 await Promise.all([h.api.recordPollVote(h.guild,1,"a",0,"message"),h.api.recordPollVote(h.guild,1,"b",1,"message")]);
 const result=await h.api.pollResults(h.polls[0]);assert.equal(result.total,2);assert.deepEqual(Array.from(result.counts),[1,1]);
 assert.match(h.edits.at(-1).embeds[0].data.footer.text,/2 voter/);
});
test("only creators or managers can close; closed polls reject votes",async()=>{
 const h=harness();await h.api.createPoll(h.guild,"owner","channel","Question",["Yes","No"]);
 await assert.rejects(h.api.closePoll(h.guild,1,"stranger"),/Only the poll creator/);
 await assert.rejects(h.api.closePoll({...h.guild,id:"other"},1,"owner"),/not found/);
 await h.api.closePoll(h.guild,1,"manager",true);assert.equal(h.polls[0].status,"CLOSED");
 assert.ok(h.edits.at(-1).components.every(row=>row.components.every(button=>button.data.disabled)));
 await assert.rejects(h.api.recordPollVote(h.guild,1,"user",0,"message"),/closed/);assert.equal(h.votes.length,0);
});
test("expired polls reject votes and expiry scan closes persisted deadlines",async()=>{
 const h=harness();await h.api.createPoll(h.guild,"owner","channel","Question",["Yes","No"],1);
 h.polls[0].endsAt=new Date(Date.now()-1000);
 await assert.rejects(h.api.recordPollVote(h.guild,1,"user",0,"message"),/ended/);assert.equal(h.votes.length,0);
 const second=await h.api.createPoll(h.guild,"owner","channel","Another",["A","B"],1);second.poll.endsAt=new Date(Date.now()-1000);
 await h.api.expirePolls({guilds:{cache:new Map([["guild",h.guild]])}});
 assert.equal(second.poll.status,"CLOSED");
});
test("votes are scoped to their message and survive refresh failures",async()=>{
 const h=harness();await h.api.createPoll(h.guild,"owner","channel","Question",["Yes","No"]);
 await assert.rejects(h.api.recordPollVote(h.guild,1,"user",0,"wrong-message"),/no longer/);
 await assert.rejects(h.api.recordPollVote(h.guild,1,"user",9,"message"),/Invalid poll choice/);
 h.failEdit();const result=await h.api.recordPollVote(h.guild,1,"user",0,"message");
 assert.match(result,/saved/);assert.equal(h.votes.length,1);
});
test("generated General Settings poll JavaScript parses",()=>{
 const source=fs.readFileSync(path.join(__dirname,"../src/dashboard/index.ts"),"utf8");
 const start=source.indexOf("function generalSettingsPage"),end=source.indexOf("\nfunction developerPage",start);
 const html=new Function("sharedStyle","dashboardHeader","dashboardScript",source.slice(start,end).replace("(): string","()")+"return generalSettingsPage()")("",()=>"",()=>"");
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
 assert.match(html,/id="polls"/);assert.match(html,/Publish Poll/);
});
