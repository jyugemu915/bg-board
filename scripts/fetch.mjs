// 情報源から記事・ショップ商品を取得して data/news.json に書き出す（GitHub Actions で定期実行）
import { readFile, writeFile } from "node:fs/promises";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAX_ARTICLES = 20;
const MAX_SHOP = 60;
const KEEP_RELEASE_DAYS = 365;
const NOW = new Date();
const nowIso = NOW.toISOString();

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return await res.text();
}

const unescapeXml = (s = "") => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");
const text = (s = "") => unescapeXml(unescapeXml(s).replace(/<[^>]+>/g, " ")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (xml, name) => xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1] || "";

function firstImage(block) {
  const m = block.match(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"/i)
    || block.match(/<enclosure[^>]+url="([^"]+\.(?:jpe?g|png|webp|gif)[^"]*)"/i)
    || unescapeXml(block).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

function parseFeed(xml) {
  const items = [];
  for (const b of xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []) {
    items.push({
      title: text(tag(b, "title")),
      url: text(tag(b, "link")) || text(tag(b, "guid")),
      date: text(tag(b, "pubDate")) || text(tag(b, "dc:date")),
      body: text(tag(b, "description") || tag(b, "content:encoded")).slice(0, 400),
      image: firstImage(b),
    });
  }
  for (const b of xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || []) {
    const link = b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) || b.match(/<link[^>]*href="([^"]+)"/i);
    items.push({
      title: text(tag(b, "title")), url: link ? link[1] : "",
      date: text(tag(b, "published")) || text(tag(b, "updated")),
      body: text(tag(b, "summary") || tag(b, "content")).slice(0, 400), image: firstImage(b),
    });
  }
  return items.filter((i) => i.title && i.url);
}

async function findFeed(site) {
  const html = await get(site);
  const l = [...html.matchAll(/<link[^>]+>/gi)].map((x) => x[0])
    .find((x) => /rel=["']alternate["']/i.test(x) && /(rss|atom)\+xml/i.test(x));
  const href = l?.match(/href=["']([^"']+)["']/i)?.[1];
  return href ? new URL(href, site).href : new URL("feed/", site).href;
}

// ---- 発売日の読み取り ----
// 「12月11日発売」「10月下旬発売」「2027年3月発売予定」「11/27発売」など
const PART = { 上旬: 5, 中旬: 15, 下旬: 25, 末: 28, 頃: 15 };
function findRelease(str, baseIso) {
  const base = baseIso ? new Date(baseIso) : NOW;
  const re = /(?:(\d{4})年)?\s*(\d{1,2})(?:月|\/)\s*(?:(\d{1,2})日?|(上旬|中旬|下旬|末|頃))?\s*(?:に|より|から)?\s*(発売|再販|出荷|発送|予約開始|販売開始|入荷)/;
  const m = str.match(re);
  if (!m) return null;
  const [, y, mo, d, part, kind] = m;
  const month = +mo;
  if (month < 1 || month > 12) return null;
  let year = y ? +y : base.getFullYear();
  const day = d ? +d : PART[part] || 15;
  let dt = new Date(Date.UTC(year, month - 1, day));
  // 年が書かれていなければ、記事日付から見て −6か月〜+12か月 に収まる年を選ぶ
  if (!y && dt - base < -1000 * 60 * 60 * 24 * 183) dt = new Date(Date.UTC(++year, month - 1, day));
  const label = `${y ? year + "年" : ""}${month}月${d ? d + "日" : part || ""}`;
  return { date: dt.toISOString().slice(0, 10), label, exact: !!d, kind };
}
const gameName = (title) => title.match(/[『「]([^』」]+)[』」]/)?.[1]?.trim() || title.replace(/\s*(日本語版|和訳ルール付き).*/, "").trim();

// ---- 取得 ----
async function collectFeed(src, kind) {
  const out = { name: src.name, channel: "記事", kind, ok: false, error: "", feed: "" };
  try {
    const feed = src.rss || await findFeed(src.site);
    out.feed = feed;
    const items = parseFeed(await get(feed)).slice(0, MAX_ARTICLES).map((i) => {
      const t = Date.parse(i.date);
      const date = isNaN(t) ? null : new Date(t).toISOString();
      const release = findRelease(i.title, date) || findRelease(i.body, date);
      const { body, ...rest } = i;
      return { ...rest, date, source: src.name, kind, label: "記事", release };
    });
    out.ok = items.length > 0;
    if (!out.ok) out.error = "記事が見つかりません";
    return { status: out, items };
  } catch (e) { out.error = String(e.message || e); return { status: out, items: [] }; }
}

async function scrapeShop(url) {
  const html = await get(url);
  const seen = new Map();
  for (const m of html.matchAll(/<a[^>]*href="([^"]*\/items\/(\d+))"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, href, id, inner] = m;
    const img = inner.match(/<img[^>]+(?:data-src|src)="([^"]+)"/i)?.[1] || "";
    const alt = inner.match(/<img[^>]+alt="([^"]*)"/i)?.[1] || "";
    const t = text(inner) || text(alt);
    const prev = seen.get(id);
    if (!prev) seen.set(id, { raw: t, url: new URL(href, url).href, image: img });
    else { if (!prev.raw && t) prev.raw = t; if (!prev.image && img) prev.image = img; }
  }
  return [...seen.values()].filter((i) => i.raw);
}

// 状態：soon=近日/予約前, sale=販売中, sold=売切
function shopStatus(rest) {
  if (/SOLD\s*OUT|売り?切れ/i.test(rest)) return "sold";
  if (/COMING\s*SOON|近日|予約/i.test(rest)) return "soon";
  return "sale";
}

