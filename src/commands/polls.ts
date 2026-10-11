import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ChatInputCommandInteraction, Client, EmbedBuilder, Guild, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { Op } from "sequelize";
import { sequelize } from "../database";
import { Poll, PollVote } from "../database/models/Poll";

export const pollCommands=[new SlashCommandBuilder().setName("poll").setDescription("Create and manage community polls").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
 .addSubcommand(s=>s.setName("create").setDescription("Publish a poll with 2 to 10 choices")
  .addChannelOption(o=>o.setName("channel").setDescription("Publish channel").addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement).setRequired(true))
  .addStringOption(o=>o.setName("question").setDescription("Poll question").setMaxLength(256).setRequired(true))
  .addStringOption(o=>o.setName("options").setDescription("Choices separated by | (example: Monday | Friday)").setMaxLength(810).setRequired(true))
  .addIntegerOption(o=>o.setName("hours").setDescription("Auto-close after this many hours; omit for manual close").setMinValue(1).setMaxValue(168)))
 .addSubcommand(s=>s.setName("close").setDescription("Close a poll").addIntegerOption(o=>o.setName("id").setDescription("Poll ID shown in the embed").setMinValue(1).setRequired(true)))
 .addSubcommand(s=>s.setName("results").setDescription("Show poll results").addIntegerOption(o=>o.setName("id").setDescription("Poll ID").setMinValue(1).setRequired(true)))];

