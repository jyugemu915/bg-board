// 一時的な調査用（終わったら削除）
const TOKEN = process.env.BGG_TOKEN;
const Q = ["狩歌","ひらがなポーカー","ウミガメの島","人狼バトルロイヤル","タビーキャッツ","ひらがじゃん","Age of Steam Deluxe Edition","Shuka","Umigame","Jinro"];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(p) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch("https://boardgamegeek.com/xmlapi2/" + p, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (r.status === 202 || r.status === 429) { await sleep(3000); continue; }
    return await r.text();
  }
  return "";
}
for (const q of Q) {
  const x = await get(`search?type=boardgame,boardgameexpansion&query=${encodeURIComponent(q)}`);
  const ids = [...new Set([...x.matchAll(/<item type="\w+" id="(\d+)">/g)].map(m => m[1]))].slice(0, 12);
  console.log(`## ${q}: ${ids.length}`);
  await sleep(1200);
  if (!ids.length) continue;
  const t = await get(`thing?id=${ids.join(",")}`);
  for (const it of t.split("<item ").slice(1)) {
    const id = it.match(/id="(\d+)"/)[1], ty = it.match(/type="(\w+)"/)[1];
    const nm = it.match(/<name type="primary"[^>]*value="([^"]*)"/)?.[1];
    const alt = [...it.matchAll(/<name type="alternate"[^>]*value="([^"]*)"/g)].map(m => m[1]).filter(s => /[぀-ヿ一-鿿]/.test(s)).slice(0, 3);
    const yr = it.match(/<yearpublished value="(\d+)"/)?.[1];
    const pick = k => [...it.matchAll(new RegExp(`type="boardgame${k}" id="\\d+" value="([^"]*)"`, "g"))].map(m => m[1]).slice(0, 3).join("/");
    console.log(`- ${id} ${ty} ${nm} (${yr}) d:${pick("designer")} p:${pick("publisher")} ${alt.join("・")}`);
  }
  await sleep(1200);
}
