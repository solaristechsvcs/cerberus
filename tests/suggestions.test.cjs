const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function harness() {
 const events=[], channels=new Map(), records=[], panels=[];
 let failDiscussion=false, staff=true, logAvailable=true;
 class Builder {
  constructor(){this.data={};this.components=[]}
  setCustomId(v){this.data.custom_id=v;return this} setLabel(v){this.data.label=v;return this}
  setStyle(v){this.data.style=v;return this} setTitle(v){this.data.title=v;return this}
  setDescription(v){this.data.description=v;return this} setColor(v){this.data.color=v;return this}
  setTimestamp(v){this.data.timestamp=v;return this} setRequired(){return this}
  setMinLength(){return this} setMaxLength(){return this}
  addFields(...v){this.data.fields=v;return this}
  addComponents(...v){this.components.push(...v);return this}
 }
 const discord={ActionRowBuilder:Builder,ButtonBuilder:Builder,EmbedBuilder:Builder,ModalBuilder:Builder,TextInputBuilder:Builder,
  ChannelType:{GuildText:0,GuildAnnouncement:5,GuildCategory:4},OverwriteType:{Role:0,Member:1},
  PermissionFlagsBits:{ViewChannel:1,SendMessages:2,ReadMessageHistory:4,AttachFiles:8,ManageChannels:16,EmbedLinks:32,ManageGuild:64},
  ButtonStyle:{Primary:1,Secondary:2,Success:3,Danger:4},TextInputStyle:{Short:1,Paragraph:2}};
 const settings={channelId:"panel",categoryId:"category",logChannelId:"logs",staffRoleIds:["staff"]};
 function record(data,list){const row={id:list.length+1,...data,status:data.status||"OPEN",async update(values){events.push("save");Object.assign(this,values);return this},async destroy(){list.splice(list.indexOf(this),1)}};list.push(row);return row}
 const SuggestionSettings={findByPk:async()=>settings};
 const SuggestionPanel={create:async values=>record(values,panels),findOne:async({where})=>panels.find(p=>Object.entries(where).every(([k,v])=>p[k]===v))||null};
 const Suggestion={create:async values=>record(values,records),findOne:async({where})=>records.find(p=>Object.entries(where).every(([k,v])=>p[k]===v))||null};
 function channel(id,type=0){const ch={id,type,isTextBased:()=>true,permissionsFor:()=>({has:()=>true}),async send(payload){
   events.push(id==="logs"?"log":"send");if(id.startsWith("discussion")&&failDiscussion)throw Error("send failed");
   ch.payload=payload;return {id:"message-"+id,url:"https://discord.com/channels/guild/"+id+"/message",async delete(){events.push("message-delete")}};
  },async delete(){events.push("delete");channels.delete(id)}};channels.set(id,ch);return ch}
 channel("panel");channel("category",4);channel("logs");
 const guild={id:"guild",roles:{everyone:{id:"everyone"},fetch:async id=>({id})},
  members:{fetchMe:async()=>({id:"bot"}),fetch:async()=>({permissions:{has:()=>false},roles:{cache:{has:()=>staff}}})},
  channels:{fetch:async id=>id==="logs"&&!logAvailable?null:channels.get(id)||null,create:async options=>{events.push("create");const ch=channel("discussion"+(records.length+1));ch.options=options;return ch}}};
 const source=fs.readFileSync(path.join(__dirname,"../src/commands/suggestions.ts"),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(compiled,{exports,require(name){
  if(name==="discord.js")return discord;
  if(name.endsWith("/SuggestionSettings"))return {SuggestionSettings};
  if(name.endsWith("/SuggestionPanel"))return {SuggestionPanel};
  if(name.endsWith("/Suggestion"))return {Suggestion};
  throw Error("Unexpected dependency "+name);
 },console:{error(){}},Set,Date,Number,Error});
 function interaction(customId,channelId="panel",fields={title:"Better events",content:"Add a weekly community event",reason:"Added to the event schedule"}){
  return {customId,channelId,guild,user:{id:"submitter",username:"Member"},id:"123456",message:{id:"message-panel"},fields:{getTextInputValue:key=>fields[key]},
   async reply(payload){this.replyPayload=payload},async deferReply(){this.deferred=true},async editReply(payload){this.result=payload},
   async followUp(payload){this.followUpPayload=payload},async showModal(modal){this.modal=modal}};
 }
 return {api:exports,guild,settings,channels,records,panels,events,interaction,setStaff(v){staff=v},setLogAvailable(v){logAvailable=v},failDiscussion(){failDiscussion=true}};
}
test("panel button opens a modal; submission creates a private channel with the configured staff",async()=>{
 const h=harness();await h.api.publishSuggestionPanel(h.guild,"Ideas","Share an idea","Submit");
 const button=h.interaction("suggestion:open:1");await h.api.handleSuggestionButton(button);
 assert.equal(button.modal.data.custom_id,"suggestion:submit:1");
 assert.equal(button.modal.components.length,2);
 const submit=h.interaction("suggestion:submit:1");await h.api.handleSuggestionModal(submit);
 assert.equal(h.records.length,1);assert.match(submit.result,/discussion1/);
 const ch=h.channels.get("discussion1"),overwrites=ch.options.permissionOverwrites;
 assert.equal(ch.options.parent,"category");
 assert.ok(overwrites.find(x=>x.id==="everyone").deny.length);
 assert.deepEqual(Array.from(overwrites.filter(x=>x.allow),x=>x.id).sort(),["bot","staff","submitter"]);
});
test("only staff can resolve; closing logs the reason and outcome before deletion",async()=>{
 const h=harness();await h.api.publishSuggestionPanel(h.guild,"Ideas","Share","Submit");
 await h.api.handleSuggestionModal(h.interaction("suggestion:submit:1"));
 h.setStaff(false);const denied=h.interaction("suggestion:close:1","discussion1");await h.api.handleSuggestionButton(denied);
 assert.match(denied.replyPayload.content,/Only configured/);
 const forged=h.interaction("suggestion:resolve:1:IMPLEMENTED","discussion1");await h.api.handleSuggestionModal(forged);
 assert.equal(h.records[0].status,"OPEN");assert.ok(h.channels.has("discussion1"));
 h.setStaff(true);h.events.length=0;
 await h.api.handleSuggestionModal(h.interaction("suggestion:resolve:1:IMPLEMENTED","discussion1"));
 assert.equal(h.records[0].status,"CLOSED");assert.equal(h.records[0].outcome,"IMPLEMENTED");
 assert.equal(h.records[0].closeReason,"Added to the event schedule");assert.equal(h.records[0].closedBy,"submitter");
 assert.deepEqual(h.events,["log","save","delete"]);assert.ok(!h.channels.has("discussion1"));
 const fields=h.channels.get("logs").payload.embeds[0].data.fields;
 assert.equal(fields.find(x=>x.name==="Outcome").value,"Implemented");
});
test("missing log channel keeps a suggestion open; not implemented is recorded after recovery",async()=>{
 const h=harness();await h.api.publishSuggestionPanel(h.guild,"Ideas","Share","Submit");
 await h.api.handleSuggestionModal(h.interaction("suggestion:submit:1"));h.setLogAvailable(false);
 const close=h.interaction("suggestion:resolve:1:NOT_IMPLEMENTED","discussion1");await h.api.handleSuggestionModal(close);
 assert.match(close.result,/log channel is unavailable/);assert.equal(h.records[0].status,"OPEN");assert.ok(h.channels.has("discussion1"));
 h.setLogAvailable(true);await h.api.handleSuggestionModal(h.interaction("suggestion:resolve:1:NOT_IMPLEMENTED","discussion1"));
 assert.equal(h.records[0].outcome,"NOT_IMPLEMENTED");
});
test("failed submission removes its incomplete channel and database record",async()=>{
 const h=harness();await h.api.publishSuggestionPanel(h.guild,"Ideas","Share","Submit");h.failDiscussion();
 const submit=h.interaction("suggestion:submit:1");await h.api.handleSuggestionModal(submit);
 assert.equal(h.records.length,0);assert.ok(!h.channels.has("discussion1"));assert.match(submit.result,/send failed/);
});
test("invalid panel and blank suggestion do not create channels",async()=>{
 const h=harness();await h.api.publishSuggestionPanel(h.guild,"Ideas","Share","Submit");
 await h.api.handleSuggestionModal(h.interaction("suggestion:submit:999"));
 await h.api.handleSuggestionModal(h.interaction("suggestion:submit:1","panel",{title:" ",content:" "}));
 assert.equal(h.records.length,0);assert.ok(!h.events.includes("create"));
});
