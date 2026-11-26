const T=process.env.BGG_TOKEN, sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function api(p){for(let i=0;i<6;i++){const r=await fetch("https://boardgamegeek.com/xmlapi2/"+p,{headers:{Authorization:`Bearer ${T}`}});if(r.status===200)return r.text();await sleep(3000);}return "";}
const parse=(x)=>{const m=new Map();for(const a of x.matchAll(/<item type="(\w+)" id="(\d+)">\s*<name type="\w+" value="([^"]*)"\s*\/>\s*(?:<yearpublished value="(\d+)"\s*\/>)?/g)){const k=a[2];const t=a[1]==="boardgameexpansion"?"[拡]":"";if(!m.has(k)||t)m.set(k,`${k} ${a[3].replace(/&#039;/g,"'").replace(/&amp;/g,"&")} (${a[4]||"-"})${t}`);}return [...m.values()];};
const qs=process.argv.slice(2).length?process.argv.slice(2):JSON.parse((await import("node:fs")).readFileSync("scripts/probe-q.json","utf8"));
for(const q of qs){const ex=parse(await api("search?exact=1&type=boardgame,boardgameexpansion&query="+encodeURIComponent(q)));await sleep(1200);
 let fz=[];if(ex.length<2){fz=parse(await api("search?type=boardgame,boardgameexpansion&query="+encodeURIComponent(q)));await sleep(1200);}
 console.log("## "+q+" | exact: "+ex.join(" ; "));if(fz.length)console.log("   fuzzy("+fz.length+"): "+fz.slice(0,12).join(" ; "));}
