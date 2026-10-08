import crypto from "node:crypto";
import { config } from "../config";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { TicketSettings } from "../database/models/TicketSettings";
import { TicketPanel } from "../database/models/TicketPanel";
import { Ticket } from "../database/models/Ticket";
import { TicketTranscript } from "../database/models/TicketTranscript";

export const ticketCommands=[new SlashCommandBuilder().setName("ticket").setDescription("Configure and manage tickets.")
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
 .addSubcommand(s=>s.setName("setup").setDescription("Configure ticket category, log channel and staff role.")
  .addChannelOption(o=>o.setName("category").setDescription("Category for new tickets").addChannelTypes(ChannelType.GuildCategory).setRequired(true))
  .addChannelOption(o=>o.setName("logs").setDescription("Ticket logging channel").addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addRoleOption(o=>o.setName("staff").setDescription("Role that can access tickets").setRequired(true)))
 .addSubcommand(s=>s.setName("panel").setDescription("Create and publish a ticket panel.")
  .addChannelOption(o=>o.setName("channel").setDescription("Channel to publish the panel").addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addStringOption(o=>o.setName("title").setDescription("Panel title").setRequired(true).setMaxLength(256))
  .addStringOption(o=>o.setName("description").setDescription("Panel description").setRequired(true).setMaxLength(2000))
  .addStringOption(o=>o.setName("button").setDescription("Button label").setMaxLength(80)))
 .addSubcommand(s=>s.setName("close").setDescription("Close the current ticket."))
 .addSubcommand(s=>s.setName("add").setDescription("Add a member to the current ticket.").addUserOption(o=>o.setName("user").setDescription("Member").setRequired(true)))
 .addSubcommand(s=>s.setName("remove").setDescription("Remove a member from the current ticket.").addUserOption(o=>o.setName("user").setDescription("Member").setRequired(true)))
];

async function ticketLog(guild:any,title:string,description:string){
 const settings=await TicketSettings.findByPk(guild.id); if(!settings?.logChannelId)return;
 const ch=await guild.channels.fetch(settings.logChannelId).catch(()=>null); if(ch?.isTextBased()&&"send" in ch)await ch.send({embeds:[new EmbedBuilder().setTitle(title).setDescription(description).setColor(0x8f315c).setTimestamp()]});
}
export async function publishTicketPanel(guild:any,panel:TicketPanel,channelId:string){
 const channel=await guild.channels.fetch(channelId);
 if(!channel?.isTextBased()||!("send" in channel))throw new Error("Panel channel is not text based.");
 const embed=new EmbedBuilder().setTitle(panel.title).setDescription(panel.description).setColor(0x8f315c);
 const guildIcon=guild.iconURL({size:256});
 if(guildIcon)embed.setThumbnail(guildIcon);
 const msg=await channel.send({embeds:[embed],components:[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("ticket:open:"+panel.id).setLabel(panel.buttonLabel).setStyle(ButtonStyle.Primary).setEmoji("🎫"))]});
 panel.channelId=channel.id;
 panel.messageId=msg.id;
 await panel.save();
 return msg;
}
export async function openTicket(i:ButtonInteraction):Promise<void>{
 if(!i.guild)return; const panelId=Number(i.customId.split(":")[2]); const panel=await TicketPanel.findOne({where:{id:panelId,guildId:i.guild.id}}); if(!panel)return void await i.reply({content:"This ticket panel no longer exists.",ephemeral:true});
 const settings=await TicketSettings.findByPk(i.guild.id);if(!settings?.categoryId||!settings.staffRoleId)return void await i.reply({content:"The ticket system is not fully configured.",ephemeral:true});
 const existing=await Ticket.findOne({where:{guildId:i.guild.id,userId:i.user.id,status:"OPEN"}});if(existing){const ch=i.guild.channels.cache.get(existing.channelId);if(ch)return void await i.reply({content:"You already have an open ticket: <#"+existing.channelId+">",ephemeral:true});await existing.update({status:"CLOSED"});}
 await i.deferReply({ephemeral:true});
 const channel=await i.guild.channels.create({name:"ticket-"+i.user.username.toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,80),type:ChannelType.GuildText,parent:settings.categoryId,permissionOverwrites:[
  {id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
  {id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles]},
  {id:settings.staffRoleId,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageMessages]},
  {id:i.client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ReadMessageHistory]}
 ]});
 const ticket=await Ticket.create({guildId:i.guild.id,channelId:channel.id,userId:i.user.id,panelId:panel.id,status:"OPEN"});
 await channel.send({content:"<@"+i.user.id+"> <@&"+settings.staffRoleId+">",embeds:[new EmbedBuilder().setTitle("Ticket #"+ticket.id).setDescription("Thanks for contacting the team. Describe what you need help with and a staff member will respond.").setColor(0x8f315c)],components:[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("ticket:close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger))]});
 await ticketLog(i.guild,"Ticket Opened","**Ticket:** <#"+channel.id+">\n**User:** <@"+i.user.id+">\n**Panel:** "+panel.name);
 await i.editReply("Your ticket has been created: <#"+channel.id+">");
}
function escapeHtml(value:string):string{
 return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function linkifyHtml(value:string):string{
 return escapeHtml(value).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g,"<br>");
}
async function createTicketTranscript(channel:any):Promise<string>{
 const messages:any[]=[];let before:string|undefined;
 while(true){
  const batch=await channel.messages.fetch({limit:100,before}).catch(()=>null);
  if(!batch||batch.size===0)break;
  messages.push(...batch.values());
  if(batch.size<100)break;
  before=batch.last()?.id;
  if(!before)break;
 }
 messages.sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
 const guildIcon=channel.guild.iconURL({size:128})||"";
 const rendered=messages.map(message=>{
  const author=message.author;
  const name=escapeHtml(author?.globalName||author?.username||"Unknown User");
  const username=escapeHtml(author?.username||"unknown");
  const avatar=author?.displayAvatarURL({size:128})||"";
  const time=new Date(message.createdTimestamp).toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"});
  const content=message.content?.trim()?'<div class="content">'+linkifyHtml(message.content)+'</div>':"";
  const attachments=[...message.attachments.values()].map((a:any)=>{
   const url=escapeHtml(a.url),label=escapeHtml(a.name||"Attachment");
   const image=a.contentType?.startsWith("image/")?'<a href="'+url+'" target="_blank"><img class="attachment-image" src="'+url+'" alt="'+label+'"></a>':"";
   return '<div class="attachment">'+image+'<a href="'+url+'" target="_blank" rel="noopener noreferrer">📎 '+label+'</a></div>';
  }).join("");
  const embeds=message.embeds.map((embed:any)=>{
   const title=embed.title?'<div class="embed-title">'+escapeHtml(embed.title)+'</div>':"";
   const description=embed.description?'<div>'+linkifyHtml(embed.description)+'</div>':"";
   const fields=(embed.fields||[]).map((f:any)=>'<div class="embed-field"><strong>'+escapeHtml(f.name)+'</strong><div>'+linkifyHtml(f.value)+'</div></div>').join("");
   return '<div class="discord-embed">'+title+description+fields+'</div>';
  }).join("");
  return '<article class="message"><img class="avatar" src="'+escapeHtml(avatar)+'" alt=""><div class="message-body"><div class="message-head"><strong>'+name+'</strong><span class="username">@'+username+'</span><time>'+escapeHtml(time)+'</time></div>'+content+attachments+embeds+'</div></article>';
 }).join("");
 const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ticket Transcript #'+escapeHtml(channel.name)+'</title><style>'+
 '*{box-sizing:border-box}body{margin:0;background:#1e1f22;color:#dbdee1;font-family:gg sans,Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}.top{background:#111214;border-bottom:1px solid #3f4147;padding:24px}.top-inner{max-width:1000px;margin:auto;display:flex;align-items:center;gap:16px}.server-icon{width:58px;height:58px;border-radius:18px;object-fit:cover;background:#2b2d31}.top h1{font-size:20px;margin:0 0 5px;color:#f2f3f5}.meta{color:#949ba4;font-size:13px}.messages{max-width:1000px;margin:auto;padding:22px 0 60px}.message{display:flex;gap:16px;padding:10px 22px}.message:hover{background:#2e3035}.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#313338;flex:0 0 40px}.message-body{min-width:0;flex:1}.message-head{display:flex;align-items:baseline;gap:7px}.message-head strong{color:#f2f3f5}.username,time{color:#949ba4;font-size:12px}.content{margin-top:3px;line-height:1.42;overflow-wrap:anywhere}.content a,.attachment a{color:#00a8fc;text-decoration:none}.attachment{margin-top:8px}.attachment-image{display:block;max-width:min(520px,100%);max-height:420px;border-radius:8px;margin-bottom:6px}.discord-embed{border-left:4px solid #8f315c;background:#2b2d31;border-radius:4px;margin-top:8px;padding:12px;max-width:520px}.embed-title{font-weight:700;color:#f2f3f5;margin-bottom:6px}.embed-field{margin-top:8px}.empty{text-align:center;color:#949ba4;padding:50px}</style></head><body>'+
 '<header class="top"><div class="top-inner">'+(guildIcon?'<img class="server-icon" src="'+escapeHtml(guildIcon)+'" alt="">':'<div class="server-icon"></div>')+'<div><h1>#'+escapeHtml(channel.name)+'</h1><div class="meta">'+escapeHtml(channel.guild.name)+' • '+messages.length+' messages • Generated '+escapeHtml(new Date().toLocaleString("en-US"))+'</div></div></div></header>'+
 '<main class="messages">'+(rendered||'<div class="empty">No messages were found in this ticket.</div>')+'</main></body></html>';
 return html;
}

async function sendTicketTranscript(guild:any,ticket:Ticket,channel:any,closedBy:string):Promise<void>{
 const html=await createTicketTranscript(channel);
 const existing=await TicketTranscript.findOne({where:{ticketId:ticket.id}});
 const accessToken=existing?.accessToken||crypto.randomBytes(32).toString("hex");
 await TicketTranscript.upsert({ticketId:ticket.id,guildId:guild.id,userId:ticket.userId,closedBy,channelName:channel.name,accessToken,html});
 const baseUrl=config.dashboard.publicUrl.replace(/\/$/,"");
 const transcriptUrl=baseUrl+"/transcripts/"+accessToken;
 const user=await guild.client.users.fetch(ticket.userId).catch(()=>null);
 if(user){
  await user.send({embeds:[new EmbedBuilder().setTitle("Your Ticket Transcript").setDescription("Your ticket in **"+guild.name+"** has been closed.\n\n[View your transcript]("+transcriptUrl+")").setColor(0x8f315c).setTimestamp()]}).catch((error:unknown)=>console.warn("Could not DM ticket transcript to "+ticket.userId+":",error));
 }
 const settings=await TicketSettings.findByPk(guild.id);
 if(!settings?.logChannelId)return;
 const logChannel=await guild.channels.fetch(settings.logChannelId).catch(()=>null);
 if(!logChannel?.isTextBased()||!("send" in logChannel))return;
 const transcript=Buffer.from(html,"utf8");
 await logChannel.send({
  embeds:[new EmbedBuilder().setTitle("Ticket Closed").setDescription("**Ticket:** #"+ticket.id+"\n**User:** <@"+ticket.userId+">\n**Closed by:** <@"+closedBy+">\n**Transcript:** [View on website]("+transcriptUrl+")").setColor(0x8f315c).setTimestamp()],
  files:[{attachment:transcript,name:"ticket-"+ticket.id+"-transcript.html"}]
 });
}

export async function closeTicket(guild:any,channelId:string,closedBy:string):Promise<boolean>{
 const ticket=await Ticket.findOne({where:{guildId:guild.id,channelId,status:"OPEN"}});if(!ticket)return false;
 const channel=await guild.channels.fetch(channelId).catch(()=>null);
 if(channel?.isTextBased()&&"messages" in channel){
  try{await sendTicketTranscript(guild,ticket,channel,closedBy);}catch(error){console.error("Ticket transcript failed:",error);}
 }else{
  await ticketLog(guild,"Ticket Closed","**Ticket:** #"+ticket.id+"\n**User:** <@"+ticket.userId+">\n**Closed by:** <@"+closedBy+">");
 }
 ticket.status="CLOSED";ticket.closedBy=closedBy;await ticket.save();
 if(channel)await channel.delete("Ticket closed by "+closedBy).catch(()=>null);
 return true;
}
export async function handleTicketButton(i:ButtonInteraction):Promise<void>{if(i.customId.startsWith("ticket:open:"))return openTicket(i);if(i.customId==="ticket:close"){if(!i.guild)return;await i.deferReply({ephemeral:true});const ok=await closeTicket(i.guild,i.channelId,i.user.id);if(!ok)await i.editReply("This is not an open ticket.");}}
export async function handleTicketCommand(i:ChatInputCommandInteraction):Promise<void>{
 if(!i.guild)return void await i.reply({content:"Server only.",ephemeral:true});const sub=i.options.getSubcommand();
 if(sub==="setup"){const category=i.options.getChannel("category",true),logs=i.options.getChannel("logs",true),staff=i.options.getRole("staff",true);const [s]=await TicketSettings.findOrCreate({where:{guildId:i.guild.id}});s.categoryId=category.id;s.logChannelId=logs.id;s.staffRoleId=staff.id;await s.save();return void await i.reply({content:"Ticket system configured.",ephemeral:true});}
 if(sub==="panel"){const ch=i.options.getChannel("channel",true);const panel=await TicketPanel.create({guildId:i.guild.id,name:i.options.getString("title",true).slice(0,100),title:i.options.getString("title",true),description:i.options.getString("description",true),buttonLabel:i.options.getString("button")||"Open Ticket"});await publishTicketPanel(i.guild,panel,ch.id);return void await i.reply({content:"Ticket panel published in <#"+ch.id+">.",ephemeral:true});}
 const ticket=await Ticket.findOne({where:{guildId:i.guild.id,channelId:i.channelId,status:"OPEN"}});if(!ticket)return void await i.reply({content:"This command must be used in an open ticket.",ephemeral:true});
 if(sub==="close"){await i.reply({content:"Closing ticket...",ephemeral:true});await closeTicket(i.guild,i.channelId,i.user.id);return;}
 const target=i.options.getUser("user",true);const channel=i.channel;if(!channel||!("permissionOverwrites" in channel))return void await i.reply({content:"Unavailable here.",ephemeral:true});
 if(sub==="add"){await channel.permissionOverwrites.edit(target.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});return void await i.reply({content:"Added <@"+target.id+">.",ephemeral:true});}
 if(sub==="remove"){await channel.permissionOverwrites.delete(target.id).catch(()=>null);return void await i.reply({content:"Removed <@"+target.id+">.",ephemeral:true});}
}
