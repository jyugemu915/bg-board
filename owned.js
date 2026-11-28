// 所持ゲームの専用ページ（#owned）：検索・絞り込み・並べ替え・リスト／箱絵の切り替え・詳細シート
// app.js の後に読み込む（owned / ownedInfo / expInfo / store / norm / esc などを共有）

// BGGカテゴリーの日本語
const CAT = {
  "Abstract Strategy": "アブストラクト", "Action / Dexterity": "アクション", "Adventure": "冒険", "Age of Reason": "理性の時代", "American West": "西部劇",
  "Ancient": "古代", "Animals": "動物", "Arabian": "アラビア", "Aviation / Flight": "航空", "Bluffing": "ブラフ", "Book": "本", "Card Game": "カードゲーム",
  "Children's Game": "子ども向け", "City Building": "街づくり", "Civil War": "南北戦争", "Civilization": "文明", "Collectible Components": "コレクタブル",
  "Comic Book / Strip": "コミック", "Deduction": "推理", "Dice": "ダイス", "Economic": "経済", "Educational": "教育", "Electronic": "電子",
  "Environmental": "環境", "Expansion for Base-game": "拡張", "Exploration": "探検", "Fan Expansion": "ファン拡張", "Fantasy": "ファンタジー",
  "Farming": "農業", "Fighting": "戦闘", "Game System": "ゲームシステム", "Horror": "ホラー", "Humor": "ユーモア", "Industry / Manufacturing": "産業",
  "Mafia": "マフィア", "Math": "数字", "Mature / Adult": "大人向け", "Maze": "迷路", "Medical": "医療", "Medieval": "中世", "Memory": "記憶",
  "Miniatures": "ミニチュア", "Modern Warfare": "現代戦", "Movies / TV / Radio theme": "映画・テレビ", "Murder / Mystery": "ミステリー", "Music": "音楽",
  "Mythology": "神話", "Napoleonic": "ナポレオン", "Nautical": "海", "Negotiation": "交渉", "Novel-based": "小説が原作", "Number": "数字",
  "Party Game": "パーティー", "Pike and Shot": "近世戦", "Pirates": "海賊", "Political": "政治", "Post-Napoleonic": "19世紀", "Prehistoric": "先史時代",
  "Print & Play": "プリント＆プレイ", "Puzzle": "パズル", "Racing": "レース", "Real-time": "リアルタイム", "Religious": "宗教", "Renaissance": "ルネサンス",
  "Science Fiction": "SF", "Space Exploration": "宇宙", "Spies / Secret Agents": "スパイ", "Sports": "スポーツ", "Territory Building": "陣取り",
  "Trains": "鉄道", "Transportation": "輸送", "Travel": "旅行", "Trivia": "クイズ", "Video Game Theme": "ビデオゲーム", "Wargame": "ウォーゲーム",
  "Word Game": "言葉", "World War I": "第一次大戦", "World War II": "第二次大戦", "Zombies": "ゾンビ", "Ancient Rome": "古代ローマ",
  "Pattern Building": "パターン作り", "Japanese": "日本",
};
const catJa = (c) => CAT[c] || c;
const mechJa = (m) => MECH[m] || m;

// 状態タグ（✎編集でチェック。一覧のタグと絞り込みに使う）
const FLAGS = [["unopened", "未開封"], ["untranslated", "未訳"], ["unplayed", "未プレイ"]];
const flagTags = (g, cls = "tag flag") => (g.flags || []).map((f) => FLAGS.find((x) => x[0] === f)).filter(Boolean).map(([k, l]) => `<span class="${cls} f-${k}">${l}</span>`).join("");
const LS_OVIEW = "bgb.ownedview.v1";
const OS = { q: "", flag: "", players: 0, best: false, time: "", weight: "", cat: "", mech: "", n: 60, sheet: null, edit: false, adding: false, bulk: false, expN: 8, link: null,
  sleeveEdit: false, sleeveSum: false, slvTab: "cat", slvOpen: null, slvBgg: false, slvUnopened: false, boxes: "size", ...store.get(LS_OVIEW, { view: "pack", sort: "added" }) };
if (OS.view === "grid") OS.view = "pack";   // 旧設定（棚表示）→ 詰める表示を既定に
// 箱絵の縦横比（読み込んだ画像から覚えておき、詰める表示の配置に使う）
const aspects = store.get("bgb.aspect.v1", {});
let aspectSave = 0;
const saveView = () => store.set(LS_OVIEW, { view: OS.view, sort: OS.sort, boxes: OS.boxes });

// 箱の大きさ（大中小）：手動（g.box）→ 選んだ版の寸法 → BGGの寸法（日本語版優先）。面積で判定、寸法がなければ中箱
const BOXES = [["L", "大箱"], ["M", "中箱"], ["S", "小箱"]];
function boxSize(g) {
  const i = oinfo(g);
  const v = g.img && (i?.versions || []).find((x) => x.thumb === g.img && x.size);
  const cm = v?.size || i?.box || null;
  const auto = cm ? (cm[0] * cm[1] < 300 ? "S" : cm[0] * cm[1] < 750 ? "M" : "L") : "M";
  return { t: g.box || auto, auto, cm, manual: !!g.box };
}
const boxLabel = (t) => BOXES.find((x) => x[0] === t)?.[1] || "";
const cmText = (cm) => cm ? `${cm[0]}×${cm[1]}${cm[2] ? `×${cm[2]}` : ""}cm` : "";

// スリーブ：g.sleeves = [{ name, w, h, n, sid, kind, done }]（カードの名前・サイズmm・枚数・手持ちスリーブのID・スリーブの名前・スリーブ済み）
// 手持ちのスリーブ：localStorage bgb.sleevecat.v1 = [{ id, brand, name, w, h, pack, stock, note, fav, preset, sz:2 }]
//   w×h はスリーブの大きさ（袋の表示・mm）、pack は1袋の枚数、stock は在庫枚数、fav は「よく使う」（自動で選ぶときに優先）
//   config/sleeves.json の候補（preset）を取り込む。画面で削除した候補は bgb.sleevecat.removed に入れて戻さない
// よくあるカードのサイズ（カードの大きさ・mm）
const SLEEVE_SIZES = [["41×63", "ミニUSA"], ["43×65", "ミニアメリカン"], ["44×63", "TCGハーフ"], ["44×67", "ミニユーロ"], ["44×68", "ミニユーロ"], ["54×86", "名刺・メンバーズ"], ["56×87", "USA（アメリカン）"], ["57×89", "ブリッジ"], ["59×86", "スモール（遊戯王）"], ["59×91", "ユーロ（ドミニオン）"], ["59×92", "ユーロ"], ["63×88", "TCG（MTG・ポケカ）"], ["63.5×88", "スタンダード（トランプ）"], ["65×100", "世界の七不思議"], ["70×70", "スクエア"], ["80×80", "スクエア（大）"], ["70×110", "タロット（小）"], ["70×120", "タロット"], ["80×120", "ディクシット"]];
const sizeKey = (s) => `${+s.w}×${+s.h}`;
const sizeName = (k) => SLEEVE_SIZES.find((x) => x[0] === k)?.[1] || "";
function parseSize(t) { const m = String(t).replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).match(/(\d+(?:\.\d+)?)\s*[x×*✕]\s*(\d+(?:\.\d+)?)/i); return m ? [+m[1], +m[2]].sort((a, b) => a - b) : null; }
const LS_SLVCAT = "bgb.sleevecat.v1";
let sleeveCat = store.get(LS_SLVCAT, []);
const saveCat = () => store.set(LS_SLVCAT, sleeveCat);
// 前の形（w×h が対応カードのサイズ）からスリーブの大きさへ直す
if (sleeveCat.some((x) => !x.sz)) { for (const x of sleeveCat) if (!x.sz) { x.w = +(x.w + 1.5).toFixed(1); x.h = +(x.h + 2).toFixed(1); x.sz = 2; } saveCat(); }
const LS_SLVRM = "bgb.sleevecat.removed";
fetch("config/sleeves.json?" + Date.now()).then((r) => r.json()).then((d) => {
  const rm = new Set(store.get(LS_SLVRM, [])); let add = 0;
  for (const p of d.products || []) for (const it of p.items || []) {
    if (rm.has(it.id) || catById(it.id)) continue;
    sleeveCat.push({ id: it.id, brand: p.brand, name: [p.brand, p.line, it.label].filter(Boolean).join(" "), w: it.w, h: it.h, pack: p.pack, note: p.note, preset: 1, sz: 2 }); add++;
  }
  if (add) { saveCat(); if (OS.sleeveSum) drawSleeveSum(); }
}).catch(() => {});
const catById = (id) => sleeveCat.find((x) => x.id === id);
const slvName = (r) => catById(r.sid)?.name || r.kind || "";
// カードがスリーブに入るか：カードがスリーブより縦横とも0.5mm以上小さければ入る。余り（縦＋横）が5mm以内は「ぴったり」、12mm以内は「ゆるめ」
function fitOf(cat, c) {
  if (!cat?.w || !c?.w || c.w > cat.w - 0.5 || c.h > cat.h - 0.5) return null;
  const slack = (cat.w - c.w) + (cat.h - c.h);
  return slack <= 5 ? "ぴったり" : slack <= 12 ? "ゆるめ" : null;
}
// 合うスリーブ：ぴったり → 「よく使う」→ 在庫あり → 余りが小さい順
function suggest(c) {
  const ok = sleeveCat.map((x) => ({ x, f: fitOf(x, c), d: (x.w - c.w) + (x.h - c.h) })).filter((o) => o.f)
    .sort((a, b) => (b.f === "ぴったり") - (a.f === "ぴったり") || !!b.x.fav - !!a.x.fav || (+b.x.stock > 0) - (+a.x.stock > 0) || a.d - b.d);
  return ok[0]?.x || null;
}
// そのスリーブにぴったり合う、よくあるカードのサイズ
const fitCards = (x) => SLEEVE_SIZES.filter(([k]) => { const [w, h] = k.split("×").map(Number); return fitOf(x, { w, h }) === "ぴったり"; });
const packsText = (n, cat) => cat?.pack && n ? `${Math.ceil(n / cat.pack)}袋` : "";

