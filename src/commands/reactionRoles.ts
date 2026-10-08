import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, Guild, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ReactionRole } from "../database/models/ReactionRole";

const unicodeButtonEmoji = new RegExp("^(?:\\p{RGI_Emoji}|\\p{Extended_Pictographic}\\uFE0F?)$", "v");

const standardButtonEmoji: Record<string,string> = {
  "test_tube": "🧪",
  "video_game": "🎮",
  "bell": "🔔",
  "shopping_cart": "🛒",
  "tada": "🎉",
  "radioactive": "☢️",
  "radioactive_sign": "☢️",
  "warning": "⚠️",
  "white_check_mark": "✅",
  "x": "❌",
  "heart": "❤️",
  "star": "⭐",
  "fire": "🔥",
  "rocket": "🚀",
  "tools": "🛠️",
  "shield": "🛡️",
  "loudspeaker": "📢",
  "mega": "📣",
  "trophy": "🏆",
  "calendar": "📅",
  "speech_balloon": "💬",
  "books": "📚",
  "art": "🎨",
  "musical_note": "🎵",
  "headphones": "🎧",
  "computer": "💻",
  "robot": "🤖",
  "robot_face": "🤖",
  "thumbsup": "👍",
  "+1": "👍",
  "thumbsdown": "👎",
  "-1": "👎",
  "smile": "😄",
  "grinning": "😀",
  "laughing": "😆",
  "joy": "😂",
  "wave": "👋",
  "eyes": "👀",
  "check": "✔️",
  "ticket": "🎫",
  "tickets": "🎟️",
  "gear": "⚙️",
  "wrench": "🔧",
  "hammer": "🔨",
  "lock": "🔒",
  "unlock": "🔓",
  "key": "🔑",
  "link": "🔗",
  "globe_with_meridians": "🌐",
  "earth_americas": "🌎",
  "crossed_swords": "⚔️",
  "dagger": "🗡️",
  "moneybag": "💰",
  "gem": "💎",
  "gift": "🎁",
  "confetti_ball": "🎊",
  "sparkles": "✨",
  "zap": "⚡",
  "bulb": "💡",
  "beaker": "🧪"
};

function normalizeButtonEmoji(guild: Guild, input: string): string {
  const value=input.trim();
  if(!value)return "";
  const mention=/^<(a?):([A-Za-z0-9_]+):(\d{15,25})>$/.exec(value);
  if(mention)return value;
  if(/^\d{15,25}$/.test(value))return "<:emoji:"+value+">";
  if(unicodeButtonEmoji.test(value))return value;
  const name=/^:([A-Za-z0-9_]+):$/.exec(value)?.[1] ?? value;
  const shortcode=/^:([^:]+):$/.exec(value)?.[1];
  if(shortcode && Object.prototype.hasOwnProperty.call(standardButtonEmoji,shortcode))return standardButtonEmoji[shortcode];
  const custom=guild.emojis.cache.find(emoji=>emoji.name===name);
  if(custom)return "<"+(custom.animated?"a":"")+":"+custom.name+":"+custom.id+">";
  throw new Error("Invalid button emoji "+JSON.stringify(value)+". Paste one emoji such as 🎮, a custom emoji such as <:name:123456789012345678>, or leave it blank. Common standard shortcodes such as :test_tube: and this server's custom :name: emoji are supported. For other standard emoji, paste the actual symbol.");
}

