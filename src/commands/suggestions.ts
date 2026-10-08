import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, EmbedBuilder, Guild, ModalBuilder, ModalSubmitInteraction, OverwriteType, PermissionFlagsBits, TextInputBuilder, TextInputStyle } from "discord.js";
import { SuggestionSettings } from "../database/models/SuggestionSettings";
import { SuggestionPanel } from "../database/models/SuggestionPanel";
import { Suggestion } from "../database/models/Suggestion";

type Configuration={channelId:string;categoryId:string;logChannelId:string;staffRoleIds:string[]};
const busy=new Set<string>();
const errorText=(error:unknown)=>error instanceof Error?error.message:"The suggestion action failed.";

export async function validateSuggestionSettings(guild:Guild,input:Configuration){
 const channel=await guild.channels.fetch(input.channelId).catch(()=>null);
 const category=await guild.channels.fetch(input.categoryId).catch(()=>null);
 const logs=await guild.channels.fetch(input.logChannelId).catch(()=>null);
 if(!channel||(channel.type!==ChannelType.GuildText&&channel.type!==ChannelType.GuildAnnouncement))throw new Error("Select a text or announcement channel for the suggestion panel.");
 if(!category||category.type!==ChannelType.GuildCategory)throw new Error("Select a category for private suggestion discussions.");
 if(!logs||logs.type!==ChannelType.GuildText)throw new Error("Select a text channel for suggestion close logs.");
 const staffRoleIds=[...new Set(input.staffRoleIds)];
 if(!staffRoleIds.length||staffRoleIds.length>20)throw new Error("Select 1 to 20 staff roles.");
 for(const id of staffRoleIds){
  const role=await guild.roles.fetch(id).catch(()=>null);
  if(!role||role.id===guild.roles.everyone.id)throw new Error("Select valid staff roles; @everyone cannot access private suggestions.");
 }
 const me=await guild.members.fetchMe();
 for(const target of [channel,logs]){
  if(!target.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks]))throw new Error("Cerberus needs View Channel, Send Messages and Embed Links in the panel and log channels.");
 }
 if(!category.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ManageChannels]))throw new Error("Cerberus needs View Channel and Manage Channels in the suggestion category.");
 return {channelId:channel.id,categoryId:category.id,logChannelId:logs.id,staffRoleIds};
}
export async function publishSuggestionPanel(guild:Guild,title:string,description:string,buttonLabel:string){
 const settings=await SuggestionSettings.findByPk(guild.id);
 if(!settings?.channelId||!settings.categoryId||!settings.logChannelId)throw new Error("Save the suggestion configuration before publishing a panel.");
 await validateSuggestionSettings(guild,{channelId:settings.channelId,categoryId:settings.categoryId,logChannelId:settings.logChannelId,staffRoleIds:settings.staffRoleIds});
 title=title.trim();description=description.trim();buttonLabel=buttonLabel.trim()||"Submit Suggestion";
 if(!title||title.length>256||!description||description.length>4000||buttonLabel.length>80)throw new Error("Enter a title (up to 256 characters), description (up to 4000) and button label (up to 80).");
 const channel=await guild.channels.fetch(settings.channelId);
 if(!channel?.isTextBased()||!("send" in channel))throw new Error("The panel channel is unavailable.");
 const panel=await SuggestionPanel.create({guildId:guild.id,title,description,buttonLabel});
 let message;
 try{
  message=await channel.send({embeds:[new EmbedBuilder().setTitle(title).setDescription(description).setColor(0x8f315c)],components:[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("suggestion:open:"+panel.id).setLabel(buttonLabel).setStyle(ButtonStyle.Primary))],allowedMentions:{parse:[]}});
  await panel.update({channelId:channel.id,messageId:message.id});
  return {panel,url:message.url};
 }catch(error){if(message)await message.delete().catch(()=>null);await panel.destroy();throw error}
}
export async function deleteSuggestionPanel(guild:Guild,id:number){
 const panel=await SuggestionPanel.findOne({where:{id,guildId:guild.id}});
 if(!panel)throw new Error("Suggestion panel not found.");
 if(panel.channelId&&panel.messageId){
  const channel=await guild.channels.fetch(panel.channelId).catch(()=>null);
  if(channel?.isTextBased()&&"messages" in channel){
   const message=await channel.messages.fetch(panel.messageId).catch(()=>null);
   if(message)await message.delete();
  }
 }
 await panel.destroy();
}
async function canClose(guild:Guild,userId:string,suggestion:Suggestion){
 const member=await guild.members.fetch(userId);
 return member.permissions.has(PermissionFlagsBits.ManageGuild)||suggestion.staffRoleIds.some(id=>member.roles.cache.has(id));
}
function reasonModal(id:number,outcome:"IMPLEMENTED"|"NOT_IMPLEMENTED"){
 const reason=new TextInputBuilder().setCustomId("reason").setLabel("Reason for closing").setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(1000);
 return new ModalBuilder().setCustomId("suggestion:resolve:"+id+":"+outcome).setTitle(outcome==="IMPLEMENTED"?"Close as implemented":"Close as not implemented").addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reason));
}
export async function handleSuggestionButton(i:ButtonInteraction):Promise<void>{
 const guild=i.guild;if(!guild)return void await i.reply({content:"Suggestions are available in a server.",ephemeral:true});
 const [,action,rawId,outcome]=i.customId.split(":");const id=Number(rawId);
 if(!Number.isSafeInteger(id)||id<1)return void await i.reply({content:"This suggestion control is invalid.",ephemeral:true});
 if(action==="open"){
  const panel=await SuggestionPanel.findOne({where:{id,guildId:guild.id,messageId:i.message.id}});
  if(!panel)return void await i.reply({content:"This suggestion panel is no longer available.",ephemeral:true});
  const title=new TextInputBuilder().setCustomId("title").setLabel("Suggestion title").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
  const content=new TextInputBuilder().setCustomId("content").setLabel("Your suggestion").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000);
  await i.showModal(new ModalBuilder().setCustomId("suggestion:submit:"+id).setTitle("Submit a suggestion").addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(title),new ActionRowBuilder<TextInputBuilder>().addComponents(content)));return;
 }
 const channelId=i.channelId;
 const suggestion=await Suggestion.findOne({where:{id,guildId:guild.id,channelId}});
 if(!suggestion)return void await i.reply({content:"This suggestion was not found.",ephemeral:true});
 if(!await canClose(guild,i.user.id,suggestion))return void await i.reply({content:"Only configured suggestion staff or members with Manage Server can close suggestions.",ephemeral:true});
 if(suggestion.status==="CLOSED"){
  await i.deferReply({ephemeral:true});
  const channel=await guild.channels.fetch(suggestion.channelId).catch(()=>null);
  if(channel)await channel.delete("Suggestion already closed and logged");
  await i.editReply("This suggestion was already closed and logged. The discussion channel has been removed.");return;
 }
 if(action==="close"){
  await i.reply({content:"Was this suggestion implemented? Choose an outcome, then enter the close reason.",components:[new ActionRowBuilder<ButtonBuilder>().addComponents(
   new ButtonBuilder().setCustomId("suggestion:outcome:"+id+":IMPLEMENTED").setLabel("Implemented").setStyle(ButtonStyle.Success),
   new ButtonBuilder().setCustomId("suggestion:outcome:"+id+":NOT_IMPLEMENTED").setLabel("Not implemented").setStyle(ButtonStyle.Secondary))],ephemeral:true});return;
 }
 if(action==="outcome"&&(outcome==="IMPLEMENTED"||outcome==="NOT_IMPLEMENTED"))await i.showModal(reasonModal(id,outcome));
}
export async function handleSuggestionModal(i:ModalSubmitInteraction):Promise<void>{
 const guild=i.guild,channelId=i.channelId;
 if(!guild||!channelId)return void await i.reply({content:"This action is only available in a server channel.",ephemeral:true});
 const [,action,rawId,outcome]=i.customId.split(":");const id=Number(rawId);
 if(!Number.isSafeInteger(id)||id<1)return void await i.reply({content:"This suggestion control is invalid.",ephemeral:true});
 await i.deferReply({ephemeral:true});
 const key=action==="submit"?"submit:"+guild.id+":"+i.user.id:"close:"+guild.id+":"+id;
 if(busy.has(key))return void await i.editReply("Your suggestion action is already being processed.");
 busy.add(key);
 try{
  if(action==="submit"){
   const title=i.fields.getTextInputValue("title").trim(),content=i.fields.getTextInputValue("content").trim();
   if(!title||title.length>100||!content||content.length>4000)throw new Error("Enter a title and suggestion text within the displayed limits.");
   const panel=await SuggestionPanel.findOne({where:{id,guildId:guild.id,channelId}});
   if(!panel)throw new Error("This suggestion panel is no longer available.");
   const settings=await SuggestionSettings.findByPk(guild.id);
   if(!settings?.channelId||!settings.categoryId||!settings.logChannelId)throw new Error("The suggestion system is not configured.");
   const configuration=await validateSuggestionSettings(guild,{channelId:settings.channelId,categoryId:settings.categoryId,logChannelId:settings.logChannelId,staffRoleIds:settings.staffRoleIds});
   const me=await guild.members.fetchMe();
   const access=[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles];
   const safe=i.user.username.toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").slice(0,40)||"member";
   const channel=await guild.channels.create({name:"suggestion-"+safe+"-"+i.id.slice(-6),type:ChannelType.GuildText,parent:configuration.categoryId,topic:"Private suggestion by "+i.user.id+": "+title,permissionOverwrites:[
    {id:guild.roles.everyone.id,type:OverwriteType.Role,deny:[PermissionFlagsBits.ViewChannel]},
    {id:i.user.id,type:OverwriteType.Member,allow:access},
    {id:me.id,type:OverwriteType.Member,allow:[...access,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.EmbedLinks]},
    ...configuration.staffRoleIds.map(roleId=>({id:roleId,type:OverwriteType.Role,allow:access}))
   ]});
   let suggestion:Suggestion|undefined;
   try{
    suggestion=await Suggestion.create({guildId:guild.id,userId:i.user.id,channelId:channel.id,logChannelId:configuration.logChannelId,title,content,staffRoleIds:configuration.staffRoleIds});
    await channel.send({content:"<@"+i.user.id+">",allowedMentions:{users:[i.user.id],roles:[]},embeds:[new EmbedBuilder().setTitle("Suggestion #"+suggestion.id+" • "+title).setDescription(content).addFields({name:"Submitted by",value:"<@"+i.user.id+">"}).setColor(0x8f315c).setTimestamp()],components:[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("suggestion:close:"+suggestion.id).setLabel("Close Suggestion").setStyle(ButtonStyle.Danger))]});
   }catch(error){await channel.delete("Suggestion creation failed").catch(()=>null);if(suggestion)await suggestion.destroy();throw error}
   await i.editReply("Your suggestion has been submitted. Discuss it here: <#"+channel.id+">");return;
  }
  if(action!=="resolve"||(outcome!=="IMPLEMENTED"&&outcome!=="NOT_IMPLEMENTED"))throw new Error("Invalid suggestion close action.");
  const suggestion=await Suggestion.findOne({where:{id,guildId:guild.id,channelId}});
  if(!suggestion)throw new Error("This suggestion was not found.");
  if(!await canClose(guild,i.user.id,suggestion))throw new Error("Only suggestion staff or members with Manage Server can close suggestions.");
  if(suggestion.status==="CLOSED")throw new Error("This suggestion is already closed and logged.");
  const reason=i.fields.getTextInputValue("reason").trim();
  if(reason.length<3||reason.length>1000)throw new Error("Enter a close reason between 3 and 1000 characters.");
  const logs=await guild.channels.fetch(suggestion.logChannelId).catch(()=>null);
  if(!logs?.isTextBased()||!("send" in logs))throw new Error("The suggestion log channel is unavailable. Restore it before closing this suggestion.");
  const closedAt=new Date();
  const log=await logs.send({allowedMentions:{parse:[]},embeds:[new EmbedBuilder().setTitle("Suggestion #"+suggestion.id+" • "+(outcome==="IMPLEMENTED"?"Implemented":"Not implemented")).setDescription(suggestion.content).addFields(
   {name:"Suggestion",value:suggestion.title},{name:"Submitter",value:"<@"+suggestion.userId+">",inline:true},
   {name:"Closed by",value:"<@"+i.user.id+">",inline:true},{name:"Outcome",value:outcome==="IMPLEMENTED"?"Implemented":"Not implemented",inline:true},
   {name:"Close reason",value:reason}).setColor(outcome==="IMPLEMENTED"?0x57f287:0xed4245).setTimestamp(closedAt)]});
  await suggestion.update({status:"CLOSED",outcome,closeReason:reason,closedBy:i.user.id,closedAt,logMessageId:log.id});
  await i.editReply("Suggestion closed as "+(outcome==="IMPLEMENTED"?"implemented":"not implemented")+". The reason and outcome have been logged. Removing the discussion channel.");
  const channel=await guild.channels.fetch(channelId).catch(()=>null);
  if(channel)try{await channel.delete("Suggestion #"+id+" closed: "+reason.slice(0,350))}catch(error){console.error("Suggestion channel cleanup failed:",error);await i.followUp({content:"The close log was saved, but I could not delete the discussion channel. Restore Manage Channels and click Close Suggestion again to retry cleanup.",ephemeral:true})}
 }catch(error){console.error("Suggestion action failed:",error);await i.editReply(errorText(error))}
 finally{busy.delete(key)}
}
