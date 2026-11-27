// 一時的な調査用（終わったら削除）
const TOKEN = process.env.BGG_TOKEN;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) { for (let i = 0; i < 5; i++) { const r = await fetch("https://boardgamegeek.com/xmlapi2/" + path, { headers: { Authorization: `Bearer ${TOKEN}` } }); if (r.status === 202 || r.status === 429) { await sleep(3000); continue; } return await r.text(); } return ""; }
for (const q of ["Deep Sea Adventure", "海底探険"]) {
  const x = await get(`search?type=boardgame,boardgameexpansion,boardgameaccessory&query=${encodeURIComponent(q)}`);
  console.log(`\n## ${q}`);
  for (const m of x.matchAll(/<item type="(\w+)" id="(\d+)">\s*<name type="\w+" value="([^"]*)"\s*\/>\s*(?:<yearpublished value="(\d+)")?/g)) console.log(`${m[1]} ${m[2]} ${m[3]} ${m[4] || ""}`);
  await sleep(1500);
}