// 本体と拡張のまとまり：parent の名前（日本語名・英語名・登録時の名前）か、BGGの「この拡張の本体」で探す。拡張の拡張も本体の下にまとめる
function ownedGroups() {
  const byName = new Map(), byId = new Map();
  for (const g of owned) {
    for (const k of [norm(g.name), g.key, norm(g.nameEn)]) if (k && !byName.has(k)) byName.set(k, g);
    const id = bggId(g);
    if (id && !byId.has(id)) byId.set(id, g);
  }
  const isExp = (g) => /boardgameexpansion/.test(g.bgg || "") || oinfo(g)?.type === "boardgameexpansion";
  const findParent = (g) => {
    let p = g.parent ? byName.get(norm(g.parent)) : null;
    if (!p && !g.parent && isExp(g)) for (const b of oinfo(g)?.bases || []) { const x = byId.get(b.id); if (x && x !== g) { p = x; break; } }
    return p && p !== g ? p : null;
  };
  const rootOf = new Map(), kids = new Map(), bases = [];
  for (const g of owned) {
    let cur = g, p;
    const seen = new Set([g]);
    while ((p = findParent(cur)) && !seen.has(p)) { seen.add(p); cur = p; }
    if (cur === g) bases.push(g);
    else { rootOf.set(g, cur); if (!kids.has(cur)) kids.set(cur, []); kids.get(cur).push(g); }
  }
  return { bases, kids, rootOf };
}

// 検索用の文字列（名前・英語名・デザイナー・アーティスト・出版社・メカニクス・カテゴリー）
function hay(g) {
  const i = oinfo(g) || {};
  return norm([g.name, enName(g), i.ja, g.includes, ...(g.sleeves || []).map(slvName), ...(i.designers || []), ...(i.artists || []), ...(i.publishers || []), ...(i.families || []),
    ...(i.mechanics || []).flatMap((m) => [m, mechJa(m)]), ...(i.categories || []).flatMap((c) => [c, catJa(c)])].filter(Boolean).join("|"));
}
// "3〜4" "2, 4" "5+" → 数の集合
function numSet(s) {
  const out = new Set();
  for (const part of String(s || "").split(/[,、]/)) {
    const m = part.match(/(\d+)\s*(?:〜\s*(\d+)|(\+))?/);
    if (!m) continue;
    const a = +m[1], b = m[2] ? +m[2] : m[3] ? 99 : a;
    for (let n = a; n <= Math.min(b, 20); n++) out.add(n);
  }
  return out;
}
const playTime = (i) => i?.maxTime || i?.time || i?.minTime || 0;
const TIMES = [["s", "〜30分", (t) => t <= 30], ["m", "〜60分", (t) => t > 30 && t <= 60], ["l", "〜2時間", (t) => t > 60 && t <= 120], ["xl", "2時間〜", (t) => t > 120]];
const WEIGHTS = [["1", "軽め", (w) => w < 2], ["2", "中量", (w) => w >= 2 && w < 3], ["3", "重め", (w) => w >= 3]];
const SORTS = [["added", "登録順"], ["name", "名前順"], ["rating", "BGG評価が高い順"], ["heavy", "重い順"], ["light", "軽い順"], ["short", "短い順"], ["year", "発売が新しい順"]];

function passFilters(g) {
  const i = oinfo(g);
  if (OS.players) {
    if (!i?.minp) return false;
    const n = OS.players;
    if (OS.best) { const b = numSet(i.best); if (!(n === 6 ? [...b].some((x) => x >= 6) : b.has(n))) return false; }
    else if (!(n === 6 ? i.maxp >= 6 : i.minp <= n && n <= i.maxp)) return false;
  }
  if (OS.time) { const t = playTime(i); if (!t || !TIMES.find((x) => x[0] === OS.time)[2](t)) return false; }
  if (OS.weight) { const w = i?.weight; if (!w || !WEIGHTS.find((x) => x[0] === OS.weight)[2](w)) return false; }
  if (OS.flag && !(g.flags || []).includes(OS.flag)) return false;
  if (OS.cat && !(i?.categories || []).includes(OS.cat)) return false;
  if (OS.mech && !(i?.mechanics || []).includes(OS.mech)) return false;
  return true;
}
function sortRows(rows) {
  const num = (f, dir) => (a, b) => { const x = f(oinfo(a.g)), y = f(oinfo(b.g)); return (!x) - (!y) || (x && y ? dir * (y - x) : 0); };
  const by = {
    name: (a, b) => ownedTitle(a.g).main.localeCompare(ownedTitle(b.g).main, "ja"),
    rating: num((i) => i?.rating, 1), heavy: num((i) => i?.weight, 1), light: num((i) => i?.weight, -1),
    short: num((i) => playTime(i), -1), year: num((i) => i?.year, 1),
  }[OS.sort];
  return by ? [...rows].sort(by) : rows;
}
const shortPlayers = (g) => {
  const i = oinfo(g);
  if (g.players) return g.players;
  if (!i?.minp) return "";
  return `${i.minp === i.maxp ? i.minp : `${i.minp}〜${i.maxp}`}人`;
};
const shortTime = (g) => { const i = oinfo(g); if (!i) return ""; return i.minTime && i.maxTime && i.minTime !== i.maxTime ? `${i.minTime}〜${i.maxTime}分` : playTime(i) ? `${playTime(i)}分` : ""; };

// ホームの「所持ゲーム」ボックス：件数・検索・最近の登録・一覧ページへのリンク
function ownedBox(b) {
  const { bases } = ownedGroups();
  const el = boxShell(b, TYPES.owned.title, bases.length);
  const expN = owned.length - bases.length;
  if (expN) el.querySelector(".count").insertAdjacentHTML("afterend", `<span class="count">＋拡張 ${expN}</span>`);
  const f = document.createElement("form");
  f.className = "add";
  f.innerHTML = `<div class="r"><input placeholder="名前・メカニクス・デザイナーで検索" enterkeyhint="search"><button>探す</button></div>`;
  f.onsubmit = (e) => { e.preventDefault(); OS.q = f.querySelector("input").value.trim(); OS.n = 60; location.hash = "#owned"; };
  el.appendChild(f);
  const recent = [...bases].sort((a, c) => String(c.added || "").localeCompare(String(a.added || ""))).slice(0, 4);
  if (recent.length) el.insertAdjacentHTML("beforeend", `<div class="lbl2">最近の登録</div>`);
  for (const g of recent) {
    const img = ownedImg(g), t = ownedTitle(g), meta = [shortPlayers(g), shortTime(g)].filter(Boolean).join("・");
    const r = document.createElement("div");
    r.className = "row";
    r.style.cursor = "pointer";
    r.innerHTML = `<div class="thumb" ${img ? `style="background-image:url('${esc(img)}')"` : ""}>${img ? "" : "🎲"}</div>
      <div class="rt"><div class="t">${esc(t.main)}</div><div class="s">${meta ? "👥 " + esc(meta) : ""}${g.from ? `${meta ? " ・ " : ""}${esc(g.from)}` : ""}</div></div>`;
    r.onclick = () => { OS.sheet = g; OS.edit = false; location.hash = "#owned"; };
    el.appendChild(r);
  }
  if (!owned.length) el.insertAdjacentHTML("beforeend", `<div class="empty">まだ登録がありません。一覧ページから追加するか、棚の写真をチャットで送ってもらえればまとめて登録します。</div>`);
  const go = document.createElement("a");
  go.className = "more"; go.href = "#owned"; go.textContent = "一覧を開く（箱絵・検索・絞り込み）→";
  el.appendChild(go);
  return el;
}

// ===== 専用ページ =====
let opageBuilt = false;
function renderOwnedPage() {
  const root = document.getElementById("ownedPage");
  if (!opageBuilt) { buildOwnedPage(root); opageBuilt = true; }
  drawOwned();
  drawSheet();
}

