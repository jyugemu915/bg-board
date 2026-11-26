// 箱絵の高画質版を作る：BGGの元画像を取得し、幅400px前後の webp に縮めて data/img/<picID>.webp に保存
// 対象は data/owned-info.json の各ゲームの標準箱絵と data/bgg.json の箱絵。版ごとの箱絵（versions）は数が多いので対象外
// 一覧は data/img.json（ok=作成済みのpicID、fail=失敗回数）。1回の実行で最大 MAX 件
import fs from "node:fs";
import sharp from "sharp";

const MAX = 80, TRIES = 3, CONC = 4;
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const db = read("data/img.json", { ok: [], fail: {} });
const ok = new Set(db.ok), fail = db.fail || {};
fs.mkdirSync("data/img", { recursive: true });

const picId = (u) => /\/pic(\d+)\.[a-z]+$/i.exec(u || "")?.[1];
const todo = new Map();
const add = (u) => { const id = picId(u); if (id && !ok.has(id) && (fail[id] || 0) < TRIES && !todo.has(id)) todo.set(id, u); };
for (const g of Object.values(read("data/owned-info.json", {}).games || {})) add(g.image);
for (const g of Object.values(read("data/bgg.json", {}).games || {})) add(g.image);

const list = [...todo].slice(0, MAX);
console.log(`高画質化：対象 ${todo.size} 件のうち ${list.length} 件を処理（作成済み ${ok.size} 件）`);

async function one([id, url]) {
  try {
    const r = await fetch(url, { headers: { "user-agent": "bg-board (github.com/jyugemu915/bg-board)" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    await sharp(buf).rotate().resize({ width: 400, height: 640, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 }).toFile(`data/img/${id}.webp`);
    ok.add(id); delete fail[id];
  } catch (e) {
    fail[id] = (fail[id] || 0) + 1;
    console.log(`  失敗 pic${id}: ${e.message}`);
  }
}
for (let i = 0; i < list.length; i += CONC) await Promise.all(list.slice(i, i + CONC).map(one));

fs.writeFileSync("data/img.json", JSON.stringify({ ok: [...ok].sort(), fail, updatedAt: new Date().toISOString() }));
console.log(`完了：作成済み ${ok.size} 件、失敗中 ${Object.keys(fail).length} 件`);