async function collectShop(src, kind, state) {
  const out = { name: src.name, channel: "ショップ", kind, ok: false, error: "", feed: src.shop };
  try {
    const host = new URL(src.shop).host;
    const firstRun = !Object.keys(state).some((u) => u.includes(host));
    const items = (await scrapeShop(src.shop)).slice(0, MAX_SHOP).map((i) => {
      const [name, rest = ""] = i.raw.split(/\s+JPY\s+|\s+¥/);
      const price = rest.match(/^([\d,]+)/)?.[1];
      const status = shopStatus(rest + " " + i.raw);
      const prev = state[i.url];
      const s = prev ? { ...prev } : { firstSeen: firstRun ? null : nowIso, status: null, since: null, saleAt: null };
      if (s.status !== status) {
        // 近日→販売中 になった時、または初回以外で新しく販売中で現れた時を「発売（入荷）日」として記録
        if (status === "sale" && (prev?.status === "soon" || (!prev && !firstRun))) s.saleAt = nowIso;
        s.status = status; s.since = prev || !firstRun ? nowIso : null;
      }
      state[i.url] = s;
      return { title: name.trim(), url: i.url, image: i.image, price: price ? price + "円" : "", status,
        firstSeen: s.firstSeen, saleAt: s.saleAt, date: s.saleAt || s.firstSeen, source: src.name, kind, label: "ショップ" };
    });
    out.ok = items.length > 0;
    if (!out.ok) out.error = "商品が見つかりません";
    return { status: out, items };
  } catch (e) { out.error = String(e.message || e); return { status: out, items: [] }; }
}

// ---- 実行 ----
const cfg = JSON.parse(await readFile(new URL("../config/sources.json", import.meta.url)));
const dataUrl = new URL("../data/news.json", import.meta.url);
const old = await readFile(dataUrl).then((b) => JSON.parse(b)).catch(() => ({}));
// 旧形式(seen)からの引き継ぎ
const shopState = old.shopState || Object.fromEntries(Object.entries(old.seen || {}).map(([u, d]) => [u, { firstSeen: d === "first" ? null : d, status: null, since: null, saleAt: null }]));

const jobs = [];
for (const [kind, list] of [["maker", cfg.makers], ["news", cfg.news]]) {
  for (const s of list) {
    if (s.rss || s.site) jobs.push(collectFeed(s, kind));
    if (s.shop) jobs.push(collectShop(s, kind, shopState));
    if (!s.rss && !s.site && !s.shop) jobs.push(Promise.resolve({ status: { name: s.name, kind, ok: false, error: "サイト未設定" }, items: [] }));
  }
}
const results = await Promise.all(jobs);
const items = results.flatMap((r) => r.items).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

// 画像がない記事は、記事ページの og:image を取りに行く（前回取得分は再利用）
const oldImg = new Map((old.items || []).filter((i) => i.image).map((i) => [i.url, i.image]));
const imgCache = old.imgCache || {};
let fetched = 0;
for (const i of items) {
  if (i.image) continue;
  const c = oldImg.get(i.url) || imgCache[i.url];
  if (c !== undefined) { i.image = c; continue; }
  if (fetched >= 40) continue;
  fetched++;
  try {
    const h = await get(i.url);
    const m = h.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || h.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    i.image = m ? m[1].replace(/&amp;/g, "&") : "";
  } catch { i.image = ""; }
  imgCache[i.url] = i.image;
}
console.log("og:image fetched:", fetched);

// 発売カレンダー：記事の発売日＋ショップの近日/販売開始 を、過去分も含めて蓄積
const releases = new Map((old.releases || []).map((r) => [r.key, r]));
const addRelease = (r) => {
  const prev = releases.get(r.key);
  if (prev?.image && !r.image) r.image = prev.image;
  releases.set(r.key, prev ? { ...prev, ...r, links: [...new Map([...prev.links, ...r.links].map((l) => [l.url, l])).values()] } : r);
};
for (const i of items) {
  if (i.label === "記事" && i.release && /発売|再販|販売開始|入荷|出荷|発送/.test(i.release.kind)) {
    const g = gameName(i.title);
    addRelease({ key: "a:" + g + ":" + i.release.date, game: g, date: i.release.date, label: i.release.label,
      exact: i.release.exact, type: i.release.kind, image: i.image || "", links: [{ source: i.source, url: i.url, title: i.title }] });
  }
  if (i.label === "ショップ" && i.status === "soon") {
    addRelease({ key: "s:" + i.url, game: i.title, date: null, label: "近日発売", exact: false, type: "近日", price: i.price, image: i.image || "",
      links: [{ source: i.source, url: i.url, title: i.title }] });
  }
  if (i.label === "ショップ" && i.saleAt) {
    addRelease({ key: "s:" + i.url, game: i.title, date: i.saleAt.slice(0, 10), label: null, exact: true, type: "販売開始", price: i.price, image: i.image || "",
      links: [{ source: i.source, url: i.url, title: i.title }] });
  }
}
const cutoff = new Date(NOW - KEEP_RELEASE_DAYS * 864e5).toISOString().slice(0, 10);
const releaseList = [...releases.values()].filter((r) => !r.date || r.date >= cutoff)
  .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

const keepUrls = new Set(items.map((i) => i.url));
const data = { updatedAt: nowIso, sources: results.map((r) => r.status), items, releases: releaseList, shopState,
  imgCache: Object.fromEntries(Object.entries(imgCache).filter(([u]) => keepUrls.has(u))) };
await writeFile(dataUrl, JSON.stringify(data, null, 1));
for (const r of results) console.log(`${r.status.ok ? "OK " : "NG "} ${r.status.name}/${r.status.channel || ""} n=${r.items.length} ${r.status.error}`);
console.log("releases:", releaseList.length);
