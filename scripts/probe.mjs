// 一時的な調査用（終わったら削除）
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "Mozilla/5.0 (bg-board personal collection viewer)" };
for (const t of ["ひらがじゃん", "テストプレイなんてしてないよ", "狩歌", "16 Tabby Cats", "タビーキャッツ", "ことばおとし", "人狼 バトルロイヤル", "Ichigorilla", "いちごリラ"]) {
  for (let page = 1; page <= 2; page++) {
    const h = await (await fetch(`https://bodoge.hoobby.net/games?search%5Bfreeword%5D=${encodeURIComponent(t)}&page=${page}`, { headers: UA })).text();
    const hits = [...new Map([...h.matchAll(/href="\/games\/([a-z0-9-]+)"[^>]*>([\s\S]{0,300}?)<\/a>/g)].map((m) => [m[1], m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 45)])).entries()].filter(([k, v]) => v && !/^(splendor|die-siedler|dominion|terraforming|battle-line|6-nimmt)/.test(k));
    console.log(`## ${t} p${page}: ${hits.map(([k, v]) => `${k}=${v}`).join(" | ")}`);
    await sleep(800);
  }
}
// 画像の大きさ違い
const base = "https://image-bodoge.cdn-hoobby.net/";
for (const p of ["small_light(dw=500,dh=500,da=l,ds=s)/", "small_light(dw=400)/", "", "small_light(dw=1200,dh=630,cw=1200,ch=630,da=s,ds=s,q=90,cc=FFFFFF)/"]) {
  const r = await fetch(base + p + "picture_5cf2d151-fe8d-4dc4-b523-343b7cf6427a.jpg", { headers: UA });
  const b = Buffer.from(await r.arrayBuffer());
  // JPEG の大きさ（SOF）
  let w = 0, hh = 0; for (let i = 2; i < b.length - 9; i++) if (b[i] === 0xff && b[i + 1] >= 0xc0 && b[i + 1] <= 0xc2) { hh = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; }
  console.log(`## img [${p}] ${r.status} ${r.headers.get("content-type")} ${b.length}B ${w}x${hh}`);
}
