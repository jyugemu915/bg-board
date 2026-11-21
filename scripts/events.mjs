// イベント情報を集めて data/events.json に書き出す
// - ゲームマーケット公式（次回の日程・会場）
// - ボドゲーマ（都道府県ごとのボードゲーム会。宮城＋旅行・出張先）
// - ニュース記事の「◯月◯日開催」
// - config/events.json（手動で登録したもの：ひよこの杜の月間予定など）
import { readFile, writeFile } from "node:fs/promises";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const NOW = new Date();
const today = new Date(NOW.getTime() + 9 * 3600e3).toISOString().slice(0, 10); // 日本時間の今日
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ja" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return await res.text();
}
const strip = (s = "") => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export const PREFS = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];
const CITY = { 札幌: "北海道", 仙台: "宮城県", 幕張: "千葉県", 横浜: "神奈川県", 川崎: "神奈川県", 秋葉原: "東京都", 池袋: "東京都", 新宿: "東京都", 渋谷: "東京都", 浅草: "東京都", 蒲田: "東京都", 有明: "東京都", ビッグサイト: "東京都", 名古屋: "愛知県", 京都: "京都府", 大阪: "大阪府", 梅田: "大阪府", 難波: "大阪府", 京橋: "大阪府", 東大阪: "大阪府", 神戸: "兵庫県", 広島: "広島県", 福岡: "福岡県", 博多: "福岡県", 那覇: "沖縄県" };
export function guessPref(s = "") {
  const p = PREFS.find((x) => s.includes(x) || s.includes(x.replace(/[都府県]$/, "")));
  if (p) return p;
  for (const [c, pref] of Object.entries(CITY)) if (s.includes(c)) return pref;
  return "";
}

// ---- ゲームマーケット ----
async function gameMarket() {
  const url = "https://gamemarket.jp/access";
  const t = strip(await get(url));
  const out = [];
  const re = /ゲームマーケット\s*(\d{4})\s*(春|秋|冬|大阪|神戸|関西)?[\s\S]{0,60}?開催日([\s\S]{0,200}?)会場([\s\S]{0,120}?)住所([\s\S]{0,120}?)(?:交通|入場|$)/g;
  for (const m of t.matchAll(re)) {
    let year = +m[1];
    const dates = [...m[3].matchAll(/(?:(\d{4})年\s*)?(\d{1,2})月\s*(\d{1,2})日/g)].map((d) => { if (d[1]) year = +d[1]; return ymd(year, d[2], d[3]); }).sort();
    if (!dates.length) continue;
    const clean = (x) => x.replace(/\(.*?\)|[|]/g, " ").replace(/\s+/g, " ").trim();
    const venue = clean(m[4]), addr = clean(m[5]);
    out.push({ title: `ゲームマーケット${m[1]}${m[2] || ""}`, date: dates[0], end: dates[dates.length - 1],
      place: [venue, addr].filter(Boolean).join(" / "), pref: guessPref(venue + addr), source: "ゲームマーケット公式", url, kind: "gm" });
  }
  if (!out.length) throw new Error("日程が読み取れません");
  return [...new Map(out.map((e) => [e.title, e])).values()];
}

// ---- ボドゲーマ ----
async function bodogema(prefId, max = 25) {
  const pref = PREFS[prefId - 1];
  const list = await get(`https://bodoge.hoobby.net/events?search%5Bprefecture_id%5D=${prefId}`);
  const ids = [...new Set([...list.matchAll(/href="\/events\/(\d+)"/g)].map((m) => m[1]))].slice(0, max);
  const out = [];
  for (const id of ids) {
    try {
      const html = await get(`https://bodoge.hoobby.net/events/${id}`);
      for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        let j; try { j = JSON.parse(m[1]); } catch { continue; }
        for (const ev of [].concat(j)) {
          if (!ev?.startDate || !ev?.name) continue;
          const loc = ev.location || {};
          const a = loc.address || {};
          out.push({ title: ev.name, date: ev.startDate.slice(0, 10), end: (ev.endDate || ev.startDate).slice(0, 10),
            time: `${ev.startDate.slice(11, 16)}${ev.endDate ? "〜" + ev.endDate.slice(11, 16) : ""}`,
            place: [loc.name, a.streetAddress].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(" / "),
            pref: a.addressRegion || pref, price: ev.offers?.price ? `${ev.offers.price}円` : "",
            source: "ボドゲーマ", url: `https://bodoge.hoobby.net/events/${id}`, kind: "local" });
        }
      }
    } catch (e) { console.log("  skip", id, e.message); }
    await sleep(400);
  }
  return out;
}

// ---- ニュース記事の「開催」 ----
async function fromNews() {
  const news = JSON.parse(await readFile(new URL("../data/news.json", import.meta.url)));
  const out = [];
  for (const i of news.items || []) {
    if (i.label !== "記事") continue;
    const m = i.title.match(/(?:(\d{4})年)?\s*(\d{1,2})月\s*(\d{1,2})日(?:[〜~～・、]\s*(\d{1,2})日)?\s*(?:に|より|から)?\s*(開催|開幕)/);
    if (!m) continue;
    const base = new Date(i.date || NOW);
    let y = m[1] ? +m[1] : base.getFullYear();
    if (!m[1] && +m[2] < base.getMonth() + 1 - 6) y++;
    const date = ymd(y, m[2], m[3]);
    const name = i.title.match(/[「『]([^」』]+)[」』]/)?.[1] || i.title.replace(/[、,]?\s*\d{1,2}月.*$/, "");
    out.push({ title: name, date, end: m[4] ? ymd(y, m[2], m[4]) : date, place: "", pref: guessPref(i.title),
      source: i.source, url: i.url, kind: "news", note: i.title });
  }
  return out;
}

// ---- 実行 ----
const cfg = JSON.parse(await readFile(new URL("../config/events.json", import.meta.url)));
const status = [];
const all = [];
async function run(name, fn) {
  try { const r = await fn(); all.push(...r); status.push({ name, ok: true, n: r.length }); }
  catch (e) { status.push({ name, ok: false, error: String(e.message || e) }); }
}
await run("ゲームマーケット公式", gameMarket);
await run("ニュース記事", fromNews);
// 宮城＋旅行・出張先の都道府県（期間が終わっていないもの）
const prefIds = new Set(cfg.homePrefs || [4]);
for (const t of cfg.trips || []) if ((t.to || t.from) >= today) prefIds.add(PREFS.indexOf(t.pref) + 1);
for (const id of prefIds) if (id > 0) await run(`ボドゲーマ（${PREFS[id - 1]}）`, () => bodogema(id));
all.push(...(cfg.manual || []).map((e) => ({ kind: "manual", source: e.source || "手動登録", pref: e.pref || guessPref(e.place || ""), end: e.end || e.date, ...e })));

// 重複除去・過去分は30日まで残す
const keep = new Date(NOW - 30 * 864e5).toISOString().slice(0, 10);
const uniq = new Map();
for (const e of all) if ((e.end || e.date) >= keep) uniq.set(e.url + "|" + e.date + "|" + e.title, e);
const events = [...uniq.values()].sort((a, b) => a.date.localeCompare(b.date));
await writeFile(new URL("../data/events.json", import.meta.url), JSON.stringify({ updatedAt: NOW.toISOString(), status, trips: cfg.trips || [], homePrefs: [...(cfg.homePrefs || [4])].map((i) => PREFS[i - 1]), events }, null, 1));
for (const s of status) console.log(`${s.ok ? "OK " : "NG "} ${s.name} ${s.ok ? "n=" + s.n : s.error}`);
console.log("events:", events.length);
