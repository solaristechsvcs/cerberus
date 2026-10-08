import { Express, RequestHandler } from "express";
import { ChannelType, Client } from "discord.js";
import { SuggestionSettings } from "../database/models/SuggestionSettings";
import { SuggestionPanel } from "../database/models/SuggestionPanel";
import { Suggestion } from "../database/models/Suggestion";
import { deleteSuggestionPanel, publishSuggestionPanel, validateSuggestionSettings } from "../commands/suggestions";

export function registerSuggestionRoutes(app:Express,client:Client,requireGuildAdmin:RequestHandler){
 app.get("/api/guild/:guildId/suggestion-config",requireGuildAdmin,async(req,res)=>{
  try{
   const guild=client.guilds.cache.get(String(req.params.guildId));if(!guild)return void res.status(404).json({error:"Server not found."});
   const [settings]=await SuggestionSettings.findOrCreate({where:{guildId:guild.id}});
   const [panels,entries,channels,roles]=await Promise.all([
    SuggestionPanel.findAll({where:{guildId:guild.id},order:[["createdAt","DESC"]]}),
    Suggestion.findAll({where:{guildId:guild.id},order:[["createdAt","DESC"]],limit:50}),
    guild.channels.fetch(),guild.roles.fetch()
   ]);
   res.json({settings,panels,entries,
    channels:[...channels.values()].filter(ch=>ch&&(ch.type===ChannelType.GuildText||ch.type===ChannelType.GuildAnnouncement)).map(ch=>({id:ch!.id,name:"#"+ch!.name,type:ch!.type})),
    categories:[...channels.values()].filter(ch=>ch?.type===ChannelType.GuildCategory).map(ch=>({id:ch!.id,name:ch!.name})),
    roles:[...roles.values()].filter(role=>role.id!==guild.roles.everyone.id).sort((a,b)=>b.position-a.position).map(role=>({id:role.id,name:role.name}))
   });
  }catch(error){console.error("Suggestion configuration failed:",error);res.status(500).json({error:"Could not load suggestion settings."})}
 });
 app.put("/api/guild/:guildId/suggestion-config",requireGuildAdmin,async(req,res)=>{
  try{
   const guild=client.guilds.cache.get(String(req.params.guildId));if(!guild)return void res.status(404).json({error:"Server not found."});
   const body=req.body??{};
   if(!Array.isArray(body.staffRoleIds)||!body.staffRoleIds.every((id:unknown)=>typeof id==="string"))return void res.status(400).json({error:"Select the suggestion staff roles."});
   const configuration=await validateSuggestionSettings(guild,{channelId:String(body.channelId??""),categoryId:String(body.categoryId??""),logChannelId:String(body.logChannelId??""),staffRoleIds:body.staffRoleIds});
   const [settings]=await SuggestionSettings.findOrCreate({where:{guildId:guild.id}});
   await settings.update(configuration);res.json({ok:true,settings});
  }catch(error){res.status(400).json({error:error instanceof Error?error.message:"Could not save suggestion settings."})}
 });
 app.post("/api/guild/:guildId/suggestion-panels",requireGuildAdmin,async(req,res)=>{
  try{
   const guild=client.guilds.cache.get(String(req.params.guildId));if(!guild)return void res.status(404).json({error:"Server not found."});
   const result=await publishSuggestionPanel(guild,String(req.body?.title??""),String(req.body?.description??""),String(req.body?.buttonLabel??"Submit Suggestion"));
   res.json({ok:true,panel:result.panel,url:result.url});
  }catch(error){res.status(400).json({error:error instanceof Error?error.message:"Could not publish suggestion panel."})}
 });
 app.delete("/api/guild/:guildId/suggestion-panels/:panelId",requireGuildAdmin,async(req,res)=>{
  try{
   const guild=client.guilds.cache.get(String(req.params.guildId));if(!guild)return void res.status(404).json({error:"Server not found."});
   const id=Number(req.params.panelId);if(!Number.isSafeInteger(id)||id<1)return void res.status(400).json({error:"Invalid panel ID."});
   await deleteSuggestionPanel(guild,id);res.json({ok:true});
  }catch(error){res.status(400).json({error:error instanceof Error?error.message:"Could not delete suggestion panel."})}
 });
}
