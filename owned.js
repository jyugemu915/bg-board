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
  ...store.get(LS_OVIEW, { view: "grid", sort: "added" }) };
const saveView = () => store.set(LS_OVIEW, { view: OS.view, sort: OS.sort });

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
  return norm([g.name, enName(g), i.ja, g.includes, ...(i.designers || []), ...(i.artists || []), ...(i.publishers || []), ...(i.families || []),
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
      <div class="seg sm" id="oView"><button data-v="grid" title="箱絵">▦</button><button data-v="list" title="リスト">☰</button></div></div>
    <div class="obar2"><span class="flbl">表記</span><div class="seg sm" id="oNm">${[["both", "両方"], ["ja", "日本語"], ["en", "English"]].map(([k, l]) => `<button data-v="${k}">${l}</button>`).join("")}</div></div>
    <div id="oList"></div>
    <div class="foot"><button type="button" data-a="exp">書き出し</button><label>読み込み<input type="file" accept=".json" hidden></label></div>
    <div id="oSheet" class="sheetwrap" hidden></div>`;
  const $ = (id) => root.querySelector("#" + id);
  const segs = [["oPl", "players", (v) => +v], ["oTime", "time"], ["oWt", "weight"], ["oFlag", "flag"], ["oView", "view"], ["oNm", null]];
  for (const [id, key, conv] of segs) $(id).onclick = (e) => {
    const btn = e.target.closest("button[data-v]");
    if (!btn) return;
    if (id === "oNm") { nameMode = btn.dataset.v; store.set("bgb.ownedname.v2", nameMode); }
    else { OS[key] = conv ? conv(btn.dataset.v) : btn.dataset.v; if (key === "view") saveView(); }
    OS.n = 60; drawOwned();
  };
  $("oQ").oninput = (e) => { OS.q = e.target.value; OS.n = 60; drawOwned(); };
  $("oBest").onchange = (e) => { OS.best = e.target.checked; drawOwned(); };
  $("oCat").onchange = (e) => { OS.cat = e.target.value; drawOwned(); };
  $("oMech").onchange = (e) => { OS.mech = e.target.value; drawOwned(); };
  $("oSort").onchange = (e) => { OS.sort = e.target.value; saveView(); drawOwned(); };
  $("oClear").onclick = () => { Object.assign(OS, { q: "", flag: "", players: 0, best: false, time: "", weight: "", cat: "", mech: "", n: 60 }); drawOwned(); };
  $("oAddBtn").onclick = () => { OS.adding = !OS.adding; drawAdd(); };
  root.querySelector("[data-a=exp]").onclick = () => {
    const blob = new Blob([JSON.stringify(owned, null, 1)], { type: "application/json" });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "owned-games.json" }).click();
  };
  root.querySelector(".foot input").onchange = async (e) => {
    try {
      const arr = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(arr)) throw 0;
      const have = new Set(owned.map((g) => g.name));
      owned = [...owned, ...arr.filter((g) => g?.name && !have.has(g.name))];
      saveOwned();
    } catch { alert("読み込めないファイルです"); }
  };
  // 戻る操作で詳細シートを閉じる
  window.addEventListener("popstate", () => { if (OS.sheet && location.hash === "#owned") { OS.sheet = null; OS.edit = false; drawSheet(); } });
  drawAdd();
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
  on("oPl", OS.players); on("oTime", OS.time); on("oWt", OS.weight); on("oFlag", OS.flag); on("oView", OS.view); on("oNm", nameMode);
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
  list.className = OS.view === "grid" ? "ogrid" : "olist";
  list.innerHTML = rows.length ? "" : `<div class="empty">${active ? "条件に合うゲームがありません。" : "まだ登録がありません。「＋ 追加」から登録するか、棚の写真をチャットで送ってください。"}</div>`;
  for (const r of rows.slice(0, OS.n)) list.appendChild(OS.view === "grid" ? tile(r) : listRow(r));
  if (rows.length > OS.n) {
    const m = document.createElement("button");
    m.className = "more"; m.textContent = `さらに表示（全 ${rows.length} 件）`;
    m.onclick = () => { OS.n += 60; drawOwned(); };
    list.appendChild(m);
  }
}
function openSheet(g) {
  if (!OS.sheet) history.pushState({ sheet: 1 }, "", "#owned");
  OS.sheet = g; OS.edit = false; OS.memo = false; OS.expN = 8; OS.link = null; drawSheet();
}
function closeSheet() { if (history.state?.sheet) history.back(); else { OS.sheet = null; drawSheet(); } }

function tile({ g, kids, kidHit }) {
  const t = document.createElement("button");
  t.className = "tile";
  const img = ownedImg(g), tt = ownedTitle(g), meta = [shortPlayers(g), shortTime(g)].filter(Boolean);
  t.innerHTML = `<div class="tart"><span class="tbox">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="tname">${esc(tt.main)}</span>`}
      ${g.flags?.length ? `<div class="tflags">${flagTags(g, "tflag")}</div>` : ""}
      ${kids.length ? `<span class="tbadge${kidHit ? " hit" : ""}">＋拡張${kids.length}</span>` : ""}</span></div>
    <div class="tov">${meta.length ? esc(meta.join("・").replace(/〜/g, "-")) : "&nbsp;"}</div>`;
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
  w.querySelector("[data-a=base]")?.addEventListener("click", () => { OS.sheet = base; OS.edit = false; drawSheet(); });
  if (OS.edit) body.appendChild(editPanel(g));
  body.appendChild(infoBlock(g, i));
  // 所持している拡張
  const mine = !base ? kids.get(g) || [] : [];
  if (mine.length) {
    body.insertAdjacentHTML("beforeend", `<div class="lbl">所持している拡張（${mine.length}）</div>`);
    for (const x of mine) {
      const r = document.createElement("div");
      r.className = "xrow"; r.style.cursor = "pointer";
      const xi = ownedImg(x), xt = ownedTitle(x, g);
      r.innerHTML = `<div class="thumb" ${xi ? `style="background-image:url('${esc(xi)}')"` : ""}>${xi ? "" : "🧩"}</div><div class="rt"><div class="t">${esc(xt.main)}${flagTags(x)}</div>${xt.sub ? `<div class="s">${esc(xt.sub)}</div>` : ""}</div><div class="rd">›</div>`;
      r.onclick = () => { OS.sheet = x; OS.edit = false; drawSheet(); };
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
    r.innerHTML = `<div class="thumb" ${x.thumb ? `style="background-image:url('${esc(x.thumb)}')"` : ""}>${x.thumb ? "" : "🧩"}</div>
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
    const flags = FLAGS.map(([k]) => k).filter((k) => f["flag_" + k]);
    if (flags.join() !== (g.flags || []).join()) { if (flags.length) g.flags = flags; else delete g.flags; edited.add("flags"); }
    const img = f.img.trim() || (pick && pick !== i?.thumb ? pick : "");
    if (img) g.img = img; else delete g.img;
    g.edited = [...edited];
    OS.edit = false; saveOwned();
  };
  return p;
}