function buildOwnedPage(root) {
  root.innerHTML = `
    <div class="ohead"><h1>所持ゲーム</h1><span id="oCount" class="muted"></span><button id="oAddBtn" class="pill">＋ 追加</button></div>
    <div id="oAdd"></div>
    <div class="osearch"><input id="oQ" type="search" placeholder="名前・英語名・メカニクス・カテゴリー・デザイナー・出版社" enterkeyhint="search" autocomplete="off"></div>
    <div class="ofilters">
      <div class="frow"><span class="flbl">人数</span><div class="seg" id="oPl">${[0, 1, 2, 3, 4, 5, 6].map((n) => `<button data-v="${n}">${n ? (n === 6 ? "6+" : n) : "指定なし"}</button>`).join("")}</div>
        <label class="ck"><input type="checkbox" id="oBest">ベスト</label></div>
      <div class="frow"><span class="flbl">時間</span><div class="seg" id="oTime"><button data-v="">指定なし</button>${TIMES.map(([k, l]) => `<button data-v="${k}">${l}</button>`).join("")}</div></div>
      <div class="frow"><span class="flbl">重さ</span><div class="seg" id="oWt"><button data-v="">指定なし</button>${WEIGHTS.map(([k, l]) => `<button data-v="${k}">${l}</button>`).join("")}</div></div>
      <div class="frow"><span class="flbl">状態</span><div class="seg" id="oFlag"><button data-v="">指定なし</button>${FLAGS.map(([k, l]) => `<button data-v="${k}">${l}</button>`).join("")}</div></div>
      <div class="frow sel"><select id="oCat"></select><select id="oMech"></select></div>
    </div>
    <div class="obar"><span id="oHits" class="muted"></span><button id="oClear" class="chip ghost" hidden>条件をクリア</button><span style="flex:1"></span>
      <select id="oSort">${SORTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <div class="seg sm" id="oView"><button data-v="pack" title="箱絵を詰めて表示">▦</button><button data-v="shelf" title="棚">棚</button><button data-v="list" title="リスト">☰</button></div></div>
    <div class="obar2"><span class="flbl">表記</span><div class="seg sm" id="oNm">${[["both", "両方"], ["ja", "日本語"], ["en", "English"]].map(([k, l]) => `<button data-v="${k}">${l}</button>`).join("")}</div>
      <span class="flbl">箱</span><div class="seg sm" id="oBox"><button data-v="size" title="大箱・中箱・小箱で大きさを変える">大中小</button><button data-v="same">そろえる</button></div></div>
    <div id="oSleeves"></div>
    <div id="oList"></div>
    <div class="foot"><button type="button" data-a="slv">スリーブ</button><button type="button" data-a="req" title="BGGの詳細が取れていないゲームを、チャットで登録を頼むための文章にしてコピー">未登録をコピー</button><button type="button" data-a="exp">書き出し</button><label>読み込み<input type="file" accept=".json" hidden></label></div>
    <div id="oSheet" class="sheetwrap" hidden></div>`;
  const $ = (id) => root.querySelector("#" + id);
  const segs = [["oPl", "players", (v) => +v], ["oTime", "time"], ["oWt", "weight"], ["oFlag", "flag"], ["oView", "view"], ["oNm", null], ["oBox", "boxes"]];
  for (const [id, key, conv] of segs) $(id).onclick = (e) => {
    const btn = e.target.closest("button[data-v]");
    if (!btn) return;
    if (id === "oNm") { nameMode = btn.dataset.v; store.set("bgb.ownedname.v2", nameMode); }
    else { OS[key] = conv ? conv(btn.dataset.v) : btn.dataset.v; if (key === "view" || key === "boxes") saveView(); }
    OS.n = 60; drawOwned();
  };
  $("oQ").oninput = (e) => { OS.q = e.target.value; OS.n = 60; drawOwned(); };
  $("oBest").onchange = (e) => { OS.best = e.target.checked; drawOwned(); };
  $("oCat").onchange = (e) => { OS.cat = e.target.value; drawOwned(); };
  $("oMech").onchange = (e) => { OS.mech = e.target.value; drawOwned(); };
  $("oSort").onchange = (e) => { OS.sort = e.target.value; saveView(); drawOwned(); };
  $("oClear").onclick = () => { Object.assign(OS, { q: "", flag: "", players: 0, best: false, time: "", weight: "", cat: "", mech: "", n: 60 }); drawOwned(); };
  $("oAddBtn").onclick = () => { OS.adding = !OS.adding; drawAdd(); };
  root.querySelector("[data-a=req]").onclick = async (e) => {
    const btn = e.currentTarget, txt = unregisteredText();
    if (!txt) { flash(btn, "未登録はありません"); return; }
    try { await navigator.clipboard.writeText(txt); }
    catch {
      const ta = Object.assign(document.createElement("textarea"), { value: txt });
      document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    flash(btn, `${txt.split("\n").length - 1}件コピーしました`);
  };
  root.querySelector("[data-a=slv]").onclick = () => { OS.sleeveSum = !OS.sleeveSum; drawSleeveSum(); if (OS.sleeveSum) document.getElementById("oSleeves").scrollIntoView({ behavior: "smooth" }); };
  root.querySelector("[data-a=exp]").onclick = () => {
    const blob = new Blob([JSON.stringify({ owned, sleeves: sleeveCat }, null, 1)], { type: "application/json" });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "owned-games.json" }).click();
  };
  root.querySelector(".foot input").onchange = async (e) => {
    try {
      const d = JSON.parse(await e.target.files[0].text()), arr = Array.isArray(d) ? d : d?.owned;
      if (!Array.isArray(arr)) throw 0;
      // 手持ちのスリーブ：同じIDがなければ追加
      for (const x of d.sleeves || []) if (x?.id && !catById(x.id)) sleeveCat.push(x);
      saveCat();
      // 同じ名前のゲームは、こちらにないスリーブ・箱の大きさ・状態だけ写す
      const byName = new Map(owned.map((g) => [g.name, g]));
      for (const x of arr) { const g = byName.get(x?.name); if (g) for (const k of ["sleeves", "box", "flags"]) if (x[k] && !g[k]) g[k] = x[k]; }
      owned = [...owned, ...arr.filter((g) => g?.name && !byName.has(g.name))];
      saveOwned();
    } catch { alert("読み込めないファイルです"); }
  };
  // 戻る操作で詳細シートを閉じる
  window.addEventListener("popstate", () => { if (OS.sheet && location.hash === "#owned") { OS.sheet = null; OS.edit = false; drawSheet(); } });
  drawAdd();
}
// BGGの詳細（owned-info）が取れていないゲームを、チャットに貼る登録依頼の文章にする
function unregisteredText() {
  const rows = owned.filter((g) => !ownedInfo[bggId(g)] && !(g.img && !g.bgg)).map((g) => [
    g.name, g.nameEn, g.bgg || "BGG未設定", g.parent && `本体:${g.parent}`, g.includes && `メモ:${g.includes}`,
    g.flags?.length && `状態:${g.flags.map((f) => FLAGS.find(([k]) => k === f)?.[1] || f).join("・")}`,
  ].filter(Boolean).join(" / "));
  return rows.length ? `所持ゲームの登録依頼（${rows.length}件）\n${rows.map((r) => "・" + r).join("\n")}` : "";
}
function flash(btn, msg) {
  const old = btn.dataset.label ||= btn.textContent;
  btn.textContent = msg; clearTimeout(btn._t); btn._t = setTimeout(() => (btn.textContent = old), 2500);
}
function saveOwned() { store.set(LS_OWNED, owned); render(); }

function drawAdd() {
  const box = document.getElementById("oAdd");
  document.getElementById("oAddBtn").classList.toggle("on", OS.adding);
  if (!OS.adding) { box.innerHTML = ""; return; }
  const baseNames = ownedGroups().bases.map((g) => g.name);
  const form = document.createElement("form");
  form.className = "add card";
  form.innerHTML = OS.bulk
    ? `<textarea name="names" rows="6" placeholder="1行に1つずつゲーム名を貼り付け"></textarea><div class="r"><span class="s" style="flex:1;font-size:12px;color:var(--muted)">登録済みの名前は飛ばします</span><button>まとめて追加</button></div>`
    : `<div class="r"><input name="name" placeholder="ゲーム名" required><button>追加</button></div>
      <input name="parent" list="ownedBases" placeholder="拡張のときは本体の名前（任意）"><datalist id="ownedBases">${baseNames.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <input name="bgg" placeholder="BGGのURL（任意）" inputmode="url">`;
  form.insertAdjacentHTML("beforeend", `<button type="button" class="linkbtn">${OS.bulk ? "1件ずつ追加に戻す" : "まとめて貼り付けで追加"}</button>`);
  form.querySelector(".linkbtn").onclick = () => { OS.bulk = !OS.bulk; drawAdd(); };
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const have = new Set(owned.map((g) => norm(g.name)));
    const list = OS.bulk ? String(f.get("names")).split(/\n/).map((x) => x.replace(/^[\s・\-*\d.、)]+/, "").trim()).filter(Boolean) : [f.get("name").trim()];
    const now = new Date().toISOString();
    for (const name of list) {
      if (have.has(norm(name))) continue;
      have.add(norm(name)); ownedGone.delete(norm(name));
      const g = { name, key: norm(name), bgg: OS.bulk ? "" : f.get("bgg").trim(), added: now };
      const parent = OS.bulk ? "" : String(f.get("parent") || "").trim();
      if (parent) g.parent = parent;
      owned.unshift(g);
    }
    store.set("bgb.ownedgone.v1", [...ownedGone]); OS.adding = false; OS.bulk = false; drawAdd(); saveOwned();
  };
  box.innerHTML = ""; box.appendChild(form);
}

