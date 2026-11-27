// 一時的な調査用（終わったら削除）
const TOKEN = process.env.BGG_TOKEN;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) { for (let i = 0; i < 6; i++) { const r = await fetch("https://boardgamegeek.com/xmlapi2/" + path, { headers: { Authorization: `Bearer ${TOKEN}` } }); if (r.status === 202 || r.status === 429) { await sleep(3000); continue; } return await r.text(); } return ""; }
const Q = ["ビルドウォー","Build War","デックローグ","Deck Rogue","グミチョコパパイヤ","12王国の玉座","あいうえバトル","Excalibur","Kings","私の世界の見方","Terraforming Mars Big Box","おばけキャッチ","ことば落とし","クレーンゲーム","ごいた","Millennium Blades Set Rotation","Meister Scheibenkleister","Kittin","アルゴ","Cucco","クク21","犯人は踊る","音速飯店","コヨーテ","Illusion","Lost Ruins of Arnak","Splendor Duel","いちごりら","Orapa Mine","ステレオマインド","Stereo Mind","チェスレース","Pentorini","Skull King","Splendor","Fischen","Deep Dive","Point Galaxy","Ganz schön clever","One Round","Super Mega Lucky Box","ロケット団","A Feast for Odin","Caverna","Mölkky","Viking See-Saw","Geistesblitz 2.0","テストプレイなんてしてないよ","Gachapon Trick","Bohnanza","Logis","One to Five","The Crew Mission Deep Sea","Arcs"];
const hits = new Map();
for (const q of Q) {
  const x = await get(`search?type=boardgame,boardgameexpansion,boardgameaccessory&query=${encodeURIComponent(q)}`);
  const items = [...new Map([...x.matchAll(/<item type="(\w+)" id="(\d+)">\s*<name type="\w+" value="([^"]*)"\s*\/>\s*(?:<yearpublished value="(\d+)")?/g)].map((m) => [m[2], m])).values()];
  console.log(`\n## ${q} (${items.length})`);
  for (const m of items.slice(0, 12)) { console.log(`${m[1].replace("boardgame","")} ${m[2]} ${m[3]} ${m[4] || ""}`); hits.set(m[2], 1); }
  await sleep(1200);
}
// 日本語名・出版社を確認（多いので先頭から最大300件）
const all = [...hits.keys()].slice(0, 300);
for (let i = 0; i < all.length; i += 20) {
  const x = await get(`thing?id=${all.slice(i, i + 20).join(",")}`);
  for (const it of x.split("<item ").slice(1)) {
    const id = it.match(/id="(\d+)"/)[1];
    const ja = [...it.matchAll(/<name type="alternate"[^>]*value="([^"]*)"/g)].map((m) => m[1]).filter((n) => /[぀-ヿ]/.test(n));
    if (!ja.length) continue;
    const name = it.match(/<name type="primary"[^>]*value="([^"]*)"/)?.[1];
    const yr = it.match(/yearpublished value="(\d+)"/)?.[1];
    console.log(`JA ${id} ${name} ${yr} | ${ja.slice(0, 4).join(" / ")}`);
  }
  await sleep(1500);
}
