export type NukaPrice={name:string;url:string;low:string;high:string;recommended:string;flux:string;type:string;category:string};
export type NukaListing={title:string;url:string;date:string;source:string};
const ROOT="https://nukatrader.com";
let searchCache=new Map<string,{at:number,html:string}>();
function clean(s:string){return s.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&#8217;|&rsquo;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g," ").trim()}
async function fetchText(url:string){const hit=searchCache.get(url);if(hit&&Date.now()-hit.at<10*60_000)return hit.html;const r=await fetch(url,{headers:{"User-Agent":"Cerberus Discord Bot NukaTrader integration"},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error("NukaTrader HTTP "+r.status);const html=await r.text();searchCache.set(url,{at:Date.now(),html});return html}
function field(text:string,label:string){const m=text.match(new RegExp(label+"\\s*:?\\s*([^|•]{1,80})","i"));return m?.[1]?.trim()||"Unknown"}
export async function searchNukaPrices(query:string):Promise<NukaPrice[]>{
 const html=await fetchText(ROOT+"/?s="+encodeURIComponent(query));const links=[...html.matchAll(/href=["'](https?:\/\/nukatrader\.com\/(?:plans|apparel|components)\/[^"'#?]+\/?)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)];
 const unique=[...new Map(links.map(m=>[m[1],{url:m[1],name:clean(m[2])}])).values()].filter(x=>x.name).slice(0,10),out:NukaPrice[]=[];
 for(const item of unique){try{const page=await fetchText(item.url),text=clean(page);const low=text.match(/(?:Price Details|Pricing Details)[\s\S]{0,80}?Low\s*:?[\s]*(?:Price Low\s*)?([\d,]+\s*caps)/i)?.[1]||text.match(/Price Low\s*([\d,]+\s*caps)/i)?.[1]||"Unknown";const high=text.match(/(?:Price Details|Pricing Details)[\s\S]{0,160}?High\s*:?[\s]*(?:Price High\s*)?([\d,]+\s*caps)/i)?.[1]||text.match(/Price High\s*([\d,]+\s*caps)/i)?.[1]||"Unknown";const recommended=text.match(/(?:Recommended|Estimated Value)\s*:?[\s]*([\d,]+\s*caps)/i)?.[1]||"Unknown";const flux=text.match(/Flux Conversion\s*([\d,]+\s*flux)/i)?.[1]||"Unknown";out.push({name:item.name,url:item.url,low,high,recommended,flux,type:field(text,"Type"),category:field(text,"Category")})}catch{}}
 return out;
}
const TRADE:Record<string,string>={pc:"/trade-pc/",xbox:"/trade-xbox/",playstation:"/trade-ps4/"};
export async function searchNukaMarket(platform:string,query:string):Promise<NukaListing[]>{
 const path=TRADE[platform]||TRADE.pc,html=await fetchText(ROOT+path),q=query.toLowerCase(),out:NukaListing[]=[];
 const heads=[...html.matchAll(/<h[2-4][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[2-4]>/gi)];
 for(const m of heads){const title=clean(m[2]);if(!title||!title.toLowerCase().includes(q))continue;const around=html.slice(m.index||0,(m.index||0)+800),date=clean(around.match(/(?:entry-date|posted-on|date)[^>]*>([\s\S]*?)<\//i)?.[1]||"Recent listing");out.push({title,url:m[1].startsWith("http")?m[1]:ROOT+m[1],date,source:title.match(/at (Market76|Fallout76Marketplace)/i)?.[1]||"NukaTrader Trading Post"});if(out.length>=50)break}
 return out;
}
