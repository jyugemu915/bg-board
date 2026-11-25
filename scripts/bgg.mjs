// BoardGameGeek からゲーム名で検索して箱絵を取得し、data/bgg.json に貯める
// 必要：GitHub の Secrets に BGG_TOKEN（https://boardgamegeek.com/applications で発行）
import { readFile, writeFile } from "node:fs/promises";

const TOKEN = process.env.BGG_TOKEN;
if (!TOKEN) { console.log("BGG_TOKEN が未設定のためスキップ"); process.exit(0); }
const MAX_LOOKUPS = 30;          // 1回の実行で新しく調べる件数
const RETRY_MISS_DAYS = 14;      // 見つからなかった名前を再検索するまでの日数
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || "").normalize("NFKC").toLowerCase().replace(/[\s・:：\-－〜~!！?？「」『』【】()（）\[\]、。,.]/g, "");
const dec = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function api(path) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch("https://boardgamegeek.com/xmlapi2/" + path, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (res.status === 202 || res.status === 429) { await sleep(5000); continue; }   // 準備中・混雑
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return await res.text();
  }
  throw new Error("BGGが混雑しています");
}

// ゲーム名の候補（「：」の前だけ、【】や「日本語版」を除いたもの）
function variants(name) {
  const base = name.replace(/【[^】]*】|\[[^\]]*\]|（[^）]*）|\([^)]*\)/g, "")
    .replace(/完全日本語版|日本語版|和訳ルール付き|和訳付き|新版|拡張セット/g, "").replace(/\s+/g, " ").trim();
  const out = [base];
  const head = base.split(/[：:]/)[0].trim();
  if (head && head !== base) out.push(head);
  const first = head.split(" ")[0];
  if (first && first !== head) out.push(first);
  return [...new Set(out.filter((x) => x.length >= 2))];
}
// 日本語名→英語名（またはBGGのID）の対応表で置き換え
function aliasFor(name) {
  for (const v of [name, ...variants(name)]) { const a = ALIASES[norm(v)]; if (a) return a; }
  return null;
}

async function thingById(id, q) {
  const thing = await api(`thing?id=${id}`);
  await sleep(2500);
  return { id: String(id), name: dec(thing.match(/<name type="primary"[^>]*value="([^"]*)"/)?.[1] || ""),
    image: dec(thing.match(/<image>([^<]+)<\/image>/)?.[1] || ""), thumb: dec(thing.match(/<thumbnail>([^<]+)<\/thumbnail>/)?.[1] || ""),
    query: q, at: new Date().toISOString() };
}

async function lookup(name) {
  const alias = aliasFor(name);
  if (alias && /^\d+$/.test(String(alias))) return await thingById(alias, "id:" + alias);
  for (const q of alias ? [alias] : variants(name)) {
    const xml = await api(`search?query=${encodeURIComponent(q)}&type=boardgame,boardgameexpansion`);
    await sleep(2500);
    const items = [...xml.matchAll(/<item type="([^"]+)" id="(\d+)">([\s\S]*?)<\/item>/g)].map((m) => ({
      type: m[1], id: m[2], name: dec(m[3].match(/<name[^>]*value="([^"]*)"/)?.[1] || ""),
      year: +(m[3].match(/<yearpublished value="(\d+)"/)?.[1] || 0),
    }));
    if (!items.length) continue;
    const k = norm(q);
    // 名前が完全一致するもの → 前方一致 → 新しい年のもの
    const pick = items.find((i) => norm(i.name) === k) || items.find((i) => norm(i.name).startsWith(k))
      || items.sort((a, b) => b.year - a.year)[0];
    const thing = await api(`thing?id=${pick.id}`);
    await sleep(2500);
    const image = dec(thing.match(/<image>([^<]+)<\/image>/)?.[1] || "");
    const thumb = dec(thing.match(/<thumbnail>([^<]+)<\/thumbnail>/)?.[1] || "");
    const primary = dec(thing.match(/<name type="primary"[^>]*value="([^"]*)"/)?.[1] || pick.name);
    return { id: pick.id, name: primary, image, thumb, query: q, at: new Date().toISOString() };
  }
  return { miss: true, at: new Date().toISOString() };
}

const read = (p, d) => readFile(new URL(p, import.meta.url)).then((b) => JSON.parse(b)).catch(() => d);
const news = await read("../data/news.json", {});
const extra = await read("../config/bgg-names.json", { names: [] });
const db = await read("../data/bgg.json", { games: {} });
const ALIASES = Object.fromEntries(Object.entries(extra.aliases || {}).map(([k, v]) => [norm(k), v]));

// 調べる名前：発売カレンダー → 手動リスト（所持・気になる）→ ショップの商品名
const names = [
  ...(news.releases || []).map((r) => r.game),
  ...(extra.names || []),
  ...(news.items || []).filter((i) => i.label === "ショップ").map((i) => i.title),
];
let n = 0;
for (const name of [...new Set(names)]) {
  const key = norm(name);
  if (!key) continue;
  const cur = db.games[key];
  const alias = aliasFor(name);
  if (cur && !cur.miss && (!alias || cur.alias === String(alias))) continue;
  if (cur?.miss && !alias && Date.now() - Date.parse(cur.at) < RETRY_MISS_DAYS * 864e5) continue;
  if (cur?.miss && alias && cur.alias === String(alias)) continue;
  if (n >= MAX_LOOKUPS) break;
  n++;
  try {
    db.games[key] = { label: name, ...(await lookup(name)), ...(alias ? { alias: String(alias) } : {}) };
    console.log(db.games[key].miss ? "MISS" : "OK  ", name, "→", db.games[key].name || "", db.games[key].id || "");
  } catch (e) { console.log("ERR ", name, e.message); if (/401|403/.test(e.message)) break; }
}
db.updatedAt = new Date().toISOString();
await writeFile(new URL("../data/bgg.json", import.meta.url), JSON.stringify(db, null, 1));
console.log(`looked up ${n}, total ${Object.keys(db.games).length}`);
