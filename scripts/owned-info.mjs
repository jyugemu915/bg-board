// 所持ゲームの詳細（英語名・日本語名・人数・推奨人数・時間・発売年・重さ・評価・メカニクス・カテゴリー・デザイナー・アーティスト・出版社・説明文・版ごとの箱絵・拡張一覧）を
// BGG から取って data/owned-info.json に貯める
// 対象：config/owned.json の bgg（URL）から読み取った ID。所持ゲームの拡張一覧に出てくる拡張は簡易情報（exps）だけ取る
import { readFile, writeFile } from "node:fs/promises";

const TOKEN = process.env.BGG_TOKEN;
if (!TOKEN) { console.log("BGG_TOKEN が未設定のためスキップ"); process.exit(0); }
const MAX = 50;              // 1回の実行で取得する件数
const REFRESH_DAYS = 60;     // 取り直すまでの日数
const MAX_VERSIONS = 24;     // 箱絵の候補として残す版の数
const SCHEMA = 3;            // 取得項目を増やしたら上げる（全件取り直し）
const EXP_BATCHES = 15;      // 拡張の簡易情報：1回の実行で取る束の数（1束20件）
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dec1 = (s = "") => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—")
  .replace(/&hellip;/g, "…").replace(/&rsquo;|&lsquo;/g, "'").replace(/&rdquo;|&ldquo;/g, '"').replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const dec = (s = "") => dec1(dec1(s));   // 説明文は二重にエスケープされている
const read = (p, d) => readFile(new URL(p, import.meta.url)).then((b) => JSON.parse(b)).catch(() => d);
const idOf = (url) => String(url || "").match(/boardgame(?:expansion|accessory)?\/(\d+)/)?.[1];

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
// 説明文：改行を整えて長すぎる分は切る
const desc = (xml) => {
  const t = text(xml, "description").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return t.length > 1500 ? t.slice(0, 1500).replace(/\s+\S*$/, "") + "…" : t;
};

async function info(id) {
  const xml = await api(`thing?id=${id}&versions=1&stats=1`);
  // 版の一覧（<versions>）と本体の情報を分ける。評価などの <statistics> は版の一覧の後ろにある
  const vers = xml.match(/<versions>[\s\S]*?<\/versions>/)?.[0] || "";
  const main = xml.replace(vers, "");
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
  const links = (type) => [...main.matchAll(new RegExp(`<link type="${type}" id="(\\d+)" value="([^"]*)"( inbound="true")?`, "g"))];
  const range = (re) => main.match(re)?.[1]?.replace(/[–-]/g, "〜") || "";
  return {
    v: SCHEMA,
    id: String(id), type: main.match(/<item type="(\w+)"/)?.[1] || "",
    best: range(/name="bestwith" value="Best with ([^"]*?) players?"/), rec: range(/name="recommm?endedwith" value="Recommended with ([^"]*?) players?"/),
    minTime: +attr(main, "minplaytime") || null, maxTime: +attr(main, "maxplaytime") || null, age: +attr(main, "minage") || null,
    rating: +(+attr(main, "average")).toFixed(2) || null, weight: +(+attr(main, "averageweight")).toFixed(2) || null,
    rank: +main.match(/<rank type="subtype"[^>]*name="boardgame"[^>]*value="(\d+)"/)?.[1] || null,
    mechanics: links("boardgamemechanic").map((m) => dec(m[2])), categories: links("boardgamecategory").map((m) => dec(m[2])),
    designers: links("boardgamedesigner").map((m) => dec(m[2])).filter((x) => x !== "(Uncredited)"),
    artists: links("boardgameartist").map((m) => dec(m[2])).filter((x) => x !== "(Uncredited)").slice(0, 10),
    publishers: links("boardgamepublisher").map((m) => dec(m[2])).filter((x) => !/^\((Unknown|Self-Published|Public Domain)\)$/.test(x)).slice(0, 12),
    families: links("boardgamefamily").map((m) => dec(m[2])).filter((x) => !/^(Admin|Players|Crowdfunding|Digital Implementations|Misc|Versions)/.test(x)).slice(0, 12),
    desc: desc(main),
    expansions: links("boardgameexpansion").filter((m) => !m[3]).map((m) => ({ id: m[1], name: dec(m[2]) })),
    bases: links("boardgameexpansion").filter((m) => m[3]).map((m) => ({ id: m[1], name: dec(m[2]) })),
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
  if (cur && cur.v === SCHEMA && Date.now() - Date.parse(cur.at) < REFRESH_DAYS * 864e5) continue;
  if (n >= MAX) break;
  n++;
  try {
    db.games[id] = await info(id);
    console.log("OK ", id, db.games[id].en, `${db.games[id].minp}-${db.games[id].maxp}人`, `版${db.games[id].versions.length}`);
  } catch (e) { console.log("ERR", id, e.message); if (/401|403/.test(e.message)) break; }
  await sleep(2500);
}
// 拡張の簡易情報（英語名・箱絵・人数・発売年）を20件ずつまとめて取得
db.exps ||= {};
const expIds = [...new Set(Object.values(db.games).flatMap((g) => (g.expansions || []).map((e) => e.id)))]
  .filter((id) => !db.games[id] && (!db.exps[id] || Date.now() - Date.parse(db.exps[id].at) > REFRESH_DAYS * 864e5));
let nb = 0;
for (let i = 0; i < expIds.length && nb < EXP_BATCHES; i += 20, nb++) {
  try {
    const xml = await api(`thing?id=${expIds.slice(i, i + 20).join(",")}`);
    for (const [, id, it] of xml.matchAll(/<item type="\w+" id="(\d+)">([\s\S]*?)<\/item>/g)) {
      db.exps[id] = { id, en: attr(it, "name", "primary"), thumb: text(it, "thumbnail"), year: +attr(it, "yearpublished") || null,
        minp: +attr(it, "minplayers") || null, maxp: +attr(it, "maxplayers") || null, time: +attr(it, "playingtime") || null, at: new Date().toISOString() };
    }
  } catch (e) { console.log("ERR exps", e.message); break; }
  await sleep(2500);
}
console.log(`exps: ${Object.keys(db.exps).length}（残り ${Math.max(0, expIds.length - nb * 20)}）`);
db.updatedAt = new Date().toISOString();
await writeFile(new URL("../data/owned-info.json", import.meta.url), JSON.stringify(db, null, 1));
console.log(`fetched ${n}, total ${Object.keys(db.games).length}`);
