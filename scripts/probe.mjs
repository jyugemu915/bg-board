// 一時的な調査用：BGG ID 探し（終わったら削除）
const TOKEN = process.env.BGG_TOKEN;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch("https://boardgamegeek.com/xmlapi2/" + path, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (r.status === 202 || r.status === 429) { await sleep(3000); continue; }
    return await r.text();
  }
  return "";
}
const qs = ["Order Overload Cafe", "Order Overload", "Startups", "The Pyramid's Deadline", "Pyramid's Deadline", "Insider", "Town 77", "Town77", "カブラン", "キャッチフレーズカルタ", "Catchphrase Karuta", "Oink Games Karuta", "注文の多すぎるゲーム", "死ぬまでにピラミッド", "タウン77"];
const ids = new Set();
for (const q of qs) {
  const x = await get(`search?type=boardgame,boardgameexpansion&query=${encodeURIComponent(q)}`);
  const items = [...x.matchAll(/<item type="(\w+)" id="(\d+)">\s*<name type="\w+" value="([^"]*)"\s*\/>\s*(?:<yearpublished value="(\d+)")?/g)].slice(0, 15);
  console.log(`\n## ${q} (${items.length})`);
  for (const m of items) { console.log(`${m[2]} ${m[3]} ${m[4] || ""}`); ids.add(m[2]); }
  await sleep(1200);
}
// 出版社が Oink のものを詳しく
const all = [...ids];
for (let i = 0; i < all.length; i += 20) {
  const x = await get(`thing?id=${all.slice(i, i + 20).join(",")}`);
  for (const it of x.split("<item ").slice(1)) {
    const id = it.match(/id="(\d+)"/)[1];
    const pubs = [...it.matchAll(/type="boardgamepublisher" id="\d+" value="([^"]*)"/g)].map((m) => m[1]);
    if (!pubs.some((p) => /oink/i.test(p))) continue;
    const name = it.match(/<name type="primary"[^>]*value="([^"]*)"/)?.[1];
    const ja = [...it.matchAll(/<name type="alternate"[^>]*value="([^"]*)"/g)].map((m) => m[1]).filter((n) => /[぀-ヿ一-鿿]/.test(n));
    const yr = it.match(/yearpublished value="(\d+)"/)?.[1];
    console.log(`OINK ${id} ${name} ${yr} ${ja.join(" / ")}`);
  }
  await sleep(1500);
}
