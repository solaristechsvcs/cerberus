import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { VerificationSettings } from "../database/models/VerificationSettings";
import { VerificationPanel } from "../database/models/VerificationPanel";

export const verificationCommands=[new SlashCommandBuilder().setName("verify").setDescription("Configure the server verification system.")
 .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
 .addSubcommand(s=>s.setName("setup").setDescription("Set the role members receive after verification.").addRoleOption(o=>o.setName("role").setDescription("Verified member role").setRequired(true)))
 .addSubcommand(s=>s.setName("panel").setDescription("Create and publish a verification panel.")
  .addChannelOption(o=>o.setName("channel").setDescription("Channel to publish the panel").addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addStringOption(o=>o.setName("title").setDescription("Panel title").setRequired(true).setMaxLength(256))
  .addStringOption(o=>o.setName("description").setDescription("Panel description").setRequired(true).setMaxLength(2000))
  .addStringOption(o=>o.setName("button").setDescription("Verification button label").setMaxLength(80)))
];

export async function publishVerificationPanel(guild:any,panel:VerificationPanel,channelId:string){
 const channel=await guild.channels.fetch(channelId);
 if(!channel?.isTextBased()||!("send" in channel))throw new Error("Panel channel is not text based.");
 const embed=new EmbedBuilder().setTitle(panel.title).setDescription(panel.description).setColor(0x8f315c);
 const icon=guild.iconURL({size:256});if(icon)embed.setThumbnail(icon);
 const msg=await channel.send({embeds:[embed],components:[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("verify:panel:"+panel.id).setLabel(panel.buttonLabel).setStyle(ButtonStyle.Success).setEmoji("✅"))]});
 panel.channelId=channel.id;panel.messageId=msg.id;await panel.save();return msg;
}

export async function handleVerificationButton(i:ButtonInteraction):Promise<void>{
 if(!i.guild)return;
 const panelId=Number(i.customId.split(":")[2]);
 const panel=await VerificationPanel.findOne({where:{id:panelId,guildId:i.guild.id}});
 if(!panel)return void await i.reply({content:"This verification panel no longer exists.",ephemeral:true});
 const settings=await VerificationSettings.findByPk(i.guild.id);
 if(!settings?.roleId)return void await i.reply({content:"Verification is not configured for this server.",ephemeral:true});
 const role=await i.guild.roles.fetch(settings.roleId).catch(()=>null);
 if(!role)return void await i.reply({content:"The configured verified role no longer exists. Please contact a server administrator.",ephemeral:true});
 const member=await i.guild.members.fetch(i.user.id).catch(()=>null);
 if(!member)return void await i.reply({content:"Could not load your server membership.",ephemeral:true});
 if(member.roles.cache.has(role.id))return void await i.reply({content:"You are already verified.",ephemeral:true});
 const me=i.guild.members.me;
 if(!me||!me.permissions.has(PermissionFlagsBits.ManageRoles)||role.position>=me.roles.highest.position)return void await i.reply({content:"Cerberus cannot assign the verified role. An administrator needs to place the Cerberus role above it and grant Manage Roles.",ephemeral:true});
 await member.roles.add(role,"Cerberus verification");
 await i.reply({content:"✅ You are now verified and have received the **"+role.name+"** role.",ephemeral:true});
}

export async function handleVerificationCommand(i:ChatInputCommandInteraction):Promise<void>{
 if(!i.guild)return void await i.reply({content:"Server only.",ephemeral:true});
 const sub=i.options.getSubcommand();
 if(sub==="setup"){
  const role=i.options.getRole("role",true);
  if(role.id===i.guild.roles.everyone.id)return void await i.reply({content:"The @everyone role cannot be used as the verified role.",ephemeral:true});
  const me=i.guild.members.me;
  if(!me||!me.permissions.has(PermissionFlagsBits.ManageRoles)||role.position>=me.roles.highest.position)return void await i.reply({content:"Cerberus needs Manage Roles and its bot role must be above **"+role.name+"**.",ephemeral:true});
  const [settings]=await VerificationSettings.findOrCreate({where:{guildId:i.guild.id}});settings.roleId=role.id;await settings.save();
  return void await i.reply({content:"Verification configured. Members will receive **"+role.name+"** when they verify.",ephemeral:true});
 }
 const channel=i.options.getChannel("channel",true);
 const settings=await VerificationSettings.findByPk(i.guild.id);
 if(!settings?.roleId)return void await i.reply({content:"Run /verify setup before creating a verification panel.",ephemeral:true});
 const title=i.options.getString("title",true),description=i.options.getString("description",true),buttonLabel=i.options.getString("button")||"Verify";
 const panel=await VerificationPanel.create({guildId:i.guild.id,name:title.slice(0,100),title,description,buttonLabel});
 try{await publishVerificationPanel(i.guild,panel,channel.id);}catch(error){await panel.destroy();throw error;}
 await i.reply({content:"Verification panel published in <#"+channel.id+">.",ephemeral:true});
}
