const T = process.env.BGG_TOKEN; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const q of JSON.parse(process.env.QS)) {
  let xml = "";
  for (let i = 0; i < 4; i++) { const r = await fetch("https://boardgamegeek.com/xmlapi2/search?type=boardgame,boardgameexpansion&query=" + encodeURIComponent(q), { headers: { Authorization: `Bearer ${T}` } }); if (r.status === 202 || r.status === 429) { await sleep(5000); continue; } xml = await r.text(); break; }
  const items = [...xml.matchAll(/<item type="([^"]+)" id="(\d+)">([\s\S]*?)<\/item>/g)].filter((m) => m[1] === "boardgame").map((m) => `${m[2]}|${m[3].match(/value="([^"]*)"/)?.[1]}|${m[3].match(/<yearpublished value="(\d+)"/)?.[1] || ""}`);
  console.log(`## ${q} (${items.length})\n  ` + items.slice(0, 7).join("\n  "));
  await sleep(2500);
}
