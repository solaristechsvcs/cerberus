import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { config } from "../config";

export const developerCommands = [
 new SlashCommandBuilder()
  .setName("gannounce")
  .setDescription("Send a developer announcement to administrators across all Cerberus servers.")
  .addStringOption(option=>option.setName("message").setDescription("Maintenance, incident, or developer announcement").setRequired(true).setMaxLength(4000))
];

export type GlobalAnnouncementResult={servers:number;adminUsers:number;delivered:number;failed:number;guildFailures:number};

export async function sendGlobalAnnouncement(client:any,message:string):Promise<GlobalAnnouncementResult>{
 const recipients=new Map<string,{user:any;guilds:string[]}>();
 let guildFailures=0;
 for(const guild of client.guilds.cache.values()){
  try{
   const members=await guild.members.fetch();
   const admins=members.filter((member:any)=>!member.user.bot&&(member.id===guild.ownerId||member.permissions.has(PermissionFlagsBits.Administrator)));
   for(const member of admins.values()){
    const current=recipients.get(member.id);
    if(current)current.guilds.push(guild.name);
    else recipients.set(member.id,{user:member.user,guilds:[guild.name]});
   }
  }catch(error){
   guildFailures++;
   console.error("Global announcement admin lookup failed for "+guild.id+":",error);
  }
 }
 let delivered=0,failed=0;
 for(const recipient of recipients.values()){
  const embed=new EmbedBuilder().setTitle("Cerberus Developer Announcement").setDescription(message).addFields({name:"Affected Cerberus Server"+(recipient.guilds.length===1?"":"s"),value:recipient.guilds.join(", ").slice(0,1024)}).setColor(0x8f315c).setFooter({text:"This announcement was sent by the Cerberus development team."}).setTimestamp();
  try{await recipient.user.send({embeds:[embed]});delivered++;}catch{failed++;}
 }
 return {servers:client.guilds.cache.size,adminUsers:recipients.size,delivered,failed,guildFailures};
}

export async function handleDeveloperCommand(interaction:ChatInputCommandInteraction):Promise<void>{
 if(interaction.commandName!=="gannounce")return;
 if(!(config.dashboard.globalAdmins??[]).includes(interaction.user.id)){await interaction.reply({content:"This command is restricted to Cerberus global administrators.",ephemeral:true});return;}
 const message=interaction.options.getString("message",true).trim();
 await interaction.deferReply({ephemeral:true});
 const result=await sendGlobalAnnouncement(interaction.client,message);
 await interaction.editReply("Announcement processed across **"+result.servers+"** server(s).\n**Admin users found:** "+result.adminUsers+"\n**DMs delivered:** "+result.delivered+"\n**DMs failed/disabled:** "+result.failed+"\n**Servers that could not be scanned:** "+result.guildFailures);
}