function drawOwned() {
  const root = document.getElementById("ownedPage");
  if (!root || !opageBuilt) return;
  const $ = (id) => root.querySelector("#" + id);
  const { bases, kids } = ownedGroups();
  $("oCount").textContent = `${bases.length} 本体${owned.length > bases.length ? `・拡張 ${owned.length - bases.length}` : ""}`;
  $("oFlag").querySelectorAll("button[data-v]").forEach((b) => { const k = b.dataset.v, l = k ? FLAGS.find((x) => x[0] === k)[1] : "指定なし"; const n = k ? owned.filter((g) => (g.flags || []).includes(k)).length : 0; b.textContent = n ? `${l} ${n}` : l; });
  // 操作部品の状態
  if ($("oQ").value !== OS.q) $("oQ").value = OS.q;
  const on = (id, v) => $(id).querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === String(v)));
  on("oPl", OS.players); on("oTime", OS.time); on("oWt", OS.weight); on("oFlag", OS.flag); on("oView", OS.view); on("oNm", nameMode); on("oBox", OS.boxes);
  drawSleeveSum();
  $("oBest").checked = OS.best; $("oBest").disabled = !OS.players; $("oSort").value = OS.sort;
  // カテゴリー・メカニクスの候補（多い順）
  const count = (f) => { const m = new Map(); for (const g of bases) for (const x of f(oinfo(g)) || []) m.set(x, (m.get(x) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
  const opts = (list, label, cur, tr) => `<option value="">${label}：すべて</option>` + list.map(([k, n]) => `<option value="${esc(k)}"${k === cur ? " selected" : ""}>${esc(tr(k))}（${n}）</option>`).join("");
  $("oCat").innerHTML = opts(count((i) => i?.categories), "カテゴリー", OS.cat, catJa);
  $("oMech").innerHTML = opts(count((i) => i?.mechanics), "メカニクス", OS.mech, mechJa);
  $("oCat").classList.toggle("on", !!OS.cat); $("oMech").classList.toggle("on", !!OS.mech);
  // 絞り込み
  const terms = OS.q.split(/[\s　]+/).map(norm).filter(Boolean);
  const hit = (g) => { const h = hay(g); return terms.every((t) => h.includes(t)); };
  let rows = bases.map((g) => ({ g, kids: kids.get(g) || [] })).filter((r) => passFilters(r.g));
  if (terms.length) rows = rows.map((r) => ({ ...r, kidHit: !hit(r.g) && r.kids.some(hit) })).filter((r) => hit(r.g) || r.kidHit);
  rows = sortRows(rows);
  const active = terms.length || OS.flag || OS.players || OS.time || OS.weight || OS.cat || OS.mech;
  $("oHits").textContent = active ? `${rows.length} 件` : "";
  $("oClear").hidden = !active;
  const list = $("oList");
  list.className = { pack: "opack", shelf: "ogrid" }[OS.view] || "olist";
  list.innerHTML = rows.length ? "" : `<div class="empty">${active ? "条件に合うゲームがありません。" : "まだ登録がありません。「＋ 追加」から登録するか、棚の写真をチャットで送ってください。"}</div>`;
  const shown = rows.slice(0, OS.n);
  if (OS.view === "pack" && shown.length) packLayout(list, shown.map(tile));
  else for (const r of shown) list.appendChild(OS.view === "list" ? listRow(r) : tile(r));
  if (rows.length > OS.n) {
    const m = document.createElement("button");
    m.className = "more"; m.textContent = `さらに表示（全 ${rows.length} 件）`;
    m.onclick = () => { OS.n += 60; drawOwned(); };
    list.appendChild(m);
  }
}
// 詰める表示：箱の縦横比に合わせて、いちばん短い列へ順に積む（左上から並ぶ順はおおむね保つ）
let packTiles = [];
function packLayout(list, tiles) {
  if (tiles) packTiles = tiles;
  const w = list.clientWidth || 360, n = Math.max(3, Math.floor((w + 8) / 128)), gap = 8, colW = (w - gap * (n - 1)) / n;
  const cols = Array.from({ length: n }, () => { const c = document.createElement("div"); c.className = "pcol"; return c; });
  const hs = new Array(n).fill(0);
  // 大中小のとき：中箱は列幅の8割、小箱は2つ並べて半分ずつ（同じ列の直前が空きのある小箱の段ならそこへ）
  const sized = OS.boxes === "size", last = new Array(n).fill(null);
  for (const t of packTiles) {
    const r = Math.min(t.dataset.img ? aspects[t.dataset.img] || 1 : 1, 2), sz = sized ? t.dataset.box || "M" : "L";
    t.classList.remove("pS", "pM", "pL"); t.classList.add("p" + sz);
    if (sz === "S") {
      // 空きのある小箱の段：いちばん低い列のものを優先
      const open = last.map((x, k) => x && x.children.length < 2 ? k : -1).filter((k) => k >= 0).sort((a, b) => hs[a] - hs[b])[0];
      if (open !== undefined) {
        const row = last[open], h = (colW - 6) / 2 * r + 20;
        row.appendChild(t);
        if (h > +row.dataset.h) { hs[open] += h - +row.dataset.h; row.dataset.h = h; }
        last[open] = null;
        continue;
      }
      const k = hs.indexOf(Math.min(...hs)), row = document.createElement("div"), h = (colW - 6) / 2 * r + 20;
      row.className = "prow"; row.dataset.h = h; row.appendChild(t);
      cols[k].appendChild(row); hs[k] += h + gap; last[k] = row;
      continue;
    }
    const k = hs.indexOf(Math.min(...hs));
    cols[k].appendChild(t);
    hs[k] += colW * (sz === "M" ? 0.8 : 1) * r + 20 + gap;
  }
  list.querySelectorAll(".pcol").forEach((c) => c.remove());
  list.prepend(...cols);
}
let packTimer = 0;
const repack = () => { clearTimeout(packTimer); packTimer = setTimeout(() => { const l = document.querySelector("#oList.opack"); if (l) packLayout(l); }, 120); };
window.addEventListener("resize", repack);
function noteAspect(img) {
  const u = img.getAttribute("src");
  if (!img.naturalWidth || aspects[u]) return;
  aspects[u] = +(img.naturalHeight / img.naturalWidth).toFixed(3);
  clearTimeout(aspectSave); aspectSave = setTimeout(() => store.set("bgb.aspect.v1", aspects), 1000);
  repack();
}

function openSheet(g) {
  if (!OS.sheet) history.pushState({ sheet: 1 }, "", "#owned");
  OS.sheet = g; OS.edit = false; OS.sleeveEdit = false; OS.memo = false; OS.expN = 8; OS.link = null; drawSheet();
}
function closeSheet() { if (history.state?.sheet) history.back(); else { OS.sheet = null; drawSheet(); } }

function tile({ g, kids, kidHit }) {
  const t = document.createElement("button");
  t.className = "tile";
  const img = ownedImg(g), tt = ownedTitle(g), meta = [shortPlayers(g), shortTime(g)].filter(Boolean);
  t.innerHTML = `<div class="tart"><span class="tbox">${img ? `<img src="${esc(img)}" alt="" loading="lazy" onload="noteAspect(this)">` : `<span class="tname">${esc(tt.main)}</span>`}
      ${g.flags?.length ? `<div class="tflags">${flagTags(g, "tflag")}</div>` : ""}
      ${kids.length ? `<span class="tbadge${kidHit ? " hit" : ""}">＋拡張${kids.length}</span>` : ""}</span></div>
    <div class="tov">${meta.length ? meta.map((m, k) => `<span class="ic">${k ? "⏱" : "👥"}</span>${esc(m.replace(/〜/g, "-"))}`).join(" ") : "&nbsp;"}</div>`;
  if (img) t.dataset.img = img;
  t.dataset.box = boxSize(g).t;
  if (OS.boxes === "size") t.classList.add("b" + t.dataset.box);
  t.title = tt.main;
  t.onclick = () => openSheet(g);
  return t;
}
function listRow({ g, kids, kidHit }) {
  const r = document.createElement("div");
  r.className = "row";
  const img = ownedImg(g), t = ownedTitle(g), i = oinfo(g);
  const meta = [shortPlayers(g) && "👥 " + shortPlayers(g), shortTime(g) && "⏱ " + shortTime(g), i?.weight && "重さ " + i.weight].filter(Boolean).join("　");
  r.innerHTML = `<div class="thumb" ${img ? `style="background-image:url('${esc(img)}')"` : ""}>${img ? "" : "🎲"}</div><div class="rt">
    <div class="t">${esc(t.main)}${kids.length ? `<span class="tag rel${kidHit ? " hit" : ""}">拡張 ${kids.length}</span>` : ""}${g.includes ? `<span class="tag">${esc(g.includes)}</span>` : ""}${flagTags(g)}</div>
    ${t.sub ? `<div class="en">${esc(t.sub)}</div>` : ""}<div class="s">${esc(meta || (g.bgg ? "BGGの情報は自動取得のあとに表示" : "BGG未設定"))}</div></div><div class="rd">›</div>`;
  r.style.cursor = "pointer";
  r.onclick = () => openSheet(g);
  return r;
}

// 詳細シート
function drawSheet() {
  const w = document.getElementById("oSheet");
  if (!w) return;
  const g = OS.sheet;
  if (!g || !owned.includes(g) || location.hash !== "#owned") { w.hidden = true; w.innerHTML = ""; document.body.classList.remove("noscroll"); if (g && !owned.includes(g)) OS.sheet = null; return; }
  const keep = w.querySelector(".sheet")?.scrollTop || 0;
  const { kids, rootOf } = ownedGroups();
  const base = rootOf.get(g) || null, i = oinfo(g), t = ownedTitle(g, base), img = ownedImg(g);
  w.hidden = false; document.body.classList.add("noscroll");
  w.innerHTML = `<div class="sback"></div><div class="sheet" role="dialog">
    <div class="shead"><button class="sx" data-a="close" aria-label="閉じる">✕</button></div>
    <div class="shero">${img ? `<img src="${esc(img)}" alt="">` : `<div class="noimg">${base ? "🧩" : "🎲"}</div>`}
      <div class="sttl"><h2>${esc(t.main)}</h2>${t.sub ? `<div class="en">${esc(t.sub)}</div>` : ""}
        ${base ? `<button class="plink" data-a="base">本体：${esc(ownedTitle(base).main)} ›</button>` : ""}
        <div class="stags">${flagTags(g)}${OS.memo ? "" : `<button class="memobtn" data-a="memo">${g.includes ? `<span class="tag">${esc(g.includes)}</span> ✎` : "＋メモ"}</button>`}</div>
        ${OS.memo ? `<form class="memoform"><input name="m" value="${esc(g.includes || "")}" placeholder="例：拡張入り・スリーブ済み"><button>保存</button><button type="button" data-a="memox">やめる</button></form>` : ""}
        <div class="sacts"><button data-a="edit" class="${OS.edit ? "on" : ""}">✎ 編集</button>${g.bgg ? `<a href="${esc(g.bgg)}" target="_blank" rel="noopener">BGG ↗</a>` : ""}</div></div></div>
    <div class="sbody"></div></div>`;
  const body = w.querySelector(".sbody");
  w.querySelector(".sback").onclick = closeSheet;
  w.querySelector("[data-a=close]").onclick = closeSheet;
  w.querySelector("[data-a=memo]")?.addEventListener("click", () => { OS.memo = true; drawSheet(); w.querySelector(".memoform input").focus(); });
  w.querySelector("[data-a=memox]")?.addEventListener("click", () => { OS.memo = false; drawSheet(); });
  const mf = w.querySelector(".memoform");
  if (mf) mf.onsubmit = (e) => {
    e.preventDefault();
    const v = mf.m.value.trim();
    if (v !== (g.includes || "")) { if (v) g.includes = v; else delete g.includes; g.edited = [...new Set([...(g.edited || []), "includes"])]; }
    OS.memo = false; saveOwned();
  };
  w.querySelector("[data-a=edit]").onclick = () => { OS.edit = !OS.edit; drawSheet(); };
  w.querySelector("[data-a=base]")?.addEventListener("click", () => { OS.sheet = base; OS.edit = false; OS.sleeveEdit = false; drawSheet(); });
  if (OS.edit) body.appendChild(editPanel(g));
  body.appendChild(infoBlock(g, i));
  body.appendChild(sleeveBlock(g));
  // 所持している拡張
  const mine = !base ? kids.get(g) || [] : [];
  if (mine.length) {
    body.insertAdjacentHTML("beforeend", `<div class="lbl">所持している拡張（${mine.length}）</div>`);
    for (const x of mine) {
      const r = document.createElement("div");
      r.className = "xrow"; r.style.cursor = "pointer";
      const xi = ownedImg(x), xt = ownedTitle(x, g);
      r.innerHTML = `<div class="thumb" ${xi ? `style="background-image:url('${esc(xi)}')"` : ""}>${xi ? "" : "🧩"}</div><div class="rt"><div class="t">${esc(xt.main)}${flagTags(x)}</div>${xt.sub ? `<div class="s">${esc(xt.sub)}</div>` : ""}</div><div class="rd">›</div>`;
      r.onclick = () => { OS.sheet = x; OS.edit = false; OS.sleeveEdit = false; drawSheet(); };
      body.appendChild(r);
    }
  }
  body.appendChild(expBlock(g, base || g, i));
  w.querySelector(".sheet").scrollTop = keep;
}

function infoBlock(g, i) {
  const p = document.createElement("div");
  p.className = "sinfo";
  if (!i) { p.innerHTML = `<div class="s">${bggId(g) ? "BGGの情報は次の自動取得のあとに表示されます。" : "BGGのURLを登録すると（✎ 編集から）、人数やメカニクスなどが表示されます。"}</div>`; return p; }
  const who = (arr) => (arr || []).map((n) => `<button class="pchip" data-q="${esc(n)}">${esc(n)}</button>`).join("");
  const facts = [
    i.minp && ["人数", `${i.minp === i.maxp ? i.minp : `${i.minp}〜${i.maxp}`}人${i.best ? `（ベスト ${i.best}人` : ""}${i.rec ? `${i.best ? "・" : "（"}推奨 ${i.rec}人）` : i.best ? "）" : ""}`],
    (i.time || i.minTime) && ["時間", shortTime(g)],
    i.age && ["対象年齢", `${i.age}歳〜`], i.year && ["発売年", `${i.year}年`],
    i.weight && ["重さ", `${i.weight} / 5`], i.rating && ["BGG評価", `${i.rating}${i.rank ? `（${i.rank}位）` : ""}`],
    ((b) => (b.cm || b.manual) && ["箱", [boxLabel(b.t), cmText(b.cm)].filter(Boolean).join("・")])(boxSize(g)),
  ].filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`);
  for (const [k, arr] of [["デザイナー", i.designers], ["アーティスト", i.artists], ["出版社", i.publishers]]) if (arr?.length) facts.push(`<dt>${k}</dt><dd class="pchips">${who(arr)}</dd>`);
  const chips = (arr, kind, tr) => (arr || []).map((x) => `<button class="${kind === "cat" ? "cchip" : "mchip"}" data-${kind}="${esc(x)}">${esc(tr(x))}</button>`).join("");
  p.innerHTML = `<dl>${facts.join("")}</dl>
    ${i.categories?.length ? `<div class="lbl">カテゴリー</div><div class="mechs">${chips(i.categories, "cat", catJa)}</div>` : ""}
    ${i.mechanics?.length ? `<div class="lbl">メカニクス</div><div class="mechs">${chips(i.mechanics, "mech", mechJa)}</div>` : ""}
    ${i.desc ? `<details class="desc"><summary>説明（BGG・英語）</summary><p>${esc(i.desc).replace(/\n/g, "<br>")}</p></details>`
      : i.v < 3 ? `<div class="s">カテゴリー以外の追加情報（出版社・アーティスト・説明）は次の自動取得で入ります。</div>` : ""}`;
  // タップで絞り込み・検索
  const jump = (patch) => { Object.assign(OS, { q: "", flag: "", players: 0, best: false, time: "", weight: "", cat: "", mech: "", n: 60 }, patch); closeSheet(); drawOwned(); window.scrollTo(0, 0); };
  p.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => jump({ cat: b.dataset.cat }));
  p.querySelectorAll("[data-mech]").forEach((b) => b.onclick = () => jump({ mech: b.dataset.mech }));
  p.querySelectorAll("[data-q]").forEach((b) => b.onclick = () => jump({ q: b.dataset.q }));
  return p;
}

// BGGの拡張一覧（＋所持で追加。名前だけで登録済みの拡張があれば、同じものとして紐づけもできる）
function expBlock(g, base, i) {
  const p = document.createElement("div");
  const exps = (i?.expansions || []).filter((e) => !/fan expansion/i.test(e.name))
    .sort((a, c) => /promo/i.test(a.name) - /promo/i.test(c.name) || (expInfo[c.id]?.year || 0) - (expInfo[a.id]?.year || 0));
  if (!exps.length) return p;
  const ids = new Set(owned.map(bggId).filter(Boolean));
  const names = new Set(owned.flatMap((o) => [norm(o.name), norm(enName(o))]).filter(Boolean));
  const kidsNoId = (ownedGroups().kids.get(base) || []).filter((x) => !bggId(x));
  p.innerHTML = `<div class="lbl">BGGの拡張一覧（${exps.length}件）</div>`;
  for (const e of exps.slice(0, OS.expN)) {
    const x = expInfo[e.id] || {};
    const have = ids.has(e.id) || names.has(norm(e.name));
    const r = document.createElement("div");
    r.className = "xrow";
    r.innerHTML = `<div class="thumb" ${x.thumb ? `style="background-image:url('${esc(hq(x.thumb))}')"` : ""}>${x.thumb ? "" : "🧩"}</div>
      <a class="rt" href="https://boardgamegeek.com/boardgameexpansion/${e.id}" target="_blank" rel="noopener"><div class="t">${esc(e.name)}</div><div class="s">${x.year ? x.year + "年" : ""}</div></a>
      ${have ? `<span class="tag">所持</span>` : `<button class="addx">＋所持</button>`}`;
    p.appendChild(r);
    if (OS.link === e.id) {
      const c = document.createElement("div");
      c.className = "linkask";
      c.innerHTML = `<div class="s">名前だけで登録済みの拡張と同じものですか？</div>${kidsNoId.map((k, n) => `<button data-n="${n}">「${esc(ownedTitle(k, base).main)}」と同じ</button>`).join("")}<button data-new="1">新しく追加</button>`;
      c.querySelectorAll("[data-n]").forEach((b) => b.onclick = () => {
        const k = kidsNoId[+b.dataset.n];
        k.bgg = `https://boardgamegeek.com/boardgameexpansion/${e.id}`; k.nameEn ||= e.name; k.edited = [...new Set([...(k.edited || []), "bgg"])];
        OS.link = null; saveOwned();
      });
      c.querySelector("[data-new]").onclick = () => addExp(e, base);
      p.appendChild(c);
    }
    r.querySelector(".addx")?.addEventListener("click", () => { if (kidsNoId.length) { OS.link = OS.link === e.id ? null : e.id; drawSheet(); } else addExp(e, base); });
  }
  if (exps.length > OS.expN) {
    const m = document.createElement("button");
    m.className = "more"; m.textContent = `拡張をさらに表示（全 ${exps.length} 件）`;
    m.onclick = () => { OS.expN += 20; drawSheet(); };
    p.appendChild(m);
  }
  return p;
}
function addExp(e, base) {
  owned.unshift({ name: e.name, nameEn: e.name, key: norm(e.name), bgg: `https://boardgamegeek.com/boardgameexpansion/${e.id}`, parent: base.name, from: "拡張一覧から追加", added: new Date().toISOString() });
  ownedGone.delete(norm(e.name)); store.set("bgb.ownedgone.v1", [...ownedGone]); OS.link = null; saveOwned();
}

