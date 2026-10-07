import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { FalloutBuild, searchFalloutBuildsByType } from "../services/falloutBuilds";

export const buildCommands=[new SlashCommandBuilder().setName("builds").setDescription("Search Fallout 76 builds from FalloutBuilds.com")
 .addSubcommand(s=>s.setName("search").setDescription("Search Fallout 76 builds by build type")
  .addStringOption(o=>o.setName("type").setDescription("Build type").setRequired(true).addChoices(
   {name:"Commando",value:"commando"},{name:"Heavy Gunner",value:"heavy"},{name:"Rifleman",value:"rifleman"},{name:"Shotgunner",value:"shotgun"},{name:"Melee",value:"melee"},{name:"Pistol",value:"pistol"},{name:"Archer",value:"archer"},{name:"Other",value:"other"}))
  .addStringOption(o=>o.setName("query").setDescription("Optional keyword, build name, or author").setMaxLength(100)))];

const PAGE=5;
function buildEmbed(items:FalloutBuild[],type:string,query:string,page:number){
 const pages=Math.max(1,Math.ceil(items.length/PAGE)),start=page*PAGE,shown=items.slice(start,start+PAGE);
 return new EmbedBuilder().setTitle("☢ Fallout 76 "+type+" Builds").setURL("https://www.falloutbuilds.com/fo76/builds/").setColor(0xf0c419)
 .setDescription(shown.length?shown.map((b,i)=>"**"+(start+i+1)+". ["+b.title+"]("+b.url+")**\n"+b.archetype+" • "+(b.special||"S.P.E.C.I.A.L. unavailable")+" • "+(b.votes>=0?"+":"")+b.votes+" votes\nBy "+b.author+" • Updated "+b.updated).join("\n\n"):"No matching builds were found.")
 .setFooter({text:(query?'Filter: "'+query+'" • ':"")+items.length+" result(s) • Page "+(page+1)+"/"+pages+" • FalloutBuilds.com"}).setTimestamp();
}
function buttons(page:number,pages:number){
 return new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder().setCustomId("builds:prev").setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(page<=0),
  new ButtonBuilder().setCustomId("builds:next").setLabel("Next").setStyle(ButtonStyle.Primary).setDisabled(page>=pages-1),
  new ButtonBuilder().setLabel("FalloutBuilds.com").setStyle(ButtonStyle.Link).setURL("https://www.falloutbuilds.com/fo76/builds/"));
}
export async function handleBuildCommand(i:ChatInputCommandInteraction):Promise<void>{
 await i.deferReply();try{
  const type=i.options.getString("type",true),query=i.options.getString("query")?.trim()||"",items=await searchFalloutBuildsByType(type,query),pages=Math.max(1,Math.ceil(items.length/PAGE));let page=0;
  const message=await i.editReply({embeds:[buildEmbed(items,type,query,page)],components:[buttons(page,pages)]});
  if(items.length<=PAGE)return;
  const collector=message.createMessageComponentCollector({componentType:ComponentType.Button,time:120000,filter:b=>b.user.id===i.user.id&&b.customId.startsWith("builds:")});
  collector.on("collect",async b=>{page=b.customId==="builds:next"?Math.min(pages-1,page+1):Math.max(0,page-1);await b.update({embeds:[buildEmbed(items,type,query,page)],components:[buttons(page,pages)]});});
  collector.on("end",()=>{void i.editReply({components:[buttons(page,pages).setComponents(
   new ButtonBuilder().setCustomId("builds:prev").setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(true),
   new ButtonBuilder().setCustomId("builds:next").setLabel("Next").setStyle(ButtonStyle.Primary).setDisabled(true),
   new ButtonBuilder().setLabel("FalloutBuilds.com").setStyle(ButtonStyle.Link).setURL("https://www.falloutbuilds.com/fo76/builds/"))]}).catch(()=>null);});
 }catch(e){console.error("FalloutBuilds search failed:",e);await i.editReply("I couldn't retrieve FalloutBuilds.com right now. Please try again shortly.");}
}
