// 一時的な調査用（終わったら削除）
const TOKEN = process.env.BGG_TOKEN;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "Mozilla/5.0 (bg-board personal collection viewer)" };
async function bgg(path) { for (let i = 0; i < 6; i++) { const r = await fetch("https://boardgamegeek.com/xmlapi2/" + path, { headers: { Authorization: `Bearer ${TOKEN}` } }); if (r.status === 202 || r.status === 429) { await sleep(3000); continue; } return await r.text(); } return ""; }
const x = await bgg("search?type=boardgame&query=Mythical%20Dice");
console.log("## Mythical Dice", [...x.matchAll(/id="(\d+)">\s*<name type="\w+" value="([^"]*)"\s*\/>\s*(?:<yearpublished value="(\d+)")?/g)].map((m) => `${m[1]} ${m[2]} ${m[3]}`).join(" / "));
// ボードゲーマ：検索フォームの作り
const top = await (await fetch("https://bodoge.hoobby.net/games", { headers: UA })).text();
console.log("## forms", [...top.matchAll(/<form[^>]*>[\s\S]{0,1500}?<\/form>/g)].map((m) => m[0].replace(/\s+/g, " ").match(/action="[^"]*"|name="[^"]*"/g)?.join(" ")).join("\n"));
const T = ["ひらがじゃん", "狩歌 パラダイムシフト", "パラダイムシフト", "ひらがなポーカー", "人狼バトルロイヤル", "16タビーキャッツ", "Kings", "ことば落とし", "いちごりら", "テストプレイなんてしてないよ", "ログ"];
for (const t of T) {
  for (const q of [`games?search%5Bname%5D=${encodeURIComponent(t)}`, `games?keyword=${encodeURIComponent(t)}`, `games/search?q=${encodeURIComponent(t)}`]) {
    const r = await fetch("https://bodoge.hoobby.net/" + q, { headers: UA });
    const h = await r.text();
    const hits = [...new Set([...h.matchAll(/href="\/games\/([a-z0-9-]+)"[^>]*>([\s\S]{0,200}?)<\/a>/g)].map((m) => `${m[1]}=${m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 30)}`))].filter((s) => !/=$/.test(s)).slice(0, 8);
    console.log(`## ${t} [${q.split("?")[0]}?${q.split("?")[1].split("=")[0]}] ${r.status}: ${hits.join(" | ")}`);
    await sleep(800);
  }
}
