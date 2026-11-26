// 所持ゲームの詳細（英語名・日本語名・人数・時間・版ごとの箱絵）を BGG から取って data/owned-info.json に貯める
// 対象：config/owned.json の bgg（URL）から読み取った ID
import { readFile, writeFile } from "node:fs/promises";

const TOKEN = process.env.BGG_TOKEN;
if (!TOKEN) { console.log("BGG_TOKEN が未設定のためスキップ"); process.exit(0); }
const MAX = 40;              // 1回の実行で取得する件数
const REFRESH_DAYS = 60;     // 取り直すまでの日数
const MAX_VERSIONS = 24;     // 箱絵の候補として残す版の数
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dec = (s = "") => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const read = (p, d) => readFile(new URL(p, import.meta.url)).then((b) => JSON.parse(b)).catch(() => d);
const idOf = (url) => String(url || "").match(/boardgame(?:expansion)?\/(\d+)/)?.[1];

async function api(path) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch("https://boardgamegeek.com/xmlapi2/" + path, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (res.status === 202 || res.status === 429) { await sleep(5000); continue; }
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return await res.text();
  }
  throw new Error("BGGが混雑しています");
}
const attr = (xml, tag, type) => dec(xml.match(new RegExp(`<${tag}${type ? ` type="${type}"` : ""}[^>]*value="([^"]*)"`))?.[1] || "");
const text = (xml, tag) => dec(xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1] || "").trim();

async function info(id) {
  const xml = await api(`thing?id=${id}&versions=1`);
  const [main, vers = ""] = xml.split("<versions>");
  const alts = [...main.matchAll(/<name type="alternate"[^>]*value="([^"]*)"/g)].map((m) => dec(m[1]));
  const versions = [...vers.matchAll(/<item type="boardgameversion" id="(\d+)">([\s\S]*?)<\/item>/g)].map(([, vid, v]) => ({
    id: vid, name: attr(v, "name", "primary"), year: +attr(v, "yearpublished") || null,
    lang: [...v.matchAll(/<link type="language"[^>]*value="([^"]*)"/g)].map((m) => dec(m[1])).join("・"),
    thumb: text(v, "thumbnail"), image: text(v, "image"),
  })).filter((v) => v.thumb && !/nophoto|noimage/i.test(v.thumb));
  // 日本語版を先頭に、あとは新しい順。同じ画像は1つに
  const seen = new Set();
  const picked = versions.sort((a, b) => (/Japanese/.test(b.lang) - /Japanese/.test(a.lang)) || ((b.year || 0) - (a.year || 0)))
    .filter((v) => !seen.has(v.thumb) && seen.add(v.thumb)).slice(0, MAX_VERSIONS);
  return {
    id: String(id), type: main.match(/<item type="(\w+)"/)?.[1] || "",
    en: attr(main, "name", "primary"), ja: alts.find((n) => /[぀-ヿ]/.test(n)) || "",
    minp: +attr(main, "minplayers") || null, maxp: +attr(main, "maxplayers") || null,
    time: +attr(main, "playingtime") || null, year: +attr(main, "yearpublished") || null,
    thumb: text(main, "thumbnail"), image: text(main, "image"), versions: picked, at: new Date().toISOString(),
  };
}

const owned = await read("../config/owned.json", { games: [] });
const db = await read("../data/owned-info.json", { games: {} });
const ids = [...new Set((owned.games || []).map((g) => idOf(g.bgg)).filter(Boolean))];
let n = 0;
for (const id of ids) {
  const cur = db.games[id];
  if (cur && Date.now() - Date.parse(cur.at) < REFRESH_DAYS * 864e5) continue;
  if (n >= MAX) break;
  n++;
  try {
    db.games[id] = await info(id);
    console.log("OK ", id, db.games[id].en, `${db.games[id].minp}-${db.games[id].maxp}人`, `版${db.games[id].versions.length}`);
  } catch (e) { console.log("ERR", id, e.message); if (/401|403/.test(e.message)) break; }
  await sleep(2500);
}
db.updatedAt = new Date().toISOString();
await writeFile(new URL("../data/owned-info.json", import.meta.url), JSON.stringify(db, null, 1));
console.log(`fetched ${n}, total ${Object.keys(db.games).length}`);
