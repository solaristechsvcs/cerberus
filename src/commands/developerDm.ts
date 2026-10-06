import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ChatInputCommandInteraction, EmbedBuilder, Message, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { config } from "../config";
import { DeveloperDmSettings } from "../database/models/DeveloperDmSettings";
import { DeveloperDmThread } from "../database/models/DeveloperDmThread";

export const developerDmCommands=[
 new SlashCommandBuilder().setName("dmrelay").setDescription("Configure the Cerberus developer DM relay.").setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString()).addSubcommand(s=>s.setName("setup").setDescription("Use this server/category for user DM conversations.").addChannelOption(o=>o.setName("category").setDescription("Developer DM relay category").addChannelTypes(ChannelType.GuildCategory).setRequired(true))),
 new SlashCommandBuilder().setName("dr").setDescription("Reply to the user associated with this developer DM channel.").addStringOption(o=>o.setName("message").setDescription("Message to send to the user").setRequired(true).setMaxLength(2000))
];

function globalAdmin(id:string){return (config.dashboard.globalAdmins??[]).includes(id)}
export async function saveDeveloperDmSettings(guildId:string,categoryId:string){const [s]=await DeveloperDmSettings.findOrCreate({where:{id:1}});s.guildId=guildId;s.categoryId=categoryId;await s.save();return s;}

export async function handleDeveloperDm(message:Message):Promise<void>{
 if(message.author.bot||message.guild)return;
 const settings=await DeveloperDmSettings.findByPk(1);if(!settings?.guildId||!settings.categoryId){await message.author.send("Developer support is not currently configured.").catch(()=>null);return;}
 const guild=message.client.guilds.cache.get(settings.guildId);if(!guild)return;
 const category=await guild.channels.fetch(settings.categoryId).catch(()=>null);if(!category||category.type!==ChannelType.GuildCategory)return;
 let thread=await DeveloperDmThread.findOne({where:{userId:message.author.id}});
 let channel:any=thread?await guild.channels.fetch(thread.channelId).catch(()=>null):null;
 if(!channel){
  const safe=message.author.username.toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,45)||"user";
  channel=await guild.channels.create({name:("dm-"+safe+"-"+message.author.id).slice(0,100),type:ChannelType.GuildText,parent:category.id,topic:"Cerberus developer DM relay for "+message.author.tag+" ("+message.author.id+")",permissionOverwrites:[
   {id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
   {id:guild.members.me!.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},
   ...(config.dashboard.globalAdmins??[]).map(id=>({id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}))
  ]});
  if(thread){thread.channelId=channel.id;thread.guildId=guild.id;await thread.save();}else thread=await DeveloperDmThread.create({userId:message.author.id,channelId:channel.id,guildId:guild.id});
  await channel.send({
   embeds:[new EmbedBuilder()
    .setTitle("Developer DM Conversation")
    .setDescription("**User:** <@"+message.author.id+">\\n**Username:** "+message.author.tag+"\\n**User ID:** "+message.author.id+"\\n\\nUse **/dr** in this channel to reply. Normal messages in this channel are not sent to the user.")
    .setColor(0x8f315c)
    .setThumbnail(message.author.displayAvatarURL())
    .setTimestamp()],
   components:[new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("developer-dm:close").setLabel("Close Conversation").setEmoji("🔒").setStyle(ButtonStyle.Danger)
   )]
  });
 }
 const attachments=[...message.attachments.values()].map(a=>a.url);
 const body=message.content||"*No text content*";
 await channel.send({embeds:[new EmbedBuilder().setAuthor({name:message.author.tag,iconURL:message.author.displayAvatarURL()}).setDescription(body.slice(0,4096)).setColor(0x5865f2).setFooter({text:"Incoming DM • "+message.author.id}).setTimestamp(message.createdAt)],content:attachments.length?"Attachments:\n"+attachments.join("\n"):undefined});
 await message.react("✅").catch(()=>null);
}

export async function handleDeveloperDmCommand(i:ChatInputCommandInteraction):Promise<void>{
 if(!globalAdmin(i.user.id))return void await i.reply({content:"This command is restricted to Cerberus global administrators.",ephemeral:true});
 if(i.commandName==="dmrelay"){
  if(!i.guild)return void await i.reply({content:"Run this setup command in the server that will host developer DM channels.",ephemeral:true});
  const category=i.options.getChannel("category",true);await saveDeveloperDmSettings(i.guild.id,category.id);return void await i.reply({content:"Developer DM relay configured for **"+i.guild.name+"** under **"+category.name+"**.",ephemeral:true});
 }
 if(!i.guild)return void await i.reply({content:"Use /dr inside a configured developer DM relay channel.",ephemeral:true});
 const thread=await DeveloperDmThread.findOne({where:{channelId:i.channelId,guildId:i.guild.id}});if(!thread)return void await i.reply({content:"This is not a developer DM relay channel.",ephemeral:true});
 const text=i.options.getString("message",true).trim();const user=await i.client.users.fetch(thread.userId).catch(()=>null);if(!user)return void await i.reply({content:"The associated Discord user could not be found.",ephemeral:true});
 try{await user.send({embeds:[new EmbedBuilder().setTitle("Cerberus Developer Support").setDescription(text).setColor(0x8f315c).setFooter({text:"Reply to this DM to continue the conversation."}).setTimestamp()]});await i.reply({content:"Reply sent to <@"+thread.userId+">.",ephemeral:true});if(i.channel?.isTextBased()&&"send" in i.channel)await i.channel.send({embeds:[new EmbedBuilder().setAuthor({name:"Developer reply • "+i.user.tag,iconURL:i.user.displayAvatarURL()}).setDescription(text).setColor(0x8f315c).setTimestamp()]});}catch{await i.reply({content:"The user could not be DMed. They may have blocked the bot or disabled DMs.",ephemeral:true});}
}

export async function handleDeveloperDmButton(i:ButtonInteraction):Promise<void>{
 if(i.customId!=="developer-dm:close")return;
 if(!globalAdmin(i.user.id))return void await i.reply({content:"Only Cerberus global administrators can close developer DM conversations.",ephemeral:true});
 if(!i.guild)return void await i.reply({content:"This conversation cannot be closed here.",ephemeral:true});
 const thread=await DeveloperDmThread.findOne({where:{channelId:i.channelId,guildId:i.guild.id}});
 if(!thread)return void await i.reply({content:"This developer DM conversation is no longer active.",ephemeral:true});
 await i.reply({content:"Closing this developer DM conversation...",ephemeral:true});
 await thread.destroy();
 if(i.channel?.isTextBased()&&"delete" in i.channel)await i.channel.delete("Developer DM conversation closed");
}
