const T=process.env.BGG_TOKEN, sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function api(p){for(let i=0;i<5;i++){const r=await fetch("https://boardgamegeek.com/xmlapi2/"+p,{headers:{Authorization:`Bearer ${T}`}});if(r.status===200)return r.text();await sleep(3000);}return "";}
const qs=["Krampus Holiday Havoc","Krampus","Payback","Tabby Cats","16 Cats","Sail","Log","Project L","Hiragajan","Clash of Decks","Mr. Diamond","Mister Diamond","Keep the Heroes Out"];
for(const q of qs){const x=await api("search?type=boardgame,boardgameexpansion&query="+encodeURIComponent(q));
 const items=[...x.matchAll(/<item type="(\w+)" id="(\d+)">\s*<name type="\w+" value="([^"]*)"\s*\/>\s*(?:<yearpublished value="(\d+)"\s*\/>)?/g)].map(m=>`${m[2]} ${m[3]} (${m[4]||"-"}) ${m[1]==="boardgameexpansion"?"[拡張]":""}`);
 console.log("## "+q+" : "+items.length);console.log(items.slice(0,25).join("\n"));await sleep(1500);}
// details for keep the heroes out expansions
const k=await api("thing?id=336794&type=boardgame");console.log("## KTHO links");console.log([...k.matchAll(/<link type="boardgameexpansion" id="(\d+)" value="([^"]*)"/g)].map(m=>m[1]+" "+m[2]).join("\n"));
