// 一時的な調査用（終わったら削除）
const TOKEN = process.env.BGG_TOKEN;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "Mozilla/5.0 (bg-board personal collection viewer)" };
async function bgg(path) { for (let i = 0; i < 6; i++) { const r = await fetch("https://boardgamegeek.com/xmlapi2/" + path, { headers: { Authorization: `Bearer ${TOKEN}` } }); if (r.status === 202 || r.status === 429) { await sleep(3000); continue; } return await r.text(); } return ""; }
const T = ["ひらがじゃん", "狩歌 パラダイムシフト", "パラダイムシフト", "ひらがなポーカー", "人狼バトルロイヤル", "16タビーキャッツ", "Kings", "ことば落とし", "いちごりら", "テストプレイなんてしてないよ", "ログ"];
for (const t of T) {
  const r = await fetch("https://bodoge.hoobby.net/games?search%5Bfreeword%5D=" + encodeURIComponent(t), { headers: UA });
  const h = await r.text();
  const hits = [...new Map([...h.matchAll(/href="\/games\/([a-z0-9-]+)"[^>]*>([\s\S]{0,300}?)<\/a>/g)].map((m) => [m[1], m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 50)])).entries()].filter(([, v]) => v).slice(0, 6);
  console.log(`## ${t} ${r.status}: ${hits.map(([k, v]) => `${k}=${v}`).join(" | ")}`);
  for (const [slug] of hits.slice(0, 2)) {
    const g = await (await fetch(`https://bodoge.hoobby.net/games/${slug}`, { headers: UA })).text();
    console.log(`##   ${slug} og:image=${g.match(/property="og:image" content="([^"]+)"/)?.[1]} title=${g.match(/<title>([^<]*)/)?.[1]?.slice(0, 60)}`);
    await sleep(800);
  }
  await sleep(800);
}
