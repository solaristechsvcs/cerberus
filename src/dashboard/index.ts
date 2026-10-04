import express, { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { config } from "../config";
import { ModerationCase } from "../database/models/ModerationCase";
import { UserNote } from "../database/models/UserNote";

type DiscordGuild = { id: string; name: string; permissions: string; owner?: boolean };
type Session = { userId: string; username: string; guilds: DiscordGuild[]; expiresAt: number };
const sessions = new Map<string, Session>();
const ADMIN = 0x8n;

function cookieValue(req: Request, name: string): string | null {
  const header = req.headers.cookie ?? "";
  const match = header.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function discordToken(code: string): Promise<any> {
  const body = new URLSearchParams({ client_id: config.discord.clientId, client_secret: config.dashboard.clientSecret, grant_type: "authorization_code", code, redirect_uri: `${config.dashboard.publicUrl.replace(/\/$/, "")}/oauth/callback` });
  const response = await fetch("https://discord.com/api/v10/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error("Discord OAuth token exchange failed.");
  return response.json();
}

async function discordGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://discord.com/api/v10${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Discord API request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function session(req: Request): Session | null {
  const id = cookieValue(req, "cerberus_session");
  if (!id) return null;
  const value = sessions.get(id);
  if (!value || value.expiresAt < Date.now()) { sessions.delete(id ?? ""); return null; }
  return value;
}

function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (!session(req)) { res.status(401).json({ error: "Not authenticated." }); return; }
  next();
}

function isAdmin(s: Session, guildId: string): boolean {
  const guild = s.guilds.find(g => g.id === guildId);
  if (!guild) return false;
  return guild.owner === true || (BigInt(guild.permissions) & ADMIN) === ADMIN;
}

function requireGuildAdmin(req: Request, res: Response, next: NextFunction): void {
  const s = session(req);
  const guildId = req.params.guildId;
  if (!s || !isAdmin(s, guildId)) { res.status(403).json({ error: "Administrator access required." }); return; }
  next();
}

const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cerberus Dashboard</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0b0d12;color:#f4f5f7}*{box-sizing:border-box}body{margin:0;background:#0b0d12}header{height:64px;border-bottom:1px solid #262a34;display:flex;align-items:center;justify-content:space-between;padding:0 28px;background:#10131a}main{max-width:1280px;margin:auto;padding:28px}.brand{font-weight:800;font-size:20px}.muted{color:#8d95a5}.grid{display:grid;grid-template-columns:260px 1fr;gap:20px}.panel{background:#12161e;border:1px solid #262a34;border-radius:12px;padding:18px}.guild{padding:12px;border-radius:8px;cursor:pointer;margin:4px 0}.guild:hover,.guild.active{background:#1d2330}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}input,select,button{background:#0d1016;color:#f4f5f7;border:1px solid #303642;border-radius:8px;padding:10px}button{cursor:pointer}button:hover{background:#1c2330}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}.card strong{font-size:26px;display:block;margin-top:6px}.row{border-top:1px solid #262a34;padding:12px 0}.badge{display:inline-block;padding:3px 7px;border-radius:999px;background:#252c3a;font-size:12px;margin-right:6px}.note{white-space:pre-wrap}.empty{padding:30px;text-align:center;color:#8d95a5}@media(max-width:850px){.grid{grid-template-columns:1fr}.cards{grid-template-columns:1fr}}
</style></head><body><header><div class="brand">🐺 Cerberus <span class="muted">Staff Dashboard</span></div><button onclick="logout()">Logout</button></header><main><div id="app" class="empty">Loading…</div></main><script>
const state={guild:null};const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",`"`:"&quot;"}[c]));
async function api(path){const r=await fetch(path);if(!r.ok)throw new Error((await r.json()).error||"Request failed");return r.json()}
async function load(){try{const d=await api("/api/guilds");if(!d.guilds.length){document.getElementById("app").innerHTML="<div class=panel>No Discord servers where you have Administrator access were found.</div>";return}state.guild=state.guild||d.guilds[0].id;renderShell(d.guilds);await loadLogs()}catch(e){document.getElementById("app").innerHTML=`<div class=panel>${esc(e.message)}</div>`}}
function renderShell(guilds){document.getElementById("app").innerHTML=`<div class=grid><aside class=panel><h3>Servers</h3>${guilds.map(g=>`<div class="guild ${g.id===state.guild?"active":""}" onclick="selectGuild(${JSON.stringify(g.id)})">${esc(g.name)}</div>`).join("")}</aside><section><div class=panel><div class=toolbar><input id=userId placeholder="Filter by Discord User ID"><button onclick="loadLogs()">Search</button><button onclick="clearFilter()">All users</button></div><div id=stats></div></div><div class=panel><h2>Moderation & Notes</h2><div id=logs></div></div></section></div>`}
function selectGuild(id){state.guild=id;load()}function clearFilter(){document.getElementById("userId").value="";loadLogs()}
async function loadLogs(){if(!state.guild)return;const user=document.getElementById("userId")?.value.trim();const q=user?`?userId=${encodeURIComponent(user)}`:"";try{const d=await api(`/api/guild/${state.guild}/logs${q}`);document.getElementById("stats").innerHTML=`<div class=cards><div class="panel card"><span class=muted>Moderation cases</span><strong>${d.cases.length}</strong></div><div class="panel card"><span class=muted>Staff notes</span><strong>${d.notes.length}</strong></div><div class="panel card"><span class=muted>Viewing</span><strong>${user?esc(user):"All"}</strong></div></div>`;document.getElementById("logs").innerHTML=`<h3>Moderation Cases</h3>${d.cases.length?d.cases.map(c=>`<div class=row><span class=badge>Case #${c.id}</span><span class=badge>${esc(c.action)}</span><b>User:</b> ${esc(c.userId)} <span class=muted>by ${esc(c.moderatorId)} • ${new Date(c.createdAt).toLocaleString()}</span><div>${esc(c.reason)}</div></div>`).join(""):"<div class=empty>No moderation cases.</div>"}<h3>Staff Notes</h3>${d.notes.length?d.notes.map(n=>`<div class=row><span class=badge>Note #${n.id}</span><b>User:</b> ${esc(n.userId)} <span class=muted>by ${esc(n.authorId)} • ${new Date(n.createdAt).toLocaleString()}</span><div class=note>${esc(n.note)}</div></div>`).join(""):"<div class=empty>No staff notes.</div>"}`;}catch(e){document.getElementById("logs").innerHTML=`<div class=empty>${esc(e.message)}</div>`}}
async function logout(){await fetch("/logout",{method:"POST"});location.href="/"}load();
</script></body></html>`;

export function startDashboard(): void {
  if (!config.dashboard.enabled) return;
  if (!config.dashboard.clientSecret || config.dashboard.clientSecret === "CHANGE_ME") { console.warn("Dashboard disabled: set dashboard.clientSecret in config.js."); return; }
  const app = express();
  app.get("/", (req,res) => { if (!session(req)) { res.type("html").send(`<main style="font-family:system-ui;max-width:700px;margin:80px auto;text-align:center"><h1>Cerberus Dashboard</h1><p>Administrator access only.</p><a href="/login">Login with Discord</a></main>`); return; } res.type("html").send(page); });
  app.get("/login", (_req,res) => { const state=crypto.randomBytes(24).toString("hex"); const redirect=`${config.dashboard.publicUrl.replace(/\/$/,"")}/oauth/callback`; const url=new URL("https://discord.com/oauth2/authorize"); url.searchParams.set("client_id",config.discord.clientId); url.searchParams.set("response_type","code"); url.searchParams.set("redirect_uri",redirect); url.searchParams.set("scope","identify guilds"); url.searchParams.set("state",state); res.setHeader("Set-Cookie",`cerberus_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/`); res.redirect(url.toString()); });
  app.get("/oauth/callback", async (req,res) => { try { const code=String(req.query.code??""); const expected=cookieValue(req,"cerberus_oauth_state"); if(!code||!expected||expected!==String(req.query.state??"")) return res.status(400).send("Invalid OAuth state."); const token=await discordToken(code); const user=await discordGet<{id:string;username:string}>("/users/@me",token.access_token); const guilds=await discordGet<DiscordGuild[]>("/users/@me/guilds",token.access_token); const sid=crypto.randomBytes(32).toString("hex"); sessions.set(sid,{userId:user.id,username:user.username,guilds:guilds.filter(g=>g.owner||(BigInt(g.permissions)&ADMIN)===ADMIN),expiresAt:Date.now()+8*60*60*1000}); res.setHeader("Set-Cookie",`cerberus_session=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`); res.redirect("/"); } catch(e) { res.status(500).send("Discord login failed."); } });
  app.post("/logout",(req,res)=>{const id=cookieValue(req,"cerberus_session");if(id)sessions.delete(id);res.setHeader("Set-Cookie","cerberus_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");res.status(204).end();});
  app.get("/api/guilds",requireSession,(req,res)=>{const s=session(req)!;res.json({guilds:s.guilds})});
  app.get("/api/guild/:guildId/logs",requireGuildAdmin,async(req,res)=>{try{const where:any={guildId:req.params.guildId};if(req.query.userId)where.userId=String(req.query.userId);const [cases,notes]=await Promise.all([ModerationCase.findAll({where,order:[["createdAt","DESC"]],limit:100}),UserNote.findAll({where,order:[["createdAt","DESC"]],limit:100})]);res.json({cases,notes});}catch(e){res.status(500).json({error:"Database query failed."})}});
  app.listen(config.dashboard.port,()=>console.log(`Cerberus dashboard listening on port ${config.dashboard.port}`));
}