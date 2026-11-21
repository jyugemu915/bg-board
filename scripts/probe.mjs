const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
for (const u of ["https://bodofun.hoobby.net/", "https://bodofun.hoobby.net/projects", "https://bodofun.hoobby.net/projects/majority-magicgirl-darkside"]) {
  const r = await fetch(u, { headers: { "User-Agent": UA } }); const t = await r.text();
  console.log("==", r.status, u, t.length);
  const i = t.indexOf("project-block-cassette"); if (i >= 0) console.log(t.slice(i - 300, i + 2500).replace(/\s+/g, " "));
  console.log("slugs:", [...new Set([...t.matchAll(/href="\/projects\/([\w-]+)"/g)].map((m) => m[1]))].join(","));
  if (u.endsWith("darkside")) { for (const k of ["目標", "終了", "支援者", "達成率", "残り", "開始"]) { const j = t.indexOf(k); if (j >= 0) console.log(`[${k}]`, t.slice(j - 100, j + 250).replace(/\s+/g, " ")); } console.log((t.match(/<meta[^>]+og:[^>]+>/gi)||[]).join("\n")); }
}