async function validateCustomButtonEmoji(guild: Guild, value: string, externalAllowed: boolean): Promise<string> {
  const custom=/^<(a?):([A-Za-z0-9_]+):(\d{15,25})>$/.exec(value);
  if(!custom)return value;
  const id=custom[3];
  const cached=guild.client.emojis.cache.get(id);
  if(cached){
    const emoji=await cached.guild.emojis.fetch(id,{force:true}).catch(()=>null);
    if(!emoji||emoji.available===false)throw new Error("That custom emoji was deleted or is unavailable in its source server. Choose another emoji.");
    if(emoji.guild.id!==guild.id&&!externalAllowed)throw new Error('Enable "Use External Emojis" for Cerberus in the publish channel to use this emoji.');
    if(emoji.roles.cache.size){
      const member=await emoji.guild.members.fetchMe();
      if(!emoji.roles.cache.some(role=>member.roles.cache.has(role.id)))throw new Error("Cerberus does not have a role allowed to use that emoji in its source server.");
    }
    return "<"+(emoji.animated?"a":"")+":"+emoji.name+":"+emoji.id+">";
  }
  // Application-owned emoji can be used without a shared source guild.
  const applicationEmoji=await guild.client.application?.emojis.fetch(id).catch(()=>null);
  if(applicationEmoji)return "<"+(applicationEmoji.animated?"a":"")+":"+applicationEmoji.name+":"+applicationEmoji.id+">";
  throw new Error("Cerberus cannot access custom emoji "+id+". Add Cerberus to the server that owns it, upload a copy to this server, or use a standard emoji. Your personal Nitro emoji access does not grant the bot access.");
}

function componentEmoji(value: string) {
  const custom=/^<(a?):([A-Za-z0-9_]+):(\d{15,25})>$/.exec(value);
  return custom ? {id:custom[3],name:custom[2],animated:custom[1]==="a"} : {name:value};
}

function panelComponents(rows: ReactionRole[]) {
  const groups: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i=0;i<rows.length;i+=5) groups.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...rows.slice(i,i+5).map(r => {
    const b=new ButtonBuilder().setCustomId("reactionrole:"+r.id).setLabel((r.label||"Role").slice(0,80)).setStyle(ButtonStyle.Primary);
    if(r.emoji) b.setEmoji(componentEmoji(r.emoji));
    return b;
  })));
  return groups.slice(0,5);
}
async function updatePanel(guild: Guild,messageId:string){
  const rows=await ReactionRole.findAll({where:{guildId:guild.id,messageId},order:[["id","ASC"]]});if(!rows.length)return;
  const channel=await guild.channels.fetch(rows[0].channelId).catch(()=>null);if(!channel?.isTextBased()||!("messages" in channel))return;
  const message=await channel.messages.fetch(messageId).catch(()=>null);if(!message)return;
  await message.edit({embeds:[new EmbedBuilder().setTitle(rows[0].panelTitle||"Choose Your Roles").setDescription(rows[0].panelDescription||"Use the buttons below to add or remove roles.").setColor(0x8f315c)],components:panelComponents(rows)});
}
export async function publishReactionRolePanel(guild:Guild,channelId:string,title:string,description:string,buttons:{roleId:string,label:string,emoji?:string}[]){
  if(!buttons.length||buttons.length>25)throw new Error("A panel needs 1 to 25 role buttons.");
  buttons=buttons.map((button,index)=>{try{return {...button,emoji:normalizeButtonEmoji(guild,button.emoji||"")}}catch(e){throw new Error("Button "+(index+1)+": "+(e instanceof Error?e.message:String(e)))}});
  const channel=await guild.channels.fetch(channelId).catch(()=>null);if(!channel?.isTextBased()||!("send" in channel))throw new Error("Select a text channel.");
  const me=guild.members.me;if(!me)throw new Error("Cerberus member could not be resolved.");
  const externalAllowed=channel.permissionsFor(me)?.has(PermissionFlagsBits.UseExternalEmojis)??false;
  for(let index=0;index<buttons.length;index++){
    try{buttons[index].emoji=await validateCustomButtonEmoji(guild,buttons[index].emoji||"",externalAllowed)}
    catch(e){throw new Error("Button "+(index+1)+": "+(e instanceof Error?e.message:String(e)))}
  }
  for(const item of buttons){const role=await guild.roles.fetch(item.roleId).catch(()=>null);if(!role||role.managed||role.position>=me.roles.highest.position)throw new Error("Cerberus must be above every selected role.");}
  const message=await channel.send({embeds:[new EmbedBuilder().setTitle(title.slice(0,256)).setDescription(description.slice(0,4000)).setColor(0x8f315c)]});
  try {
  const rows: ReactionRole[]=[];
  for(const b of buttons)rows.push(await ReactionRole.create({guildId:guild.id,channelId,messageId:message.id,roleId:b.roleId,label:b.label.slice(0,80),emoji:(b.emoji||"").trim(),panelTitle:title.slice(0,256),panelDescription:description.slice(0,4000)}));
  await message.edit({components:panelComponents(rows)});return message;
  } catch(e) {
    await message.delete().catch(()=>null);
    await ReactionRole.destroy({where:{guildId:guild.id,messageId:message.id}});
    throw e;
  }
}
export const reactionRoleCommands=[new SlashCommandBuilder().setName("reactionrole").setDescription("Create button role panels").setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
 .addSubcommand(s=>s.setName("panel").setDescription("Create a role panel with one button").addChannelOption(o=>o.setName("channel").setDescription("Publish channel").setRequired(true)).addStringOption(o=>o.setName("title").setDescription("Embed title").setRequired(true).setMaxLength(256)).addStringOption(o=>o.setName("description").setDescription("Embed description").setRequired(true).setMaxLength(4000)).addRoleOption(o=>o.setName("role").setDescription("Role for the first button").setRequired(true)).addStringOption(o=>o.setName("label").setDescription("Button label").setRequired(true).setMaxLength(80)).addStringOption(o=>o.setName("emoji").setDescription("Optional button emoji")))
 .addSubcommand(s=>s.setName("list").setDescription("List role panels"))];
