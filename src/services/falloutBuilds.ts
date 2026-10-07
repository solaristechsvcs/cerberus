export type FalloutBuild={title:string;url:string;archetype:string;special:string;votes:number;updated:string;author:string};
const BASE="https://www.falloutbuilds.com/fo76/builds/";
let cached:{at:number;items:FalloutBuild[]}|null=null;
function decode(s:string){return s.replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&#8217;|&rsquo;/g,"'").replace(/&#8211;|&ndash;/g,"-").replace(/&quot;/g,'"').replace(/\s+/g," ").trim()}
function absolute(href:string){return href.startsWith("http")?href:"https://www.falloutbuilds.com"+(href.startsWith("/")?"":"/")+href}
function parse(html:string):FalloutBuild[]{
 const rows=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];const out:FalloutBuild[]=[];
 for(const row of rows){const cells=[...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1]);if(cells.length<6)continue;
  const link=cells[0].match(/href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);if(!link)continue;
  const title=decode(link[2]);if(!title)continue;const values=cells.map(decode);
  const special=values.find(v=>/^\d{1,2}\/\d{1,2}\/\d{1,2}\/\d{1,2}\/\d{1,2}\/\d{1,2}\/\d{1,2}$/.test(v))||"";
  const specialIndex=values.indexOf(special),archetype=specialIndex>0?values[specialIndex-1]:"Unknown",votesText=specialIndex>=0?values[specialIndex+1]||"0":"0",updated=specialIndex>=0?values[specialIndex+2]||"Unknown":"Unknown",author=specialIndex>=0?values[specialIndex+3]||"Unknown":"Unknown";
  out.push({title,url:absolute(link[1]),archetype,special,votes:Number(votesText.replace(/[^\d-]/g,""))||0,updated,author});
 }return out;
}
async function page(url:string){const r=await fetch(url,{headers:{"User-Agent":"Cerberus Discord Bot build search (FalloutBuilds.com integration)"},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error("FalloutBuilds returned HTTP "+r.status);return r.text()}
export async function getFalloutBuilds(force=false){if(!force&&cached&&Date.now()-cached.at<10*60_000)return cached.items;const first=await page(BASE);let items=parse(first);const lastLinks=[...first.matchAll(/href=["']([^"']*(?:\/page\/|paged=)\d+[^"']*)["'][^>]*>\s*Last/gi)];let pages=1;if(lastLinks.length){const nums=lastLinks[0][1].match(/(?:\/page\/|paged=)(\d+)/i);if(nums)pages=Math.min(Number(nums[1])||1,100)}else{pages=Math.ceil(1467/20)}
 for(let p=2;p<=pages;p++){try{const html=await page(BASE+"page/"+p+"/");const found=parse(html);if(!found.length)break;items.push(...found)}catch{break}}
 if(!items.length)throw new Error("FalloutBuilds page format was not recognized.");cached={at:Date.now(),items};return items}
export async function searchFalloutBuilds(query:string){const q=query.toLowerCase().trim(),items=await getFalloutBuilds();return items.filter(b=>(b.title+" "+b.archetype+" "+b.author).toLowerCase().includes(q))}
export async function falloutBuildsByArchetype(type:string){const q=type.toLowerCase();return (await getFalloutBuilds()).filter(b=>b.archetype.toLowerCase().includes(q))}
export async function latestFalloutBuilds(){return (await getFalloutBuilds()).slice(0,10)}
export async function topFalloutBuilds(){return [...await getFalloutBuilds()].sort((a,b)=>b.votes-a.votes).slice(0,10)}
