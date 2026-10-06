import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { TicketSettings } from "../database/models/TicketSettings";
import { TicketPanel } from "../database/models/TicketPanel";
import { Ticket } from "../database/models/Ticket";

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
 const channel=await guild.channels.fetch(channelId); if(!channel?.isTextBased()||!("send" in channel))throw new Error("Panel channel is not text based.");
 const embed=new EmbedBuilder().setTitle(panel.title).setDescription(panel.description).setColor(0x8f315c); const guildIcon=guild.iconURL({size:256}); if(guildIcon)embed.setThumbnail(guildIcon);\n const msg=await channel.send({embeds:[embed],components:[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("ticket:open:"+panel.id).setLabel(panel.buttonLabel).setStyle(ButtonStyle.Primary).setEmoji("🎫"))]});
 panel.channelId=channel.id;panel.messageId=msg.id;await panel.save();return msg;
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
export async function closeTicket(guild:any,channelId:string,closedBy:string):Promise<boolean>{
 const ticket=await Ticket.findOne({where:{guildId:guild.id,channelId,status:"OPEN"}});if(!ticket)return false;
 ticket.status="CLOSED";ticket.closedBy=closedBy;await ticket.save();await ticketLog(guild,"Ticket Closed","**Ticket:** #"+ticket.id+"\n**User:** <@"+ticket.userId+">\n**Closed by:** <@"+closedBy+">");
 const channel=await guild.channels.fetch(channelId).catch(()=>null);if(channel){await channel.delete("Ticket closed by "+closedBy).catch(()=>null);}return true;
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