const queues=new Map<number,Promise<unknown>>();
async function serialized<T>(id:number,work:()=>Promise<T>):Promise<T>{
 const previous=queues.get(id)||Promise.resolve();
 const next=previous.catch(()=>null).then(work);queues.set(id,next);
 try{return await next}finally{if(queues.get(id)===next)queues.delete(id)}
}
export function validatePoll(question:string,options:string[],hours:number){
 question=question.trim();options=options.map(value=>value.trim());
 if(!question||question.length>256)throw new Error("Enter a question between 1 and 256 characters.");
 if(options.length<2||options.length>10||options.some(value=>!value||value.length>80))throw new Error("Provide 2 to 10 choices, each between 1 and 80 characters.");
 if(new Set(options.map(value=>value.toLowerCase())).size!==options.length)throw new Error("Poll choices must be different.");
 if(!Number.isInteger(hours)||hours<0||hours>168)throw new Error("Duration must be 0 (manual close) or 1 to 168 hours.");
 return {question,options,hours};
}
export async function pollResults(poll:Poll){
 const votes=await PollVote.findAll({where:{pollId:poll.id},attributes:["optionIndex"]});
 const counts=poll.options.map(()=>0);for(const vote of votes)if(counts[vote.optionIndex]!==undefined)counts[vote.optionIndex]++;
 return {counts,total:counts.reduce((a,b)=>a+b,0)};
}
export function pollMessage(poll:Poll,counts:number[],total:number){
 const closed=poll.status==="CLOSED"||!!poll.endsAt&&poll.endsAt.getTime()<=Date.now();
 const embed=new EmbedBuilder().setTitle(poll.question).setColor(closed?0x747f8d:0x8f315c).setDescription(poll.options.map((option,index)=>{
  const count=counts[index]||0,percentage=total?Math.round(count/total*100):0;
  return "**"+(index+1)+". "+option+"** — "+count+" vote(s) ("+percentage+"%)";
 }).join("\n\n")).setFooter({text:"Poll #"+poll.id+" • "+total+" voter(s) • "+(closed?"Closed":"One choice per member; click your choice again to remove your vote")});
 if(poll.endsAt)embed.addFields({name:closed?"Scheduled end":"Closes",value:"<t:"+Math.floor(poll.endsAt.getTime()/1000)+":F>"});
 const components:ActionRowBuilder<ButtonBuilder>[]=[];
 for(let offset=0;offset<poll.options.length;offset+=5)components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...poll.options.slice(offset,offset+5).map((option,index)=>new ButtonBuilder().setCustomId("poll:vote:"+poll.id+":"+(offset+index)).setLabel(option).setStyle(ButtonStyle.Primary).setDisabled(closed))));
 components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("poll:close:"+poll.id).setLabel("Close Poll").setStyle(ButtonStyle.Danger).setDisabled(closed)));
 return {embeds:[embed],components,allowedMentions:{parse:[] as []}};
}
async function refreshPoll(guild:Guild,poll:Poll){
 if(!poll.messageId)return;
 const channel=await guild.channels.fetch(poll.channelId).catch(()=>null);
 if(!channel?.isTextBased()||!("messages" in channel))return;
 const message=await channel.messages.fetch(poll.messageId).catch(()=>null);if(!message)return;
 const result=await pollResults(poll);await message.edit(pollMessage(poll,result.counts,result.total));
}
export async function createPoll(guild:Guild,creatorId:string,channelId:string,question:string,options:string[],hours=0){
 const validated=validatePoll(question,options,hours);
 const channel=await guild.channels.fetch(channelId).catch(()=>null);
 if(!channel||(channel.type!==ChannelType.GuildText&&channel.type!==ChannelType.GuildAnnouncement))throw new Error("Select a text or announcement channel.");
 const me=await guild.members.fetchMe();
 if(!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks]))throw new Error("Cerberus needs View Channel, Send Messages and Embed Links in that channel.");
 const poll=await Poll.create({guildId:guild.id,channelId,creatorId,question:validated.question,options:validated.options,endsAt:hours?new Date(Date.now()+hours*3600000):null});
 let message;
 try{message=await channel.send(pollMessage(poll,poll.options.map(()=>0),0));await poll.update({messageId:message.id});return {poll,url:message.url}}
 catch(error){if(message)await message.delete().catch(()=>null);await poll.destroy();throw error}
}
export async function closePoll(guild:Guild,id:number,actorId:string|null,allowManage=false){
 return serialized(id,async()=>{
  const poll=await sequelize.transaction(async transaction=>{
   const row=await Poll.findOne({where:{id,guildId:guild.id},transaction,lock:transaction.LOCK.UPDATE});
   if(!row)throw new Error("Poll not found in this server.");
   if(actorId!==null&&actorId!==row.creatorId&&!allowManage)throw new Error("Only the poll creator or members with Manage Server can close it.");
   if(row.status!=="CLOSED")await row.update({status:"CLOSED",closedBy:actorId},{transaction});
   return row;
  });
  await refreshPoll(guild,poll);return poll;
 });
}
export async function recordPollVote(guild:Guild,id:number,userId:string,optionIndex:number,messageId:string){
 return serialized(id,async()=>{
  let expired=false;
  const result=await sequelize.transaction(async transaction=>{
   const poll=await Poll.findOne({where:{id,guildId:guild.id,messageId},transaction,lock:transaction.LOCK.UPDATE});
   if(!poll)throw new Error("This poll is no longer available.");
   if(poll.status==="CLOSED")throw new Error("This poll is closed.");
   if(poll.endsAt&&poll.endsAt.getTime()<=Date.now()){
    await poll.update({status:"CLOSED"},{transaction});expired=true;return {poll,removed:false};
   }
   if(!Number.isInteger(optionIndex)||optionIndex<0||optionIndex>=poll.options.length)throw new Error("Invalid poll choice.");
   const existing=await PollVote.findOne({where:{pollId:id,userId},transaction});
   const removed=existing?.optionIndex===optionIndex;
   if(removed)await existing!.destroy({transaction});
   else if(existing)await existing.update({optionIndex},{transaction});
   else await PollVote.create({pollId:id,userId,optionIndex},{transaction});
   return {poll,removed};
  });
  try{await refreshPoll(guild,result.poll)}catch(error){console.error("Poll message refresh failed:",error)}
  if(expired)throw new Error("This poll has ended.");
  return result.removed?"Your vote was removed.":"Your vote was saved for "+result.poll.options[optionIndex]+".";
 });
}
export async function handlePollButton(i:ButtonInteraction):Promise<void>{
 if(!i.guild)return void await i.reply({content:"Polls are available in servers.",ephemeral:true});
 await i.deferReply({ephemeral:true});
 try{
  const [,action,rawId,rawOption]=i.customId.split(":");const id=Number(rawId);
  if(!Number.isSafeInteger(id)||id<1)throw new Error("Invalid poll ID.");
  if(action==="vote"){if(i.user.bot)throw new Error("Bots cannot vote.");await i.editReply(await recordPollVote(i.guild,id,i.user.id,Number(rawOption),i.message.id));return}
  if(action!=="close")throw new Error("Invalid poll action.");
  const member=await i.guild.members.fetch(i.user.id);
  await closePoll(i.guild,id,i.user.id,member.permissions.has(PermissionFlagsBits.ManageGuild));await i.editReply("Poll closed. Final results are shown in the poll message.");
 }catch(error){await i.editReply(error instanceof Error?error.message:"Poll action failed.")}
}
export async function handlePollCommand(i:ChatInputCommandInteraction):Promise<void>{
 if(!i.guild)return void await i.reply({content:"Use poll commands in a server.",ephemeral:true});
 await i.deferReply({ephemeral:true});
 try{
  const member=await i.guild.members.fetch(i.user.id),manage=member.permissions.has(PermissionFlagsBits.ManageGuild);
  const sub=i.options.getSubcommand();
  if(sub==="create"){
   if(!manage)throw new Error("Manage Server is required to create polls.");
   const result=await createPoll(i.guild,i.user.id,i.options.getChannel("channel",true).id,i.options.getString("question",true),i.options.getString("options",true).split("|"),i.options.getInteger("hours")||0);
   await i.editReply("Poll published: "+result.url);return;
  }
  const id=i.options.getInteger("id",true);
  if(sub==="close"){await closePoll(i.guild,id,i.user.id,manage);await i.editReply("Poll closed.");return}
  const poll=await Poll.findOne({where:{id,guildId:i.guild.id}});if(!poll)throw new Error("Poll not found.");
  const result=await pollResults(poll);await i.editReply({embeds:pollMessage(poll,result.counts,result.total).embeds}); 
 }catch(error){await i.editReply(error instanceof Error?error.message:"Poll command failed.")}
}
export async function expirePolls(client:Client){
 const polls=await Poll.findAll({where:{status:"OPEN",endsAt:{[Op.lte]:new Date()}}});
 for(const poll of polls){const guild=client.guilds.cache.get(poll.guildId);if(guild)try{await closePoll(guild,poll.id,null)}catch(error){console.error("Poll expiry failed:",error)}}
}
export function startPollExpiry(client:Client){
 let running=false;
 const tick=async()=>{if(running)return;running=true;try{await expirePolls(client)}catch(error){console.error("Poll expiry scan failed:",error)}finally{running=false}};
 void tick();const timer=setInterval(()=>void tick(),30000);timer.unref();return timer;
}