// 編集パネル：名前・英語名・本体・人数・同梱メモ・BGG・箱絵の選択・削除
function editPanel(g) {
  const i = oinfo(g);
  const p = document.createElement("form");
  p.className = "add oedit";
  const baseNames = ownedGroups().bases.map((x) => x.name).filter((n) => n !== g.name);
  const choices = [];
  if (i?.thumb) choices.push({ thumb: i.thumb, label: "BGG標準" });
  for (const v of i?.versions || []) choices.push({ thumb: v.thumb, label: [v.lang, v.year].filter(Boolean).join(" ") || v.name });
  const auto = art(g.name);
  if (auto && !choices.some((c) => c.thumb === auto)) choices.push({ thumb: auto, label: "自動" });
  let pick = g.img || "";
  p.innerHTML = `<label>日本語名<input name="name" value="${esc(g.name)}"></label>
    <label>英語名<input name="nameEn" value="${esc(g.nameEn || "")}" placeholder="${esc(i?.en || "BGGから自動で入ります")}"></label>
    <div class="r"><label>本体（拡張のとき）<input name="parent" list="ownedBases2" value="${esc(g.parent || "")}"></label>
      <label>人数・時間<input name="players" value="${esc(g.players || "")}" placeholder="${esc(playersText({ ...g, players: "" }) || "例：2〜4人・45分")}"></label></div>
    <datalist id="ownedBases2">${baseNames.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <label>箱の大きさ（大中小の表示用）<select name="box"><option value="">自動（${(({ auto, cm }) => boxLabel(auto) + (cm ? `・BGG ${cmText(cm)}` : "・寸法なし"))(boxSize({ ...g, box: "" }))}）</option>${BOXES.map(([k, l]) => `<option value="${k}"${g.box === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <div class="lbl">状態</div><div class="flagck">${FLAGS.map(([k, l]) => `<label><input type="checkbox" name="flag_${k}"${(g.flags || []).includes(k) ? " checked" : ""}>${l}</label>`).join("")}</div>
    <label>メモ（名前の後ろに表示）<input name="includes" value="${esc(g.includes || "")}" placeholder="例：拡張入り・スリーブ済み"></label>
    <label>登録元<input name="from" value="${esc(g.from || "")}" placeholder="例：写真 11/26"></label>
    <label>BGGのURL<input name="bgg" value="${esc(g.bgg || "")}" inputmode="url" placeholder="https://boardgamegeek.com/boardgame/…"></label>
    <div class="lbl">箱絵${choices.length ? "（タップで選択）" : ""}</div>
    <div class="arts">${choices.map((c) => `<button type="button" class="art${pick === c.thumb || (!pick && c.label === "BGG標準") ? " on" : ""}" data-t="${esc(c.thumb)}" style="background-image:url('${esc(c.thumb)}')"><span>${esc(c.label)}</span></button>`).join("")}
      ${!choices.length ? `<div class="s" style="font-size:12px;color:var(--muted)">${bggId(g) ? "BGGから候補を取得中です（次の自動取得のあと表示されます）" : "BGGのURLを入れると、版ごとの箱絵から選べるようになります"}</div>` : ""}</div>
    <input name="img" value="${esc(choices.some((c) => c.thumb === pick) ? "" : pick)}" inputmode="url" placeholder="画像のURLを直接指定（BGGにない版など）">
    <div class="r"><button type="button" class="ghostbtn" data-a="del">削除</button><span style="flex:1"></span><button type="button" class="ghostbtn" data-a="close">閉じる</button><button>保存</button></div>`;
  p.querySelectorAll(".art").forEach((x) => x.onclick = () => {
    pick = x.dataset.t; p.querySelectorAll(".art").forEach((y) => y.classList.toggle("on", y === x)); p.img.value = "";
  });
  p.querySelector("[data-a=close]").onclick = () => { OS.edit = false; drawSheet(); };
  p.querySelector("[data-a=del]").onclick = () => {
    if (!confirm(`「${g.name}」を削除しますか？`)) return;
    ownedGone.add(okey(g)); ownedGone.add(norm(g.name)); store.set("bgb.ownedgone.v1", [...ownedGone]);
    owned = owned.filter((x) => x !== g); closeSheet(); saveOwned();
  };
  p.onsubmit = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(p));
    const edited = new Set(g.edited || []);
    const oldName = g.name;
    g.key ||= norm(oldName);
    if (f.name.trim() && f.name.trim() !== oldName) {
      g.name = f.name.trim();
      for (const x of owned) if (x.parent && norm(x.parent) === norm(oldName)) x.parent = g.name;   // 拡張の紐づけも付け替え
    }
    for (const k of ["nameEn", "players", "parent", "includes", "bgg", "from"]) {
      const v = f[k].trim();
      if (v !== (g[k] || "")) { if (v) g[k] = v; else delete g[k]; if (["parent", "includes", "bgg"].includes(k)) edited.add(k); }
    }
    if (f.box !== (g.box || "")) { if (f.box) g.box = f.box; else delete g.box; }
    const flags = FLAGS.map(([k]) => k).filter((k) => f["flag_" + k]);
    if (flags.join() !== (g.flags || []).join()) { if (flags.length) g.flags = flags; else delete g.flags; edited.add("flags"); }
    const img = f.img.trim() || (pick && pick !== i?.thumb ? pick : "");
    if (img !== (g.img || "")) { if (img) g.img = img; else delete g.img; edited.add("img"); }
    g.edited = [...edited];
    OS.edit = false; saveOwned();
  };
  return p;
}

// ===== スリーブ =====
// BGGの版ごとのカード（日本語版を先頭に）
function bggSleeveSets(g) {
  const sets = sleeveInfo[bggId(g)]?.sets || [];
  return [...sets].sort((a, b) => /japan|日本/i.test(b.name) - /japan|日本/i.test(a.name) || a.addon - b.addon);
}
// 版のカードを読み込むとき、手持ちのスリーブから合うものを選んでおく
const setCards = (set) => (set?.cards || []).map((c) => ({ name: c.name, w: c.w, h: c.h, n: c.n, sid: suggest(c)?.id }));
const slvLine = (r) => {
  const cat = catById(r.sid), pk = packsText(r.n, cat);
  return `${r.done ? "✓ " : ""}${esc(slvName(r) || (r.done ? "スリーブ済み" : "スリーブ未定"))}${pk ? `・${pk}` : ""}${cat && fitOf(cat, r) === "ゆるめ" ? "（ゆるめ）" : ""}${cat && !fitOf(cat, r) ? "（サイズ違い？）" : ""}`;
};

// 詳細シートのスリーブ欄：登録済みの一覧と編集（BGGのデータがあれば版を選んで読み込み）
function sleeveBlock(g) {
  const p = document.createElement("div");
  p.className = "sleeves";
  const sets = bggSleeveSets(g);
  const list = g.sleeves || [], bgg = setCards(sets[0]);
  const total = list.reduce((a, s) => a + (+s.n || 0), 0), done = list.filter((s) => s.done).reduce((a, s) => a + (+s.n || 0), 0);
  p.innerHTML = `<div class="lbl">スリーブ${list.length ? `（${total}枚${done ? done === total ? "・すべてスリーブ済み" : `・${done}枚スリーブ済み` : ""}）` : ""}<button class="mini" data-a="sedit">${OS.sleeveEdit ? "やめる" : list.length ? "✎ 編集" : "＋ 登録"}</button></div>`;
  if (!OS.sleeveEdit) {
    for (const s of list) p.insertAdjacentHTML("beforeend", `<div class="srow${s.done ? " done" : ""}"><span class="sz">${s.w ? esc(sizeKey(s)) + "<small>mm</small>" : "サイズ未入力"}</span>
      <span class="sn">${esc(s.name || "カード")}${sizeName(sizeKey(s)) ? `<small>${esc(sizeName(sizeKey(s)))}</small>` : ""}</span><span class="sc">${s.n ? `${s.n}枚` : ""}</span>
      <span class="sk">${slvLine(s)}</span></div>`);
    if (!list.length && bgg.length) p.insertAdjacentHTML("beforeend", `<div class="s">BGGのデータ${sets.length > 1 ? `（${sets.length}版。${esc(sets[0].name)} ほか）` : sets[0].name ? `（${esc(sets[0].name)}）` : ""}：${bgg.map((s) => `${esc(s.name || "カード")} ${sizeKey(s)}mm ${s.n || "?"}枚${s.sid ? ` → ${esc(catById(s.sid).name)} ${packsText(s.n, catById(s.sid))}` : ""}`).join("、")}<br>「＋ 登録」で取り込めます。</div>`);
    else if (!list.length) p.insertAdjacentHTML("beforeend", `<div class="s">カードのサイズと枚数、使うスリーブを記録できます。</div>`);
    p.querySelector("[data-a=sedit]").onclick = () => { OS.sleeveEdit = true; drawSheet(); };
    return p;
  }
  // 編集フォーム
  let rows = (list.length ? list : bgg.length ? bgg : [{}]).map((s) => ({ ...s }));
  const f = document.createElement("form");
  f.className = "add sform";
  const opts = (r) => {
    const fit = sleeveCat.map((x) => [x, fitOf(x, r)]).sort((a, b) => !!b[1] - !!a[1]);
    const other = !r.sid && r.kind;
    return `<option value="">スリーブ未定</option>${fit.map(([x, ft]) => `<option value="${esc(x.id)}"${r.sid === x.id ? " selected" : ""}>${ft ? (ft === "ぴったり" ? "◎ " : "○ ") : ""}${esc(x.name)}（${x.w}×${x.h}${x.stock ? `・在庫${x.stock}` : ""}）</option>`).join("")}
      <option value="_other"${other ? " selected" : ""}>その他（名前を入力）</option>`;
  };
  const draw = () => {
    f.innerHTML = `${sets.length ? `<div class="r bggset"><select name="set">${sets.map((x, k) => `<option value="${k}">${esc(x.name || "版の名前なし")}（${x.cards.reduce((a, c) => a + c.n, 0)}枚）</option>`).join("")}</select><button type="button" class="ghostbtn" data-a="bgg">${list.length ? "この版で置き換え" : "この版を読み込む"}</button></div>` : ""}
      ${rows.map((s, k) => `<div class="sedit" data-k="${k}">
        <div class="r"><input name="name" value="${esc(s.name || "")}" placeholder="カードの名前（例：メインデッキ）"><button type="button" class="ghostbtn" data-del="${k}" title="この行を消す">✕</button></div>
        <div class="r"><input name="size" value="${s.w ? esc(sizeKey(s)) : ""}" list="slvSizes" placeholder="サイズ mm（例：63.5×88）" inputmode="decimal"><input name="n" value="${esc(s.n || "")}" placeholder="枚数" inputmode="numeric" class="num"></div>
        <div class="r"><select name="sid">${opts(s)}</select><label class="ck"><input type="checkbox" name="done"${s.done ? " checked" : ""}>済み</label></div>
        <input name="kind" value="${esc(s.sid ? "" : s.kind || "")}" placeholder="スリーブの名前（例：Mayday スタンダード）"${!s.sid && s.kind ? "" : " hidden"}></div>`).join("")}
      <datalist id="slvSizes">${SLEEVE_SIZES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</datalist>
      ${sleeveCat.length ? "" : `<div class="s">◎○は手持ちのスリーブで合うもの。ページ下の「スリーブ」→「手持ち」で、よく使うスリーブを登録すると選べます。</div>`}
      <div class="r"><button type="button" class="ghostbtn" data-a="add">＋ 行を追加</button><span style="flex:1"></span><button>保存</button></div>`;
    f.querySelector("[data-a=add]").onclick = () => { rows = read(); rows.push({}); draw(); };
    f.querySelector("[data-a=bgg]")?.addEventListener("click", () => { const k = +f.querySelector("[name=set]").value; rows = setCards(sets[k]); if (!rows.length) rows.push({}); draw(); f.querySelector("[name=set]").value = k; });
    f.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { rows = read(); rows.splice(+b.dataset.del, 1); if (!rows.length) rows.push({}); draw(); });
    f.querySelectorAll("[name=sid]").forEach((sel) => sel.onchange = () => { const k = sel.closest(".sedit").querySelector("[name=kind]"); k.hidden = sel.value !== "_other"; if (!k.hidden) k.focus(); });
    // サイズを入れたら、未定の行に合うスリーブを選ぶ
    f.querySelectorAll("[name=size]").forEach((inp) => inp.onchange = () => {
      const sel = inp.closest(".sedit").querySelector("[name=sid]"), sz = parseSize(inp.value);
      const x = sz && !sel.value && suggest({ w: sz[0], h: sz[1] });
      if (x) sel.value = x.id;
    });
  };
  const read = () => [...f.querySelectorAll(".sedit")].map((d) => {
    const v = (n) => d.querySelector(`[name=${n}]`);
    const sz = parseSize(v("size").value), sid = v("sid").value;
    const o = { name: v("name").value.trim(), n: parseInt(v("n").value.replace(/[^\d]/g, "")) || 0, done: v("done").checked };
    if (sz) [o.w, o.h] = sz;
    if (sid === "_other") o.kind = v("kind").value.trim();
    else if (sid) { o.sid = sid; o.kind = catById(sid)?.name || ""; }   // 名前も残す（手持ちから消しても分かるように）
    return o;
  });
  f.onsubmit = (e) => {
    e.preventDefault();
    const out = read().filter((s) => s.w || s.name || s.n || s.kind).map((s) => Object.fromEntries(Object.entries(s).filter(([, x]) => x !== "" && x !== 0 && x !== false && x != null)));
    if (out.some((s) => !s.w) && !confirm("サイズが入っていない行があります。このまま保存しますか？")) return;
    if (out.length) g.sleeves = out; else delete g.sleeves;
    OS.sleeveEdit = false; saveOwned();
  };
  draw();
  p.querySelector("[data-a=sedit]").onclick = () => { OS.sleeveEdit = false; drawSheet(); };
  p.appendChild(f);
  return p;
}

// ページ下の「スリーブ」：手持ち（よく使うスリーブの登録・在庫・使っているゲーム）と集計（カードサイズ別）
function drawSleeveSum() {
  const box = document.getElementById("oSleeves");
  if (!box) return;
  document.querySelector("#ownedPage [data-a=slv]")?.classList.toggle("on", OS.sleeveSum);
  if (!OS.sleeveSum) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="card ssum"><div class="lbl">スリーブ<div class="seg sm" id="slvTab"><button data-v="cat">手持ち（${sleeveCat.length}）</button><button data-v="sum">集計</button></div><button class="mini" data-a="x">閉じる</button></div><div class="sbody2"></div></div>`;
  box.querySelectorAll("#slvTab button").forEach((b) => { b.classList.toggle("on", b.dataset.v === OS.slvTab); b.onclick = () => { OS.slvTab = b.dataset.v; drawSleeveSum(); }; });
  box.querySelector("[data-a=x]").onclick = () => { OS.sleeveSum = false; drawSleeveSum(); };
  const body = box.querySelector(".sbody2");
  if (OS.slvTab === "sum") sleeveTotals(body); else sleeveCatalog(body);
  body.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => openSheet(owned[+b.dataset.g]));
}
const gameChip = (g, extra = "") => `<button class="pchip" data-g="${owned.indexOf(g)}">${esc(ownedTitle(g).main)}${extra}</button>`;

// 手持ち：一覧（在庫・使用済み・これから必要）。タップで使っているゲームと編集
function sleeveCatalog(body) {
  const use = (x) => {
    const rows = owned.flatMap((g) => (g.sleeves || []).filter((r) => r.sid === x.id).map((r) => ({ g, r })));
    return { rows, used: rows.filter((o) => o.r.done).reduce((a, o) => a + (+o.r.n || 0), 0), need: rows.filter((o) => !o.r.done).reduce((a, o) => a + (+o.r.n || 0), 0) };
  };
  const list = [...sleeveCat].sort((a, b) => !!b.fav - !!a.fav || (a.brand || "ん").localeCompare(b.brand || "ん", "ja") || a.w * a.h - b.w * b.h);
  body.innerHTML = list.length ? `<div class="s">★はよく使うスリーブ（ゲームのスリーブ欄で優先して選ばれます）。大きさは袋に書いてあるスリーブの寸法です。</div>` : `<div class="s">よく使うスリーブを登録しておくと、ゲームのスリーブ欄でサイズに合うものが自動で選ばれ、何袋いるかも表示されます。スリーブ側からは、使っているゲームを確認できます。</div>`;
  let group = null;
  for (const x of list) {
    const gname = x.fav ? "★ よく使う" : x.brand || "その他";
    if (gname !== group) { group = gname; body.insertAdjacentHTML("beforeend", `<div class="lbl3 catg">${esc(gname)}</div>`); }
    const u = use(x), open = OS.slvOpen === x.id, short = x.stock != null && x.stock !== "" && u.need > +x.stock;
    const d = document.createElement("div");
    d.className = "cat" + (open ? " open" : "");
    const fc = fitCards(x);
    d.innerHTML = `<button class="cath"><span class="cn">${x.fav ? "★ " : ""}${esc(x.name)}</span><span class="cs">${x.w}×${x.h}mm${x.pack ? `・1袋${x.pack}枚` : ""}</span>
        ${fc.length ? `<span class="cf">カード ${fc.map(([k, l]) => `${k}`).join("・")}</span>` : ""}
        <span class="cc">使用 ${u.used}枚${u.need ? `・<b class="${short ? "left" : ""}">これから ${u.need}枚</b>` : ""}${x.stock !== undefined && x.stock !== "" ? `・在庫 ${x.stock}枚` : ""}</span></button>`;
    d.querySelector(".cath").onclick = () => { OS.slvOpen = open ? null : x.id; drawSleeveSum(); };
    if (open) {
      const usedBy = u.rows.filter((o) => o.r.done), needBy = u.rows.filter((o) => !o.r.done);
      d.insertAdjacentHTML("beforeend", `<div class="catb">
        ${x.note ? `<div class="s">${esc(x.note)}</div>` : ""}
        <div class="lbl3">使っているゲーム（${usedBy.length}）</div><div class="todos">${usedBy.map((o) => gameChip(o.g, ` ${o.r.n || "?"}枚`)).join("") || `<span class="s">まだありません</span>`}</div>
        ${needBy.length ? `<div class="lbl3">これから使う予定（${needBy.length}）</div><div class="todos">${needBy.map((o) => gameChip(o.g, ` ${o.r.n || "?"}枚`)).join("")}</div>` : ""}</div>`);
      d.querySelector(".catb").appendChild(catForm(x));
    }
    body.appendChild(d);
  }
  const add = document.createElement("details");
  add.className = "catadd";
  add.open = OS.slvOpen === "_new";
  add.innerHTML = `<summary>＋ スリーブを登録</summary>`;
  add.ontoggle = () => { OS.slvOpen = add.open ? "_new" : null; };
  add.appendChild(catForm(null));
  body.appendChild(add);
}
function catForm(x) {
  const f = document.createElement("form");
  f.className = "add sform catf";
  f.innerHTML = `<input name="name" value="${esc(x?.name || "")}" placeholder="名前（例：Mayday スタンダード プレミアム）" required>
    <div class="r"><input name="brand" value="${esc(x?.brand || "")}" placeholder="メーカー（まとめて表示）"><label class="ck"><input type="checkbox" name="fav"${x?.fav ? " checked" : ""}>★よく使う</label></div>
    <div class="r"><input name="size" value="${x ? esc(sizeKey(x)) : ""}" placeholder="スリーブの大きさ mm（袋の表示。例：65×90）" required inputmode="decimal"><input name="pack" value="${esc(x?.pack || "")}" placeholder="1袋の枚数" inputmode="numeric" class="num"></div>
    <div class="r"><input name="stock" value="${esc(x?.stock ?? "")}" placeholder="在庫の枚数（任意）" inputmode="numeric"><input name="note" value="${esc(x?.note || "")}" placeholder="メモ（厚さ・買った店など）"></div>
    <div class="r">${x ? `<button type="button" class="ghostbtn" data-a="del">削除</button>` : ""}<span style="flex:1"></span><button>${x ? "保存" : "登録"}</button></div>`;
  f.querySelector("[data-a=del]")?.addEventListener("click", () => {
    const n = owned.filter((g) => (g.sleeves || []).some((r) => r.sid === x.id)).length;
    if (!confirm(`「${x.name}」を手持ちから削除しますか？${n ? `\n使っている${n}ゲームには名前だけ残ります。` : ""}`)) return;
    sleeveCat = sleeveCat.filter((y) => y !== x); saveCat();
    if (x.preset) store.set(LS_SLVRM, [...new Set([...store.get(LS_SLVRM, []), x.id])]);
    OS.slvOpen = null; drawSleeveSum();
  });
  f.onsubmit = (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f)), sz = parseSize(v.size);
    if (!sz) { alert("サイズは「63.5×88」の形で入れてください"); return; }
    const num = (t) => { const n = parseInt(String(t).replace(/[^\d]/g, "")); return Number.isFinite(n) ? n : undefined; };
    const o = x || { id: "s" + Date.now().toString(36) };
    Object.assign(o, { name: v.name.trim(), brand: v.brand.trim() || undefined, fav: v.fav ? 1 : undefined, w: sz[0], h: sz[1], pack: num(v.pack), stock: num(v.stock), note: v.note.trim() || undefined, sz: 2 });
    for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
    if (!x) sleeveCat.push(o);
    // 名前を変えたら、ゲーム側に残している名前も直す
    for (const g of owned) for (const r of g.sleeves || []) if (r.sid === o.id) r.kind = o.name;
    saveCat(); store.set(LS_OWNED, owned); OS.slvOpen = x ? x.id : null; drawSleeveSum();
  };
  return f;
}

