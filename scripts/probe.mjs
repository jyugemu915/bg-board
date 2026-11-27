// 一時的な調査用（終わったら削除）
const TOKEN = process.env.BGG_TOKEN;
const Q = ["Petiquette","Wriggle Roulette","Souvenirs from Venice","Moving Wild","Dropolter","Rafter Five","Whale to Look","Quickity Pickity","Town 66","Tiger & Dragon","The Diamond Swap","Moon Adventure","Dokojong","In a Grove","Hey Yo","Durian","Rights Startups","Ninja Catfoot","Insider Black","Fafnir","Nine Tiles Panic","Dual Clash Poker","Mr. Face","Tricks and the Phantom","Void","Flotsam Fight","Tomatomato","Moneybags","Zogen","Troika","Dungeon of Mandom VIII","Maskmen","Insider","Dungeon of Mandom"];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(p) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch("https://boardgamegeek.com/xmlapi2/" + p, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (r.status === 202 || r.status === 429) { await sleep(3000); continue; }
    return await r.text();
  }
  return "";
}
const items = x => [...x.matchAll(/<item type="(\w+)" id="(\d+)">\s*<name type="(\w+)" value="([^"]*)"\s*\/>(?:\s*<yearpublished value="(\d+)"\s*\/>)?/g)].map(m => `${m[2]} ${m[1]} ${m[4]} (${m[5] || "?"})`);
for (const q of Q) {
  let x = await get(`search?exact=1&type=boardgame,boardgameexpansion&query=${encodeURIComponent(q)}`);
  let it = items(x), tag = "exact";
  if (!it.length) { await sleep(1200); x = await get(`search?type=boardgame,boardgameexpansion&query=${encodeURIComponent(q)}`); it = items(x).slice(0, 10); tag = "fuzzy"; }
  console.log(`## ${q} [${tag}]\n` + it.join("\n"));
  await sleep(1200);
}
