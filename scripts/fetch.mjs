// 情報源からRSSを取得して data/news.json に書き出す(GitHub Actions で定期実行)
import { readFile, writeFile } from "node:fs/promises";

const UA = "Mozilla/5.0 (bg-board personal reader)";
const MAX_PER_SOURCE = 20;

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return await res.text();
}

const decode = (s = "") =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
   .replace(/<[^>]+>/g, "")
   .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
   .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
   .replace(/\s+/g, " ").trim();

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
};

function firstImage(block) {
  const m = block.match(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"/i)
    || block.match(/<enclosure[^>]+url="([^"]+\.(?:jpe?g|png|webp|gif)[^"]*)"/i)
    || decodeEntities(block).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : "";
}
const decodeEntities = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

function parseFeed(xml) {
  const items = [];
  const rss = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of rss) {
    items.push({
      title: decode(tag(b, "title")),
      url: decode(tag(b, "link")) || decode(tag(b, "guid")),
      date: decode(tag(b, "pubDate")) || decode(tag(b, "dc:date")),
      image: firstImage(b),
    });
  }
  const atom = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of atom) {
    const link = b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) || b.match(/<link[^>]*href="([^"]+)"/i);
    items.push({
      title: decode(tag(b, "title")),
      url: link ? link[1] : "",
      date: decode(tag(b, "published")) || decode(tag(b, "updated")),
      image: firstImage(b),
    });
  }
  return items.filter((i) => i.title && i.url);
}

async function findFeed(site) {
  const html = await get(site);
  const m = [...html.matchAll(/<link[^>]+>/gi)].map((x) => x[0])
    .find((l) => /rel=["']alternate["']/i.test(l) && /(rss|atom)\+xml/i.test(l));
  if (m) {
    const href = m.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) return new URL(href, site).href;
  }
  return new URL("feed/", site).href; // WordPress の定番
}

async function collect(src, kind) {
  const out = { name: src.name, kind, ok: false, error: "", feed: "" };
  try {
    const feed = src.rss || (src.site ? await findFeed(src.site) : "");
    if (!feed) { out.error = "サイト未設定"; return { status: out, items: [] }; }
    out.feed = feed;
    const items = parseFeed(await get(feed)).slice(0, MAX_PER_SOURCE).map((i) => {
      const t = Date.parse(i.date);
      return { ...i, date: isNaN(t) ? null : new Date(t).toISOString(), source: src.name, kind };
    });
    out.ok = items.length > 0;
    if (!out.ok) out.error = "記事が見つかりません";
    return { status: out, items };
  } catch (e) {
    out.error = String(e.message || e);
    return { status: out, items: [] };
  }
}

const cfg = JSON.parse(await readFile(new URL("../config/sources.json", import.meta.url)));
const jobs = [
  ...cfg.makers.map((s) => collect(s, "maker")),
  ...cfg.news.map((s) => collect(s, "news")),
];
const results = await Promise.all(jobs);
const items = results.flatMap((r) => r.items)
  .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
const data = { updatedAt: new Date().toISOString(), sources: results.map((r) => r.status), items };
await writeFile(new URL("../data/news.json", import.meta.url), JSON.stringify(data, null, 1));
for (const s of data.sources) console.log(`${s.ok ? "OK " : "NG "} ${s.name} ${s.feed} ${s.error}`);
