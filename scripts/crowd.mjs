// 注目クラファン：ボドファンの募集中プロジェクト一覧 ＋ 登録した Kickstarter プロジェクトの状況
import { readFile, writeFile } from "node:fs/promises";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ja" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return await res.text();
}
const dec = (s = "") => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const num = (s) => (s ? +String(s).replace(/[^\d.]/g, "") : null);
const read = (p, d) => readFile(new URL(p, import.meta.url)).then((b) => JSON.parse(b)).catch(() => d);

// ---- ボドファン ----
async function bodofun() {
  const base = "https://bodofun.hoobby.net";
  const list = await get(base + "/projects");
  const slugs = [...new Set([...list.matchAll(/href="\/projects\/([\w-]+)"/g)].map((m) => m[1]))].slice(0, 40);
  const out = [];
  for (const slug of slugs) {
    try {
      const h = await get(`${base}/projects/${slug}`);
      const og = (k) => dec(h.match(new RegExp(`<meta[^>]+property="og:${k}"[^>]+content="([^"]*)"`, "i"))?.[1] || "");
      const title = og("title").replace(/\s*\|\s*クラウドファンディング.*$/, "").trim();
      const total = num(h.match(/class="total font-number">([^<]+)</)?.[1]);
      const goal = num(h.match(/目標\s*<span class="font-number">([^<]+)</)?.[1]);
      const rate = num(h.match(/目標達成率<\/span>\s*<div>\s*<span class="font-number emphasis">([\d,]+)</)?.[1]);
      const end = +(h.match(/data-target="jsCountDown" data-time="(\d+)"/)?.[1] || 0);
      const delivery = dec(h.match(/ご提供予定時期[：:]\s*([^<]+)</)?.[1]?.trim() || "");
      const owner = dec(h.match(/project-owner[^>]*>[\s\S]{0,400}?<(?:a|span|div)[^>]*class="[^"]*name[^"]*"[^>]*>\s*([^<]+)</)?.[1]?.trim() || "");
      out.push({ site: "ボドファン", id: "bodofun:" + slug, title, url: `${base}/projects/${slug}`, image: og("image"),
        total, goal, rate, currency: "¥", end: end ? new Date(end * 1000).toISOString() : null, delivery, owner });
    } catch (e) { console.log("skip", slug, e.message); }
    await sleep(500);
  }
  return out;
}

// ---- Kickstarter（ページ本体は取れないので stats.json のみ）----
async function kickstarter(url) {
  const m = url.match(/kickstarter\.com\/projects\/([\w-]+)\/([\w-]+)/);
  if (!m) throw new Error("URLの形式が違います");
  const j = JSON.parse(await get(`https://www.kickstarter.com/projects/${m[1]}/${m[2]}/stats.json?v=1`)).project || {};
  return { site: "Kickstarter", id: "ks:" + m[1] + "/" + m[2], url: `https://www.kickstarter.com/projects/${m[1]}/${m[2]}`,
    title: m[2].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), backers: j.backers_count ?? null,
    total: j.pledged ? Math.round(+j.pledged) : null, state: j.state || "", stateAt: j.state_changed_at ? new Date(j.state_changed_at * 1000).toISOString() : null };
}

const cfg = await read("../config/crowd-watch.json", { kickstarter: [], other: [] });
const status = [];
let bodo = [];
try { bodo = await bodofun(); status.push({ name: "ボドファン", ok: true, n: bodo.length }); }
catch (e) { status.push({ name: "ボドファン", ok: false, error: e.message }); }
const watch = [];
for (const w of cfg.kickstarter || []) {
  const url = typeof w === "string" ? w : w.url;
  try { const r = await kickstarter(url); if (w.title) r.title = w.title; if (w.image) r.image = w.image; watch.push(r); }
  catch (e) { status.push({ name: url, ok: false, error: e.message }); }
  await sleep(500);
}
for (const w of cfg.other || []) watch.push({ site: w.site || "その他", id: "other:" + w.url, ...w });
await writeFile(new URL("../data/crowd.json", import.meta.url), JSON.stringify({ updatedAt: new Date().toISOString(), status, bodofun: bodo, watch }, null, 1));
for (const s of status) console.log(s.ok ? "OK " : "NG ", s.name, s.n ?? s.error);
console.log("watch:", watch.length);
