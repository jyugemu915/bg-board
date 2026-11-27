// 一時的な調査用：BGGのスリーブ情報の取り方を探す（終わったら削除）
const UA = { "User-Agent": "Mozilla/5.0 (bg-board probe)", Accept: "application/json, text/html, */*" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, n = 600) {
  try {
    const r = await fetch(url, { headers: UA });
    const t = await r.text();
    console.log("\n=== ", r.status, url, "len", t.length, "\n", t.slice(0, n).replace(/\s+/g, " "));
    return t;
  } catch (e) { console.log("ERR", url, e.message); return ""; }
}
const ids = [13, 266192, 230802]; // Catan, Wingspan, Azul
const id = ids[1];
for (const p of [
  `https://api.geekdo.com/api/sleeves?objectid=${id}&objecttype=thing`,
  `https://api.geekdo.com/api/cardsets?objectid=${id}&objecttype=thing`,
  `https://api.geekdo.com/api/geekitem/sleeves?objectid=${id}&objecttype=thing`,
  `https://api.geekdo.com/api/cardsleeves?objectid=${id}&objecttype=thing`,
  `https://api.geekdo.com/api/sleevedata?objectid=${id}&objecttype=thing`,
]) { await get(p); await sleep(1000); }
// ゲームページのJSから "sleeve" を含む呼び出しを探す
const html = await get(`https://boardgamegeek.com/boardgame/${id}`, 300);
const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => new URL(m[1], "https://boardgamegeek.com").href))];
console.log("scripts", scripts.length, scripts.slice(0, 40).join("\n"));
const hits = new Set();
for (const s of scripts) {
  const js = await get(s, 0);
  for (const m of js.matchAll(/.{0,160}sleeve.{0,160}/gi)) { const k = m[0]; if (/api|url|\/|path|endpoint/i.test(k)) hits.add(s.split("/").pop() + " :: " + k); }
  await sleep(300);
}
console.log("\n#### HITS", hits.size);
for (const h of [...hits].slice(0, 80)) console.log(h);
