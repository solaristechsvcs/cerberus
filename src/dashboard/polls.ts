import { Express, Request, RequestHandler } from "express";
import { ChannelType, Client } from "discord.js";
import { Poll } from "../database/models/Poll";
import { closePoll, createPoll, pollResults } from "../commands/polls";

export function registerPollRoutes(app:Express,client:Client,requireGuildAdmin:RequestHandler,userId:(req:Request)=>string){
 app.get("/api/guild/:guildId/polls",requireGuildAdmin,async(req,res)=>{
  try{
   const guild=client.guilds.cache.get(String(req.params.guildId));if(!guild)return void res.status(404).json({error:"Server not found."});
   const [rows,channels]=await Promise.all([Poll.findAll({where:{guildId:guild.id},order:[["createdAt","DESC"]],limit:50}),guild.channels.fetch()]);
   const polls=await Promise.all(rows.map(async poll=>({...poll.toJSON(),...await pollResults(poll)})));
   res.json({polls,channels:[...channels.values()].filter(ch=>ch&&(ch.type===ChannelType.GuildText||ch.type===ChannelType.GuildAnnouncement)).map(ch=>({id:ch!.id,name:"#"+ch!.name}))});
  }catch(error){console.error("Poll dashboard failed:",error);res.status(500).json({error:"Could not load polls."})}
 });
 app.post("/api/guild/:guildId/polls",requireGuildAdmin,async(req,res)=>{
  try{
   const guild=client.guilds.cache.get(String(req.params.guildId));if(!guild)return void res.status(404).json({error:"Server not found."});
   const body=req.body??{};if(!Array.isArray(body.options)||!body.options.every((value:unknown)=>typeof value==="string"))return void res.status(400).json({error:"Enter the poll choices."});
   const result=await createPoll(guild,userId(req),String(body.channelId??""),String(body.question??""),body.options,Number(body.hours??0));
   res.json({ok:true,poll:result.poll,url:result.url});
  }catch(error){res.status(400).json({error:error instanceof Error?error.message:"Could not publish poll."})}
 });
 app.post("/api/guild/:guildId/polls/:pollId/close",requireGuildAdmin,async(req,res)=>{
  try{
   const guild=client.guilds.cache.get(String(req.params.guildId));if(!guild)return void res.status(404).json({error:"Server not found."});
   const id=Number(req.params.pollId);if(!Number.isSafeInteger(id)||id<1)return void res.status(400).json({error:"Invalid poll ID."});
   await closePoll(guild,id,userId(req),true);res.json({ok:true});
  }catch(error){res.status(400).json({error:error instanceof Error?error.message:"Could not close poll."})}
 });
}
