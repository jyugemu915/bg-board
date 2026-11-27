// 一時的な調査用（終わったら削除）
const TOKEN = process.env.BGG_TOKEN;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) { for (let i = 0; i < 5; i++) { const r = await fetch("https://boardgamegeek.com/xmlapi2/" + path, { headers: { Authorization: `Bearer ${TOKEN}` } }); if (r.status === 202 || r.status === 429) { await sleep(3000); continue; } return await r.text(); } return ""; }
const ids = new Set();
for (const q of ["ペッパー", "Pepper", "Drada", "Dorada", "ドラダ", "Le Havre", "ル・アーヴル", "Arcs Blighted Reach", "Blighted Reach"]) {
  const x = await get(`search?type=boardgame,boardgameexpansion&query=${encodeURIComponent(q)}`);
  const items = [...x.matchAll(/<item type="(\w+)" id="(\d+)">\s*<name type="\w+" value="([^"]*)"\s*\/>\s*(?:<yearpublished value="(\d+)")?/g)];
  console.log(`\n## ${q} (${items.length})`);
  for (const m of items.slice(0, 25)) { console.log(`${m[1]} ${m[2]} ${m[3]} ${m[4] || ""}`); ids.add(m[2]); }
  await sleep(1300);
}
const all = [...ids];
for (let i = 0; i < all.length; i += 20) {
  const x = await get(`thing?id=${all.slice(i, i + 20).join(",")}`);
  for (const it of x.split("<item ").slice(1)) {
    const id = it.match(/id="(\d+)"/)[1];
    const pubs = [...it.matchAll(/type="boardgamepublisher" id="\d+" value="([^"]*)"/g)].map((m) => m[1]);
    const ja = [...it.matchAll(/<name type="alternate"[^>]*value="([^"]*)"/g)].map((m) => m[1]).filter((n) => /[぀-ヿ一-鿿]/.test(n));
    if (!pubs.some((p) => /ten ?days|テンデイズ|hobby japan|arclight|japan/i.test(p)) && !ja.length) continue;
    const name = it.match(/<name type="primary"[^>]*value="([^"]*)"/)?.[1];
    console.log(`JP ${id} ${name} | ${ja.join(" / ")} | ${pubs.filter((p) => /days|japan|arclight|ホビー|テンデイズ/i.test(p)).join(", ")}`);
  }
  await sleep(1500);
}