// 集計：カードサイズごとに必要・済み・あと。未開封だけ・BGGのデータ（未登録のゲーム）も含める切り替え
function sleeveTotals(body) {
  const by = new Map();
  let games = 0;
  for (const g of owned) {
    if (OS.slvUnopened && !(g.flags || []).includes("unopened")) continue;
    let rows = g.sleeves || [], fromBgg = false;
    if (!rows.length && OS.slvBgg) { rows = setCards(bggSleeveSets(g)[0]); fromBgg = true; }
    if (rows.length) games++;
    for (const s of rows) {
      const k = s.w ? sizeKey(s) : "サイズ未入力";
      if (!by.has(k)) by.set(k, { k, need: 0, done: 0, cats: new Map(), todo: [], area: (s.w || 0) * (s.h || 0), w: s.w, h: s.h });
      const x = by.get(k);
      x.need += +s.n || 0;
      if (s.done) x.done += +s.n || 0; else x.todo.push([g, s, fromBgg]);
      if (s.sid) x.cats.set(s.sid, (x.cats.get(s.sid) || 0) + (s.done ? 0 : +s.n || 0));
    }
  }
  const rows = [...by.values()].sort((a, b) => a.area - b.area);
  body.innerHTML = `<div class="sopts"><label class="ck"><input type="checkbox" data-o="slvUnopened"${OS.slvUnopened ? " checked" : ""}>未開封のゲームだけ</label>
      <label class="ck"><input type="checkbox" data-o="slvBgg"${OS.slvBgg ? " checked" : ""}>未登録のゲームはBGGのデータで数える</label></div>
    ${rows.length ? `<table><tr><th>サイズ(mm)<small>${games}ゲーム</small></th><th>必要</th><th>済み</th><th>あと</th></tr>${rows.map((r) => {
      // 手持ちで合うスリーブと在庫
      // おすすめ（自動で選ばれるもの）と、在庫があってぴったりのもの
      const best = suggest(r), more = sleeveCat.filter((x) => x !== best && +x.stock > 0 && fitOf(x, r) === "ぴったり");
      const fit = [best, ...more].filter(Boolean).slice(0, 3).map((x) => `${esc(x.name)}${x.stock !== undefined ? `（在庫${x.stock}）` : ""}${x.pack && r.need - r.done > 0 ? ` ${Math.ceil((r.need - r.done) / x.pack)}袋` : ""}`);
      return `<tr><td>${esc(r.k)}${sizeName(r.k) ? `<small>${esc(sizeName(r.k))}</small>` : ""}${fit.length ? `<div class="kinds">手持ち：${fit.join("・")}</div>` : r.w ? `<div class="kinds none">手持ちに合うスリーブなし</div>` : ""}</td>
      <td>${r.need}</td><td>${r.done}</td><td class="${r.need - r.done ? "left" : ""}">${r.need - r.done}</td></tr>
      ${r.todo.length ? `<tr class="todo"><td colspan="4"><div class="todos">${r.todo.map(([g, s, b]) => gameChip(g, `${s.n ? ` ${s.n}枚` : ""}${b ? "<small>BGG</small>" : ""}`)).join("")}</div></td></tr>` : ""}`;
    }).join("")}</table>`
    : `<div class="s">${OS.slvUnopened || !OS.slvBgg ? "条件に合う登録がありません。" : "まだ登録がありません。"}各ゲームの詳細の「スリーブ」から登録できます。</div>`}`;
  body.querySelectorAll("[data-o]").forEach((c) => c.onchange = () => { OS[c.dataset.o] = c.checked; drawSleeveSum(); });
}
