const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const urls = [
  "https://bodofun.hoobby.net/",
  "https://www.kickstarter.com/projects/nerdgear/stoneforge-tcg-backpack-by-nerd-gear",
  "https://www.kickstarter.com/projects/nerdgear/stoneforge-tcg-backpack-by-nerd-gear/stats.json?v=1",
  "https://gamefound.com/en/projects/roxley/brass-pittsburgh",
  "https://gamefound.com/en/projects/ludic-dragon-games/space-universalis",
];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA, Accept: "text/html,application/json,*/*", "Accept-Language": "ja,en" } });
    const t = await r.text();
    console.log("==", r.status, u, t.length);
    const metas = (t.match(/<meta[^>]+(og:|twitter:)[^>]+>/gi) || []).slice(0, 8).join("\n");
    console.log(metas.slice(0, 1200));
    for (const k of ["backers", "pledged", "fundsGathered", "backerCount", "goal", "deadline", "endDate", "campaignEnd", "percent", "達成", "支援者", "残り", "/projects/"]) {
      const i = t.indexOf(k); if (i >= 0) console.log(`[${k}]`, t.slice(Math.max(0, i - 120), i + 160).replace(/\s+/g, " "));
    }
    if (u.includes("stats.json")) console.log(t.slice(0, 500));
  } catch (e) { console.log("ERR", u, e.message); }
}