export async function handleReactionRoleCommand(i:ChatInputCommandInteraction){if(!i.guild){await i.reply({content:"Use this command in a server.",ephemeral:true});return}if(i.options.getSubcommand()==="panel"){try{const ch=i.options.getChannel("channel",true),title=i.options.getString("title",true),description=i.options.getString("description",true),role=i.options.getRole("role",true),label=i.options.getString("label",true),emoji=i.options.getString("emoji")||"";const msg=await publishReactionRolePanel(i.guild,ch.id,title,description,[{roleId:role.id,label,emoji}]);await i.reply({content:"Role panel published: "+msg.url,ephemeral:true})}catch(e){await i.reply({content:e instanceof Error?e.message:"Could not publish role panel.",ephemeral:true})}return}const rows=await ReactionRole.findAll({where:{guildId:i.guild.id},order:[["createdAt","DESC"]]});const ids=[...new Set(rows.map(r=>r.messageId))];await i.reply({content:ids.length?ids.map(id=>"• Panel message "+id).join("\n"):"No role panels configured.",ephemeral:true})}
export async function handleReactionRoleButton(i:ButtonInteraction){const id=Number(i.customId.split(":")[1]);const row=await ReactionRole.findByPk(id);if(!row||row.guildId!==i.guildId){await i.reply({content:"This role button is no longer configured.",ephemeral:true});return}const member=await i.guild!.members.fetch(i.user.id);const role=await i.guild!.roles.fetch(row.roleId).catch(()=>null);if(!role){await i.reply({content:"That role no longer exists.",ephemeral:true});return}if(member.roles.cache.has(role.id)){await member.roles.remove(role.id,"Role panel toggle");await i.reply({content:"Removed **"+role.name+"**.",ephemeral:true})}else{await member.roles.add(role.id,"Role panel toggle");await i.reply({content:"Added **"+role.name+"**.",ephemeral:true})}}
export async function deleteReactionRolePanel(guild:Guild,messageId:string){const row=await ReactionRole.findOne({where:{guildId:guild.id,messageId}});if(row){const ch=await guild.channels.fetch(row.channelId).catch(()=>null);if(ch?.isTextBased()&&"messages" in ch){const msg=await ch.messages.fetch(messageId).catch(()=>null);if(msg)await msg.delete().catch(()=>null)}}await ReactionRole.destroy({where:{guildId:guild.id,messageId}})}
export { updatePanel };
