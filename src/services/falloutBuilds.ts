export type FalloutBuild={title:string;url:string;archetype:string;special:string;votes:number;updated:string;author:string};
const BASE="https://www.falloutbuilds.com/fo76/builds/";
let cached:{at:number;items:FalloutBuild[]}|null=null;
function decode(s:string){return s.replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&#8217;|&rsquo;/g,"'").replace(/&#8211;|&ndash;/g,"-").replace(/&quot;/g,'"').replace(/\s+/g," ").trim()}
function absolute(href:string){return href.startsWith("http")?href:"https://www.falloutbuilds.com"+(href.startsWith("/")?"":"/")+href}
function parse(html:string):FalloutBuild[]{
 const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)(?:<\/tr\s*>|(?=<tr\b)|(?=<\/(?:tbody|table)\b))/gi)];
 const out:FalloutBuild[]=[];
 for(const row of rows){
  const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)(?:<\/td\s*>|(?=<t[dh]\b)|$)/gi)].map(m=>m[1]);
  if(cells.length<6)continue;
  let title="",url="",titleIndex=-1;
  for(let index=0;index<cells.length;index++){
   for(const link of cells[index].matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const candidate=absolute(decode(link[1]));
    if(!/^https:\/\/www\.falloutbuilds\.com\/builds\/[^/?#]+\/?(?:[?#].*)?$/i.test(candidate))continue;
    const text=decode(link[2]);if(!text)continue;
    title=text;url=candidate;titleIndex=index;break;
   }
   if(titleIndex>=0)break;
  }
  if(titleIndex<0)continue;
  const values=cells.map(decode);
  const specialIndex=values.findIndex((v,index)=>index>titleIndex&&/^\d{1,2}(?:\/\d{1,2}){6}$/.test(v.replace(/\s/g,"")));
  if(specialIndex<0)continue;
  const special=values[specialIndex].replace(/\s/g,"");
  out.push({title,url,archetype:values[specialIndex-1]||"Unknown",special,
   votes:Number((values[specialIndex+1]||"0").replace(/[^\d-]/g,""))||0,
   updated:values[specialIndex+2]||"Unknown",author:values[specialIndex+3]||"Unknown"});
 }
 return out;
}
function pageCount(html:string){
 let pages=1;
 for(const link of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  if(!/\bLast\b/i.test(decode(link[2])))continue;
  const match=decode(link[1]).match(/(?:\/page\/|[?&]paged=)(\d+)/i);
  if(match)pages=Math.max(pages,Number(match[1])||1);
 }
 if(pages===1){
  const count=decode(html).match(/Show\s+(\d+)\s*[-–]\s*(\d+)\s+of\s+([\d,]+)/i);
  if(count){const size=Number(count[2])-Number(count[1])+1;if(size>0)pages=Math.ceil(Number(count[3].replace(/,/g,""))/size)}
 }
 return Math.min(pages,100);
}
async function page(url:string){const r=await fetch(url,{headers:{"User-Agent":"Cerberus Discord Bot build search (FalloutBuilds.com integration)"},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error("FalloutBuilds returned HTTP "+r.status);return r.text()}
export async function getFalloutBuilds(force=false){if(!force&&cached&&Date.now()-cached.at<10*60_000)return cached.items;const first=await page(BASE);let items=parse(first);
 if(!items.length)throw new Error("FalloutBuilds page format was not recognized, or the site returned an access-check page.");
 const pages=pageCount(first);
 for(let p=2;p<=pages;p++){try{const html=await page(BASE+"page/"+p+"/");const found=parse(html);if(!found.length)break;items.push(...found)}catch{break}}
 if(!items.length)throw new Error("FalloutBuilds page format was not recognized.");cached={at:Date.now(),items};return items}
export async function searchFalloutBuilds(query:string){const q=query.toLowerCase().trim(),items=await getFalloutBuilds();return items.filter(b=>(b.title+" "+b.archetype+" "+b.author).toLowerCase().includes(q))}
export async function falloutBuildsByArchetype(type:string){const q=type.toLowerCase();return (await getFalloutBuilds()).filter(b=>b.archetype.toLowerCase().includes(q))}
export async function latestFalloutBuilds(){return (await getFalloutBuilds()).slice(0,10)}
export async function topFalloutBuilds(){return [...await getFalloutBuilds()].sort((a,b)=>b.votes-a.votes).slice(0,10)}

export async function searchFalloutBuildsByType(type:string,query=""){const items=await getFalloutBuilds(),t=type.toLowerCase().trim(),q=query.toLowerCase().trim();return items.filter(b=>{const hay=(b.title+" "+b.archetype+" "+b.author).toLowerCase();const typeMatch=t==="other"?!["commando","heavy","rifleman","shotgun","melee","pistol","archer"].some(x=>b.archetype.toLowerCase().includes(x)):hay.includes(t);return typeMatch&&(!q||hay.includes(q))})}
