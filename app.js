// ボドゲ情報ボード：ボックスの配置と中身の表示
const LS_LAYOUT = "bgb.layout.v2";
const LS_OWNED = "bgb.owned.v1";
const LS_READ = "bgb.read.v1";
const LS_WATCH = "bgb.watch.v1";

const TYPES = {
  watch:    { title: "気になるゲーム" },
  calendar: { title: "発売カレンダー" },
  events:   { title: "イベント" },
  funding:  { title: "クラファン" },
  crowd:    { title: "注目クラファン" },
  shop:     { title: "ショップ入荷" },
  maker:    { title: "メーカー記事", filter: (i) => i.kind === "maker" && i.label === "記事" },
  news:     { title: "ニュース", filter: (i) => i.kind === "news" },
  owned:    { title: "所持ゲーム" },
  xlinks:   { title: "Xアカウント" },
};
const DEFAULT_LAYOUT = [
  { id: "bw", type: "watch", col: 1 },
  { id: "b1", type: "calendar", col: 0 },
  { id: "be", type: "events", col: 0 },
  { id: "b2", type: "maker", col: 0 },
  { id: "b3", type: "news", col: 0 },
  { id: "bf", type: "funding", col: 1 },
  { id: "bc", type: "crowd", col: 1 },
  { id: "b4", type: "shop", col: 1 },
  { id: "b5", type: "owned", col: 1 },
  { id: "b6", type: "xlinks", col: 1 },
];

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let layout = store.get(LS_LAYOUT, DEFAULT_LAYOUT);
let owned = store.get(LS_OWNED, []);
let read = new Set(store.get(LS_READ, []));
let watch = store.get(LS_WATCH, []);
let myEvents = store.get("bgb.myevents.v1", []);
let hiddenRel = new Set(store.get("bgb.hiddenrel.v1", []));
const saveHidden = () => store.set("bgb.hiddenrel.v1", [...hiddenRel]);
const isWatched = (name) => watch.some((w) => norm(name).includes(norm(w.q)) || norm(w.q).includes(norm(name)));
function markRead(urls) { urls.forEach((u) => read.add(u)); store.set(LS_READ, [...read].slice(-4000)); }
// 既存の配置に新しいボックスを一度だけ足す
if (!layout.some((b) => b.type === "watch") && !store.get("bgb.added.watch", false)) {
  layout.unshift({ id: "bw", type: "watch", col: 1 });
  store.set("bgb.added.watch", true);
}
if (!layout.some((b) => b.type === "funding") && !store.get("bgb.added.funding", false)) {
  const i = layout.findIndex((b) => b.type === "shop");
  layout.splice(i < 0 ? layout.length : i, 0, { id: "bf", type: "funding", col: 1 });
  store.set("bgb.added.funding", true);
}
if (!layout.some((b) => b.type === "crowd") && !store.get("bgb.added.crowd", false)) {
  const i = layout.findIndex((b) => b.type === "funding");
  layout.splice(i < 0 ? layout.length : i + 1, 0, { id: "bc", type: "crowd", col: 1 });
  store.set("bgb.added.crowd", true);
}
if (!layout.some((b) => b.type === "events") && !store.get("bgb.added.events", false)) {
  const i = layout.findIndex((b) => b.type === "calendar");
  layout.splice(i + 1, 0, { id: "be", type: "events", col: 0 });
  store.set("bgb.added.events", true);
}
for (const b of layout) if (b.unreadOnly === undefined) b.unreadOnly = b.type === "maker" || b.type === "news";
let editing = false;
let news = null, sources = null, events = null, bgg = null, crowd = null;
fetch("data/crowd.json?" + Date.now()).then((r) => r.json()).then((d) => { crowd = d; render(); }).catch(() => {});
// 写真から読み取った所持ゲーム（config/owned.json）を取り込む。削除したものは戻さない
// key＝登録時の名前（画面で名前を変えても同じゲームとして扱う）
let ownedGone = new Set(store.get("bgb.ownedgone.v1", []));
const okey = (g) => g.key || norm(g.name);
let ownedInfo = {}, expInfo = {}, sleeveInfo = {};
fetch("data/owned-info.json?" + Date.now()).then((r) => r.json()).then((d) => { ownedInfo = d.games || {}; expInfo = d.exps || {}; sleeveInfo = d.sleeves || {}; render(); }).catch(() => {});
fetch("config/owned.json?" + Date.now()).then((r) => r.json()).then((d) => {
  const have = new Map();
  for (const g of owned) { have.set(okey(g), g); have.set(norm(g.name), g); }
  let changed = false;
  for (const g of d.games || []) {
    const cur = have.get(norm(g?.name));
    if (!cur) continue;
    // 本体との紐づけ・同梱メモ・BGGリンクはファイルに合わせる（画面で変えたものは除く）
    for (const f of ["parent", "includes", "bgg", "flags", "img"]) if (g[f] && JSON.stringify(cur[f]) !== JSON.stringify(g[f]) && !(cur.edited || []).includes(f)) { cur[f] = g[f]; changed = true; }
  }
  // 画面の「＋所持」で先に登録した拡張（同じBGG ID）は、もう一度取り込まない
  const uiIds = new Set(owned.filter((g) => g.from === "拡張一覧から追加").map(bggId).filter(Boolean));
  const add = (d.games || []).filter((g) => g?.name && !have.has(norm(g.name)) && !ownedGone.has(norm(g.name)) && !uiIds.has(bggId(g)))
    .map((g) => ({ name: g.name, key: norm(g.name), bgg: g.bgg || "", ...(g.parent ? { parent: g.parent } : {}), ...(g.includes ? { includes: g.includes } : {}), ...(g.flags ? { flags: g.flags } : {}), ...(g.img ? { img: g.img } : {}),
      from: g.from || "写真から登録", added: new Date().toISOString() }));
  if (add.length) { owned = [...add, ...owned]; changed = true; }
  if (changed) { store.set(LS_OWNED, owned); render(); }
}).catch(() => {});
fetch("data/bgg.json?" + Date.now()).then((r) => r.json()).then((d) => { bgg = d; render(); }).catch(() => {});
// 箱絵の高画質版（scripts/img.mjs が作る data/img/<picID>.webp）。あればBGGの小さいサムネイルの代わりに使う
let hiImg = new Set();
fetch("data/img.json?" + Date.now()).then((r) => r.json()).then((d) => { hiImg = new Set(d.ok || []); render(); }).catch(() => {});
const hq = (u) => { const id = /geekdo-images\.com\/.*\/pic(\d+)\.[a-z]+$/i.exec(u || "")?.[1]; return id && hiImg.has(id) ? `data/img/${id}.webp` : u; };
// BGGの箱絵：名前（または「：」の前）で引く
function art(name) {
  const g = bgg?.games;
  if (!g || !name) return "";
  const base = name.replace(/【[^】]*】|\[[^\]]*\]|（[^）]*）|\([^)]*\)/g, "").trim();
  for (const k of [name, base, base.split(/[：:]/)[0]]) { const v = g[norm(k)]; if (v && !v.miss) return hq(v.thumb || v.image); }
  return "";
}
const ui = {}; // ボックスごとの表示状態（絞り込み・件数）

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const md = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };

async function loadData() {
  const [n, s] = await Promise.all([
    fetch("data/news.json?" + Date.now()).then((r) => r.json()).catch(() => null),
    fetch("config/sources.json?" + Date.now()).then((r) => r.json()).catch(() => null),
    fetch("data/events.json?" + Date.now()).then((r) => r.json()).catch(() => null),
  ]).then((x) => { events = x[2]; return x; });
  news = n; sources = s;
  const d = new Date();
  const upd = news?.updatedAt ? new Date(news.updatedAt) : null;
  document.getElementById("meta").textContent =
    `${d.getMonth() + 1}月${d.getDate()}日` + (upd ? ` ・ 最終更新 ${md(upd)} ${String(upd.getHours()).padStart(2, "0")}:${String(upd.getMinutes()).padStart(2, "0")}` : " ・ まだ自動取得されていません");
  render();
}

function saveLayout() { store.set(LS_LAYOUT, layout); }

// ページ：ホーム（ボード）／所持ゲーム（#owned）
const page = () => (location.hash === "#owned" ? "owned" : "home");
function render() {
  const pg = page();
  document.body.dataset.page = pg;
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.pg === pg));
  if (pg === "owned") return renderOwnedPage();
  drawSheet?.();
  const cols = document.querySelectorAll(".col");
  cols.forEach((c) => (c.innerHTML = ""));
  for (const b of layout) cols[b.col]?.appendChild(renderBox(b));
}

function boxShell(b, title, count, unread, unreadLabel = "未読") {
  const el = document.createElement("section");
  el.className = "box";
  el.innerHTML = `<div class="bh"><h2><span class="arw">${b.collapsed ? "▸" : "▾"}</span>${esc(title)}</h2>${count != null ? `<span class="count">${count}</span>` : ""}${unread ? `<span class="unread">${unreadLabel} ${unread}</span>` : ""}
    ${editing ? `<div class="tools">
      <button data-mv="up" title="上へ">↑</button><button data-mv="down" title="下へ">↓</button>
      <button data-mv="side" title="反対の列へ">⇄</button><button data-mv="del" title="削除">✕</button></div>` : ""}</div>`;
  el.querySelectorAll("[data-mv]").forEach((btn) => btn.onclick = () => move(b.id, btn.dataset.mv));
  return el;
}

function renderBox(b) {
  const el = renderInner(b);
  el.querySelector(".bh h2").onclick = () => { b.collapsed = !b.collapsed; saveLayout(); render(); };
  if (b.collapsed) { [...el.children].slice(1).forEach((c) => c.remove()); el.classList.add("collapsed"); }
  el.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-u]");
    if (a) { markRead([a.dataset.u]); (a.closest(".row") || a).classList.add("read"); }
  });
  return el;
}

// 未読のみ・すべて既読 の操作列
function readControls(b, items, chips) {
  const u = items.filter((i) => !read.has(i.url));
  const t = document.createElement("button");
  t.className = "chip" + (b.unreadOnly ? " on" : "");
  t.textContent = "未読のみ";
  t.onclick = () => { b.unreadOnly = !b.unreadOnly; saveLayout(); render(); };
  chips.prepend(t);
  if (u.length) {
    const r = document.createElement("button");
    r.className = "chip ghost"; r.textContent = "すべて既読";
    r.onclick = () => { markRead(u.map((i) => i.url)); render(); };
    chips.appendChild(r);
  }
}

function renderInner(b) {
  if (b.type === "owned") return ownedBox(b);
  if (b.type === "xlinks") return xBox(b);
  if (b.type === "calendar") return calendarBox(b);
  if (b.type === "watch") return watchBox(b);
  if (b.type === "events") return eventsBox(b);
  if (b.type === "funding") return fundingBox(b);
  if (b.type === "crowd") return crowdBox(b);
  if (b.type === "shop") return shopBox(b);
  return newsBox(b);
}

function newsBox(b) {
  const t = TYPES[b.type];
  const st = (ui[b.id] ||= { src: "すべて", n: 5 });
  const all = (news?.items || []).filter(t.filter);
  const unreadN = all.filter((i) => !read.has(i.url)).length;
  let items = b.unreadOnly ? all.filter((i) => !read.has(i.url)) : all;
  const names = [...new Set(all.map((i) => i.source))];
  const shown = st.src === "すべて" ? items : items.filter((i) => i.source === st.src);
  const el = boxShell(b, t.title, all.length, unreadN);
  const chips = document.createElement("div");
  chips.className = "chips";
  readControls(b, all, chips);
  el.appendChild(chips);
  if (names.length > 1) {
    for (const name of ["すべて", ...names]) {
      const c = document.createElement("button");
      c.className = "chip" + (st.src === name ? " on" : "");
      c.textContent = name === "すべて" ? `すべて ${items.length}` : `${name} ${items.filter((i) => i.source === name).length}`;
      c.onclick = () => { st.src = name; st.n = 5; render(); };
      chips.insertBefore(c, chips.querySelector(".ghost"));
    }
  }
  if (!news) el.insertAdjacentHTML("beforeend", `<div class="empty">まだデータがありません。自動取得が動くと、ここに新着が並びます。</div>`);
  else if (!shown.length) el.insertAdjacentHTML("beforeend", `<div class="empty">${b.unreadOnly ? "未読の記事はありません。" : "表示できる記事がありません。"}</div>`);
  for (const i of shown.slice(0, st.n)) {
    el.insertAdjacentHTML("beforeend", `<a class="row${read.has(i.url) ? " read" : ""}" data-u="${esc(i.url)}" href="${esc(i.url)}" target="_blank" rel="noopener">
      <div class="thumb" ${i.image ? `style="background-image:url('${esc(i.image)}')"` : ""}>${i.image ? "" : "📰"}</div>
      <div class="rt"><div class="t">${esc(i.title)}</div><div class="s">${esc(i.source)}${i.release ? `<span class="tag rel">${esc(i.release.label)}${esc(i.release.kind)}</span>` : ""}</div></div>
      <div class="rd">${md(i.date)}</div></a>`);
  }
  if (shown.length > st.n) {
    const m = document.createElement("button");
    m.className = "more"; m.textContent = `さらに表示（全 ${shown.length} 件）`;
    m.onclick = () => { st.n += 10; render(); };
    el.appendChild(m);
  }
  const ng = (news?.sources || []).filter((s) => !s.ok && s.channel !== "ショップ" && s.kind === (b.type === "news" ? "news" : "maker"));
  if (ng.length) el.insertAdjacentHTML("beforeend", `<div class="warn">取得できなかった情報源：${ng.map((s) => `${esc(s.name)}${s.channel ? "・" + esc(s.channel) : ""}（${esc(s.error)}）`).join("、")}</div>`);
  return el;
}

// BGGのメカニクスの日本語訳（ないものは英語のまま）
const MECH = {
  "Hand Management": "手札管理", "Set Collection": "セットコレクション", "Worker Placement": "ワーカープレイスメント", "Worker Placement with Dice Workers": "ダイスワーカー",
  "Deck, Bag, and Pool Building": "デッキ構築", "Dice Rolling": "ダイス", "Tile Placement": "タイル配置", "Area Majority / Influence": "エリアマジョリティ",
  "Open Drafting": "オープンドラフト", "Closed Drafting": "クローズドドラフト", "Action Drafting": "アクションドラフト", "Push Your Luck": "バースト",
  "Variable Player Powers": "固有能力", "Cooperative Game": "協力", "Solo / Solitaire Game": "ソロ", "Network and Route Building": "ルート構築",
  "Pattern Building": "パターン構築", "Grid Movement": "グリッド移動", "Point to Point Movement": "ポイント移動", "Area Movement": "エリア移動",
  "Simultaneous Action Selection": "同時行動選択", "Action Points": "アクションポイント", "Auction / Bidding": "競り", "Auction/Bidding": "競り",
  "Trick-taking": "トリックテイキング", "Race": "レース", "Betting and Bluffing": "ブラフ", "Contracts": "契約・目標達成", "End Game Bonuses": "終了時ボーナス",
  "Variable Set-up": "可変セットアップ", "Modular Board": "モジュラーボード", "Take That": "直接攻撃", "Player Elimination": "脱落あり", "Team-Based Game": "チーム戦",
  "Hidden Roles": "正体隠匿", "Deduction": "推理", "Memory": "記憶", "Real-Time": "リアルタイム", "Roll / Spin and Move": "すごろく", "Income": "収入",
  "Market": "市場", "Commodity Speculation": "相場", "Tech Trees / Tech Tracks": "テックツリー", "Track Movement": "トラック移動", "Rondel": "ロンデル",
  "Turn Order: Progressive": "手番順の移動", "Turn Order: Stat-Based": "手番順（状況順）", "Turn Order: Claim Action": "手番順の獲得", "Follow": "フォロー",
  "Hexagon Grid": "ヘクス", "Square Grid": "マス目", "Enclosure": "囲い込み", "Investment": "投資", "Stock Holding": "株", "Programmed Movement": "プログラム移動",
  "Action Queue": "アクションキュー", "Increase Value of Unchosen Resources": "残り物に福", "Pick-up and Deliver": "輸送", "Map Addition": "マップ拡張",
  "Stacking and Balancing": "積み上げ", "Flicking": "フリック", "Paper-and-Pencil": "紙ペン", "Line Drawing": "線引き", "Communication Limits": "会話制限",
  "Storytelling": "ストーリーテリング", "Scenario / Mission / Campaign Game": "シナリオ・キャンペーン", "Narrative Choice / Paragraph": "分岐選択",
  "Multi-Use Cards": "多用途カード", "Once-Per-Game Abilities": "1回限りの能力", "Re-rolling and Locking": "振り直し", "Die Icon Resolution": "ダイス目解決",
  "Catch the Leader": "トップ叩き", "Moving Multiple Units": "複数ユニット移動", "Events": "イベント", "Victory Points as a Resource": "勝利点を資源に使う",
  "Hidden Movement": "秘密移動", "Movement Points": "移動ポイント", "Card Play Conflict Resolution": "カード戦闘", "Chaining": "連鎖", "Layering": "重ね置き",
  "Melding and Splaying": "メルド", "Ladder Climbing": "ラダー（大富豪系）", "Bingo": "ビンゴ", "Matching": "マッチング", "Line of Sight": "視線",
  "Resource to Move": "資源で移動", "Mancala": "マンカラ", "Ownership": "所有", "Loans": "借金", "Turn Order: Random": "手番順ランダム", "Bribery": "賄賂",
  "Negotiation": "交渉", "Trading": "交易", "Voting": "投票", "Predictive Bid": "予想ビッド", "Command Cards": "命令カード", "Card Play Conflict": "カード戦闘",
  "Speed Matching": "早取り", "Pattern Recognition": "パターン認識", "Measurement Movement": "計測移動", "Dexterity": "アクション", "Lose a Turn": "一回休み",
  "Rock-Paper-Scissors": "じゃんけん", "Variable Phase Order": "フェイズ順可変", "Delayed Purchase": "予約購入", "Zone of Control": "ZOC",
  "Action Retrieval": "アクション回収", "Turn Order: Time Track": "タイムトラック", "Grid Coverage": "グリッド埋め", "Multiple Maps": "複数マップ",
  "Tags": "タグ", "Auction: Dutch": "競り（ダッチ）", "Ordering": "並べ替え", "Action / Event": "アクション/イベント", "Finale Ending": "最終ラウンド",
  "Semi-Cooperative Game": "半協力", "Hidden Victory Points": "非公開得点", "Pattern Movement": "パターン移動", "Algorithmic Resolution": "自動処理",
  "Deck Construction": "デッキ構築（事前）", "Advantage Token": "アドバンテージトークン", "Elapsed Real Time Ending": "時間制限", "Score-and-Reset Game": "ラウンド制得点",
  "Auction: Multiple Lot": "競り（まとめ）", "Auction: Sealed Bid": "競り（入札）", "Secret Unit Deployment": "秘密配置",
  "Slide/Push": "押し出し", "Bias": "バイアス", "King of the Hill": "キング・オブ・ザ・ヒル", "Highest-Lowest Scoring": "最低点勝負", "Kill Steal": "横取り",
};
// 所持ゲームの表示用ヘルパー
const bggId = (g) => String(g.bgg || "").match(/boardgame(?:expansion|accessory)?\/(\d+)/)?.[1];
const oinfo = (g) => ownedInfo[bggId(g)] || expInfo[bggId(g)] || null;
let nameMode = store.get("bgb.ownedname.v2", "both");   // both（英語名が主・日本語名を小さく）/ ja / en
const enName = (g) => g.nameEn || oinfo(g)?.en || "";
const ownedImg = (g) => hq(g.img || oinfo(g)?.thumb || art(g.name));
function playersText(g) {
  if (g.players) return g.players;
  const i = oinfo(g);
  if (!i?.minp) return "";
  return `${i.minp === i.maxp ? i.minp : `${i.minp}〜${i.maxp}`}人${i.best ? `（ベスト${i.best}）` : ""}${i.time ? `・${i.time}分` : ""}`;
}
function ownedTitle(g, parent) {
  let ja = g.name, en = enName(g);
  const same = norm(ja) === norm(en);   // 日本語名が未設定（英語名のまま）
  if (parent) {   // 拡張は本体名を省く
    const cut = (t, p) => (p && t.startsWith(p) ? t.slice(p.length).replace(/^[\s：:–—-]*(拡張[：:]?)?\s*/, "").trim() : t) || t;
    ja = cut(ja, parent.name); en = cut(en, enName(parent));
  }
  if (nameMode === "en" && en) return { main: en, sub: "" };
  if (nameMode === "both" && en) return { main: en, sub: !same && norm(en) !== norm(ja) ? ja : "" };
  return { main: ja, sub: "" };
}

// 所持ゲームのボックスと専用ページは owned.js

function xBox(b) {
  const makers = [...(sources?.makers || []), ...(sources?.places || [])].filter((m) => m.x);
  const el = boxShell(b, TYPES.xlinks.title, makers.length);
  if (!makers.length) el.insertAdjacentHTML("beforeend", `<div class="empty">config/sources.json に X のユーザー名を入れると、ここから開けます。</div>`);
  for (const m of makers) {
    el.insertAdjacentHTML("beforeend", `<a class="row" href="https://x.com/${esc(m.x)}" target="_blank" rel="noopener">
      <div class="thumb">𝕏</div><div class="rt"><div class="t">${esc(m.name)}</div><div class="s">@${esc(m.x)}${m.note ? " ・ " + esc(m.note) : ""}</div></div><div class="rd">開く ↗</div></a>`);
  }
  return el;
}

// ---- 発売カレンダー ----
const WD = "日月火水木金土";
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function dayBadge(r) {
  if (!r.date) return `<div class="db soon">近日</div>`;
  const [y, m, d] = r.date.split("-").map(Number);
  if (!r.exact && r.label) return `<div class="db"><b>${m}月</b><small>${esc(r.label.replace(/^.*月/, "")) || "予定"}</small></div>`;
  const wd = WD[new Date(y, m - 1, d).getDay()];
  return `<div class="db"><b>${m}/${d}</b><small>${wd}</small></div>`;
}
function daysLeft(r) {
  if (!r.date) return "";
  const diff = Math.round((new Date(r.date + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 864e5);
  if (diff === 0) return `<span class="today">今日</span>`;
  if (diff > 0) return `あと${diff}日`;
  return `${-diff}日前`;
}
function calendarBox(b) {
  const st = (ui[b.id] ||= { tab: "予定", n: 5 });
  const t = todayStr();
  const all = news?.releases || [];
  const visible = all.filter((r) => !hiddenRel.has(r.key));
  const upcoming = visible.filter((r) => !r.date || r.date >= t).sort((a, c) => (a.date || "9999").localeCompare(c.date || "9999"));
  const past = visible.filter((r) => r.date && r.date < t).sort((a, c) => c.date.localeCompare(a.date));
  const hidden = all.filter((r) => hiddenRel.has(r.key));
  const tabs = { 予定: upcoming, 気になる: upcoming.filter((r) => isWatched(r.game)), 発売済み: past, 非表示: hidden };
  const list = tabs[st.tab] || [];
  const el = boxShell(b, TYPES.calendar.title, upcoming.length);
  const chips = document.createElement("div");
  chips.className = "chips";
  for (const k of Object.keys(tabs)) {
    if (k === "非表示" && !hidden.length) continue;
    const c = document.createElement("button");
    c.className = "chip" + (st.tab === k ? " on" : "") + (k === "非表示" ? " ghost" : "");
    c.textContent = `${k === "予定" ? "発売予定" : k === "気になる" ? "⭐気になる" : k} ${tabs[k].length}`;
    c.onclick = () => { st.tab = k; st.n = 5; render(); };
    chips.appendChild(c);
  }
  el.appendChild(chips);
  const msg = { 予定: "記事やショップから発売日が見つかると、ここに並びます。", 気になる: "⭐を押したゲームや、気になるゲームに登録した名前に合うものがここに出ます。",
    発売済み: "まだ記録がありません。発売日を過ぎたものがここに残ります。", 非表示: "" };
  if (!list.length) el.insertAdjacentHTML("beforeend", `<div class="empty">${msg[st.tab]}</div>`);
  for (const r of list.slice(0, st.n)) {
    const l = r.links[0];
    const srcs = [...new Set(r.links.map((x) => x.source))].join("・");
    const typ = r.type === "販売開始" ? `<span class="tag">販売開始</span>` : r.type === "近日" ? `<span class="tag">予約前</span>` : r.type !== "発売" ? `<span class="tag">${esc(r.type)}</span>` : "";
    const starred = isWatched(r.game);
    const row = document.createElement("div");
    row.className = "row" + (starred ? " starred" : "");
    const rimg = art(r.game) || r.image || (news?.items || []).find((i) => i.image && norm(r.game).length > 2 && norm(i.title).includes(norm(r.game)))?.image;
    row.innerHTML = `${dayBadge(r)}${rimg ? `<div class="thumb" style="background-image:url('${esc(rimg)}')"></div>` : ""}
      <a class="rt" href="${esc(l.url)}" target="_blank" rel="noopener"><div class="t">${esc(r.game)}${typ}</div><div class="s">${daysLeft(r) ? daysLeft(r) + " ・ " : ""}${esc(srcs)}${r.price ? " ・ " + esc(r.price) : ""}</div></a>
      <div class="acts">${st.tab === "非表示"
        ? `<button data-a="show" title="表示に戻す">↩︎</button>`
        : `<button data-a="star" class="${starred ? "on" : ""}" title="気になる">${starred ? "★" : "☆"}</button><button data-a="hide" title="興味なし">✕</button>`}</div>`;
    row.querySelectorAll("[data-a]").forEach((btn) => btn.onclick = () => {
      const a = btn.dataset.a;
      if (a === "star") {
        if (starred) watch = watch.filter((w) => !(norm(r.game).includes(norm(w.q)) || norm(w.q).includes(norm(r.game))));
        else watch.unshift({ q: r.game, added: new Date().toISOString() });
        store.set(LS_WATCH, watch);
      } else if (a === "hide") { hiddenRel.add(r.key); saveHidden(); }
      else if (a === "show") { hiddenRel.delete(r.key); saveHidden(); }
      render();
    });
    el.appendChild(row);
  }
  if (list.length > st.n) {
    const m = document.createElement("button");
    m.className = "more"; m.textContent = `さらに表示（全 ${list.length} 件）`;
    m.onclick = () => { st.n += 10; render(); };
    el.appendChild(m);
  }
  return el;
}

// ---- ショップ入荷 ----
const STATUS = { soon: "予約前・近日", sale: "販売中", sold: "売切" };
let hiddenShop = new Set(store.get("bgb.hiddenshop.v1", []));
// 商品名からゲーム名だけを取り出す（気になるゲームに登録するとき用）
const gameName = (t) => t.replace(/【[^】]*】|\[[^\]]*\]|（[^）]*）|\([^)]*\)/g, "")
  .replace(/完全日本語版|日本語版|和訳ルール付き|和訳付き|新版/g, "").replace(/\s+/g, " ").trim() || t;
function shopBox(b) {
  const st = (ui[b.id] ||= { f: "新入荷", src: "すべて", n: 5 });
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const allShop = (news?.items || []).filter((i) => i.label === "ショップ");
  const visible = allShop.filter((i) => !hiddenShop.has(i.url));
  let items = b.unreadOnly ? visible.filter((i) => !read.has(i.url)) : visible;
  const isNew = (i) => (i.saleAt && i.saleAt >= week) || (i.firstSeen && i.firstSeen >= week);
  const filters = { "新入荷": isNew, "⭐気になる": (i) => isWatched(i.title) || isWatched(gameName(i.title)), "予約前・近日": (i) => i.status === "soon", "販売中": (i) => i.status === "sale", "売切": (i) => i.status === "sold", "すべて": () => true };
  const hidden = allShop.filter((i) => hiddenShop.has(i.url));
  const tabItems = (k) => k === "非表示" ? hidden : items.filter(filters[k]);
  const shown = tabItems(st.f).sort((a, c) => (c.date || "").localeCompare(a.date || ""));
  const el = boxShell(b, TYPES.shop.title, visible.length, visible.filter((i) => !read.has(i.url)).length);
  const chips = document.createElement("div");
  chips.className = "chips";
  for (const k of [...Object.keys(filters), ...(hidden.length ? ["非表示"] : [])]) {
    const c = document.createElement("button");
    c.className = "chip" + (st.f === k ? " on" : "") + (k === "非表示" ? " ghost" : "");
    c.textContent = `${k} ${tabItems(k).length}`;
    c.onclick = () => { st.f = k; st.n = 5; render(); };
    chips.appendChild(c);
  }
  readControls(b, visible, chips);
  el.appendChild(chips);
  const msg = { "新入荷": "この7日間の新入荷はありません。新しく並んだ商品や、販売が始まった商品がここに出ます。", "⭐気になる": "☆を押した商品や、気になるゲームに登録した名前に合う商品がここに出ます。" };
  if (!shown.length) el.insertAdjacentHTML("beforeend", `<div class="empty">${msg[st.f] || "該当する商品がありません。"}</div>`);
  for (const i of shown.slice(0, st.n)) {
    const when = i.saleAt ? `${md(i.saleAt)} ${i.restock ? "再入荷" : "販売開始"}` : i.firstSeen ? `${md(i.firstSeen)} 掲載` : "";
    const starred = isWatched(i.title) || isWatched(gameName(i.title));
    const row = document.createElement("div");
    row.className = "row" + (read.has(i.url) ? " read" : "") + (starred ? " starred" : "");
    row.innerHTML = `<div class="thumb" ${i.image ? `style="background-image:url('${esc(i.image)}')"` : ""}>${i.image ? "" : "🛒"}</div>
      <a class="rt" data-u="${esc(i.url)}" href="${esc(i.url)}" target="_blank" rel="noopener"><div class="t">${esc(i.title)}</div><div class="s wrap">${esc(i.source)}${i.price ? " ・ " + esc(i.price) : ""}<span class="tag st-${i.status}">${STATUS[i.status] || ""}</span>${i.restock ? `<span class="tag new">再入荷</span>` : ""}${when ? " ・ " + when : ""}</div></a>
      <div class="acts">${st.f === "非表示"
        ? `<button data-a="show" title="表示に戻す">↩︎</button>`
        : `<button data-a="star" class="${starred ? "on" : ""}" title="気になる">${starred ? "★" : "☆"}</button><button data-a="hide" title="興味なし">✕</button>`}</div>`;
    row.querySelectorAll("[data-a]").forEach((btn) => btn.onclick = () => {
      const a = btn.dataset.a, name = gameName(i.title);
      if (a === "star") {
        if (starred) watch = watch.filter((w) => ![i.title, name].some((t) => norm(t).includes(norm(w.q)) || norm(w.q).includes(norm(t))));
        else watch.unshift({ q: name, added: new Date().toISOString() });
        store.set(LS_WATCH, watch);
      } else if (a === "hide") hiddenShop.add(i.url);
      else if (a === "show") hiddenShop.delete(i.url);
      if (a !== "star") store.set("bgb.hiddenshop.v1", [...hiddenShop]);
      render();
    });
    el.appendChild(row);
  }
  if (shown.length > st.n) {
    const m = document.createElement("button");
    m.className = "more"; m.textContent = `さらに表示（全 ${shown.length} 件）`;
    m.onclick = () => { st.n += 10; render(); };
    el.appendChild(m);
  }
  const ng = (news?.sources || []).filter((s) => !s.ok && s.channel === "ショップ");
  if (ng.length) el.insertAdjacentHTML("beforeend", `<div class="warn">取得できなかったショップ：${ng.map((s) => esc(s.name)).join("、")}</div>`);
  return el;
}

// ---- 気になるゲーム ----
const norm = (s) => (s || "").normalize("NFKC").toLowerCase().replace(/[\s・:：\-－〜~!！?？「」『』【】()（）\[\]、。,.]/g, "");
function watchMatches(q) {
  const k = norm(q);
  if (!k) return { items: [], rels: [] };
  const items = (news?.items || []).filter((i) => norm(i.title).includes(k));
  const rels = (news?.releases || []).filter((r) => norm(r.game).includes(k) || r.links.some((l) => norm(l.title).includes(k)));
  return { items, rels };
}
function watchBox(b) {
  const st = (ui[b.id] ||= { open: null });
  const t = todayStr();
  const rows = watch.map((w, idx) => ({ w, idx, ...watchMatches(w.q) }));
  const newN = rows.filter((r) => r.items.some((i) => !read.has(i.url))).length;
  const el = boxShell(b, TYPES.watch.title, watch.length, newN);
  const form = document.createElement("form");
  form.className = "add";
  form.innerHTML = `<div class="r"><input name="q" placeholder="ゲーム名・キーワードを追加" required><button>追加</button></div>`;
  form.onsubmit = (e) => {
    e.preventDefault();
    const q = new FormData(form).get("q").trim();
    if (q && !watch.some((w) => w.q === q)) { watch.unshift({ q, added: new Date().toISOString() }); store.set(LS_WATCH, watch); }
    render();
  };
  el.appendChild(form);
  if (!watch.length) el.insertAdjacentHTML("beforeend", `<div class="empty">気になるゲームの名前を入れておくと、記事・ショップ・発売日から関係する情報を集めます。名前の一部（例：コーヒーラッシュ）でも大丈夫です。</div>`);
  // 新しい情報があるものを上に
  rows.sort((a, c) => (c.items.some((i) => !read.has(i.url)) - a.items.some((i) => !read.has(i.url))));
  for (const r of rows) {
    const next = r.rels.filter((x) => !x.date || x.date >= t).sort((a, c) => (a.date || "9999").localeCompare(c.date || "9999"))[0];
    const last = r.rels.filter((x) => x.date && x.date < t).sort((a, c) => c.date.localeCompare(a.date))[0];
    const shop = r.items.filter((i) => i.label === "ショップ");
    const arts = r.items.filter((i) => i.label === "記事");
    const fresh = r.items.filter((i) => !read.has(i.url)).length;
    const bits = [];
    if (next) bits.push(next.date ? `<span class="hl">${esc(next.label || md(next.date))}${next.type === "販売開始" ? "販売開始" : "発売"}・${daysLeft(next)}</span>` : `<span class="hl">近日発売</span>`);
    else if (last) bits.push(`${esc(last.label || md(last.date))} 発売済み`);
    for (const sh of shop.slice(0, 2)) bits.push(`${esc(sh.source)} <span class="tag st-${sh.status}">${STATUS[sh.status]}</span>${sh.price ? " " + esc(sh.price) : ""}`);
    if (arts.length) bits.push(`記事 ${arts.length}件`);
    if (!bits.length) bits.push("まだ情報なし");
    const row = document.createElement("div");
    row.className = "wrow";
    const wimg = art(r.w.q) || [...r.items, ...r.rels].map((x) => x.image).find(Boolean);
    row.innerHTML = `<div class="row"><div class="thumb" ${wimg ? `style="background-image:url('${esc(wimg)}')"` : ""}>${wimg ? "" : "⭐"}</div>
      <div class="rt"><div class="t">${esc(r.w.q)}${fresh ? `<span class="tag new">新着 ${fresh}</span>` : ""}</div><div class="s wrap">${bits.join(" ・ ")}</div></div>
      <button class="x" title="削除">✕</button></div>`;
    row.querySelector(".rt").onclick = () => { st.open = st.open === r.w.q ? null : r.w.q; render(); };
    row.querySelector(".x").onclick = () => { if (confirm(`「${r.w.q}」を気になるリストから外しますか？`)) { watch.splice(r.idx, 1); store.set(LS_WATCH, watch); render(); } };
    if (st.open === r.w.q) {
      const det = document.createElement("div");
      det.className = "wdet";
      const list = [...r.rels.map((x) => ({ url: x.links[0].url, t: `${x.date ? md(x.date) : "近日"} ${x.type}：${x.game}`, s: x.links.map((l) => l.source).join("・") })),
        ...r.items.map((i) => ({ url: i.url, t: i.title, s: `${i.source}・${i.label}${i.date ? "・" + md(i.date) : ""}` }))];
      det.innerHTML = list.length ? list.map((x) => `<a class="row${read.has(x.url) ? " read" : ""}" data-u="${esc(x.url)}" href="${esc(x.url)}" target="_blank" rel="noopener"><div class="rt"><div class="t">${esc(x.t)}</div><div class="s">${esc(x.s)}</div></div></a>`).join("")
        : `<div class="empty">今のところ、取得している情報源に該当がありません。情報が出たらここに集まります。</div>`;
      row.appendChild(det);
    }
    el.appendChild(row);
  }
  return el;
}

// ---- イベント ----
function evBadge(e) {
  const [, m, d] = e.date.split("-").map(Number);
  const wd = WD[new Date(e.date + "T00:00:00").getDay()];
  let sub = wd;
  if (e.end && e.end !== e.date) { const [, m2, d2] = e.end.split("-").map(Number); sub = `〜${m2 !== m ? m2 + "/" : ""}${d2}`; }
  return `<div class="db"><b>${m}/${d}</b><small>${sub}</small></div>`;
}
const KIND = { gm: "ゲムマ", news: "全国", local: "", manual: "" };
function eventsBox(b) {
  const st = (ui[b.id] ||= { tab: "地元", n: 5 });
  const t = todayStr();
  const home = events?.homePrefs || ["宮城県"];
  const mine = myEvents.map((e, idx) => ({ ...e, kind: "mine", idx, pref: e.pref || home[0] }));
  const up = [...(events?.events || []), ...mine].filter((e) => (e.end || e.date) >= t).sort((a, c) => a.date.localeCompare(c.date));
  const trips = (events?.trips || []).filter((x) => (x.to || x.from) >= t);
  const inTrip = (e) => trips.some((x) => e.pref === x.pref && (e.end || e.date) >= x.from && e.date <= (x.to || x.from));
  const tabs = {
    地元: up.filter((e) => home.includes(e.pref)),
    全国: up.filter((e) => e.kind === "gm" || e.kind === "news" || (e.kind === "manual" && !home.includes(e.pref))),
    旅行・出張: up.filter(inTrip),
  };
  const list = tabs[st.tab] || [];
  const el = boxShell(b, TYPES.events.title, up.length);
  const chips = document.createElement("div");
  chips.className = "chips";
  for (const k of Object.keys(tabs)) {
    const c = document.createElement("button");
    c.className = "chip" + (st.tab === k ? " on" : "");
    c.textContent = `${k === "地元" ? home.map((p) => p.replace(/[都府県]$/, "")).join("・") : k} ${tabs[k].length}`;
    c.onclick = () => { st.tab = k; st.n = 5; render(); };
    chips.appendChild(c);
  }
  el.appendChild(chips);
  if (st.adding) {
    const f = document.createElement("form");
    f.className = "add";
    f.innerHTML = `<div class="r"><input name="date" type="date" required value="${todayStr()}"><input name="time" placeholder="時間（任意）"></div>
      <input name="title" placeholder="イベント名" required><div class="r"><input name="place" placeholder="場所（任意）"><button>登録</button></div>`;
    f.onsubmit = (ev) => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      myEvents.push({ title: d.title.trim(), date: d.date, time: d.time.trim(), place: d.place.trim(), source: "自分で登録" });
      store.set("bgb.myevents.v1", myEvents); st.adding = false; render();
    };
    el.appendChild(f);
  }
  const addBtn = document.createElement("button");
  addBtn.className = "chip ghost"; addBtn.textContent = st.adding ? "閉じる" : "＋手で追加";
  addBtn.onclick = () => { st.adding = !st.adding; render(); };
  chips.appendChild(addBtn);
  if (st.tab === "旅行・出張" && trips.length) el.insertAdjacentHTML("beforeend", `<div class="trips">${trips.map((x) => `✈️ ${esc(x.name || "予定")}：${esc(x.from.slice(5).replace("-", "/"))}${x.to && x.to !== x.from ? "〜" + esc(x.to.slice(5).replace("-", "/")) : ""} ${esc(x.pref)}`).join("<br>")}</div>`);
  if (!list.length) el.insertAdjacentHTML("beforeend", `<div class="empty">${st.tab === "旅行・出張" ? "旅行や出張の予定（日付と行き先）を教えてもらえれば、その期間・その地域のイベントをここに集めます。" : "予定されているイベントは見つかっていません。"}</div>`);
  for (const e of list.slice(0, st.n)) {
    const k = e.tag || KIND[e.kind];
    if (e.kind === "mine") {
      const r = document.createElement("div");
      r.className = "row";
      r.innerHTML = `${evBadge(e)}<div class="rt"><div class="t">${esc(e.title)}<span class="tag">自分で登録</span></div>
        <div class="s">${esc([e.time, e.place].filter(Boolean).join(" ・ "))}</div></div><button class="x" title="削除">✕</button>`;
      r.querySelector(".x").onclick = () => { if (confirm(`「${e.title}」を削除しますか？`)) { myEvents.splice(e.idx, 1); store.set("bgb.myevents.v1", myEvents); render(); } };
      el.appendChild(r);
      continue;
    }
    el.insertAdjacentHTML("beforeend", `<a class="row" href="${esc(e.url || "#")}" target="_blank" rel="noopener">
      ${evBadge(e)}${e.image ? `<div class="thumb" style="background-image:url('${esc(e.image)}')"></div>` : ""}
      <div class="rt"><div class="t">${esc(e.title)}${k ? `<span class="tag">${k}</span>` : ""}</div>
      <div class="s">${esc([e.time, e.pref && !home.includes(e.pref) ? e.pref : "", (e.place || "").split(" / ")[0], e.note, e.price, e.source !== e.place ? e.source : ""].filter(Boolean).join(" ・ "))}</div></div>
      <div class="rd">${daysLeft({ date: e.date })}</div></a>`);
  }
  if (list.length > st.n) {
    const m = document.createElement("button");
    m.className = "more"; m.textContent = `さらに表示（全 ${list.length} 件）`;
    m.onclick = () => { st.n += 10; render(); };
    el.appendChild(m);
  }
  const ng = (events?.status || []).filter((x) => !x.ok);
  if (ng.length) el.insertAdjacentHTML("beforeend", `<div class="warn">取得できなかった情報源：${ng.map((x) => esc(x.name)).join("、")}</div>`);
  return el;
}

// ---- クラファン（Apps Script から取得）----
let funding = null, fundingErr = "";
async function loadFunding(refresh) {
  const url = store.get("bgb.cfurl.v1", "");
  if (!url) return;
  try {
    const r = await fetch(url + (refresh ? (url.includes("?") ? "&" : "?") + "refresh=1" : ""));
    funding = await r.json(); fundingErr = "";
  } catch (e) { fundingErr = "読み込めませんでした（URLや公開設定を確認してください）"; }
  render();
}
const CF_DONE = ["発送済み"];
const CF_RECV = ["到着", "受け取り済み"];
const CF_STAGES = ["支援中", "支払い済み", "製造中", "発送済み", "受け取り済み"];
let cfOver = store.get("bgb.cfover.v1", {});
let cfHidePromo = new Set(store.get("bgb.cfpromo.v1", []));
// 手動で変えた状態：手動の後に新しい状態メールが来たらメールを優先
function cfApply(p) {
  const o = cfOver[p.name];
  const q = { ...p };
  if (o?.stage && (!p.stageDate || o.date >= p.stageDate)) { q.stage = o.stage; q.manual = true; }
  if (q.needsAction && o?.doneAt && o.doneAt >= (p.actions[0]?.date || "")) q.needsAction = false;
  if (CF_DONE.includes(q.stage) || CF_RECV.includes(q.stage)) q.needsAction = false;
  return q;
}
function cfSet(name, patch) { cfOver[name] = { ...(cfOver[name] || {}), ...patch }; store.set("bgb.cfover.v1", cfOver); render(); }
function fundingBox(b) {
  const st = (ui[b.id] ||= { tab: "進行中", open: null, n: 6 });
  const url = store.get("bgb.cfurl.v1", "");
  const ps = (funding?.projects || []).map(cfApply);
  const tabs = {
    要対応: ps.filter((p) => p.needsAction),
    進行中: ps.filter((p) => !CF_DONE.includes(p.stage) && !CF_RECV.includes(p.stage)),
    発送済み: ps.filter((p) => CF_DONE.includes(p.stage)),
    受け取り済み: ps.filter((p) => CF_RECV.includes(p.stage)),
    おすすめ: (funding?.promos || []).filter((x) => !cfHidePromo.has(x.url)),
  };
  const el = boxShell(b, TYPES.funding.title, ps.length, tabs.要対応.length, "要対応");
  if (!url || st.setting) {
    const f = document.createElement("form");
    f.className = "add";
    f.innerHTML = `<div class="s" style="font-size:12px;color:var(--muted)">Apps Script をデプロイしたときに表示された「ウェブアプリのURL」を貼り付けてください。</div>
      <div class="r"><input name="u" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(url)}" required><button>保存</button></div>`;
    f.onsubmit = (e) => { e.preventDefault(); store.set("bgb.cfurl.v1", new FormData(f).get("u").trim()); st.setting = false; funding = null; render(); loadFunding(); };
    el.appendChild(f);
    if (!url) return el;
  }
  const chips = document.createElement("div");
  chips.className = "chips";
  for (const k of Object.keys(tabs)) {
    const c = document.createElement("button");
    c.className = "chip" + (st.tab === k ? " on" : "");
    c.textContent = `${k} ${tabs[k].length}`;
    c.onclick = () => { st.tab = k; st.n = 6; render(); };
    chips.appendChild(c);
  }
  const rf = document.createElement("button");
  rf.className = "chip ghost"; rf.textContent = "更新";
  rf.onclick = () => { rf.textContent = "更新中…"; loadFunding(true); };
  chips.appendChild(rf);
  const sb = document.createElement("button");
  sb.className = "chip ghost"; sb.textContent = "設定";
  sb.onclick = () => { st.setting = !st.setting; render(); };
  chips.appendChild(sb);
  el.appendChild(chips);
  if (fundingErr) el.insertAdjacentHTML("beforeend", `<div class="warn">${esc(fundingErr)}</div>`);
  else if (!funding) el.insertAdjacentHTML("beforeend", `<div class="empty">メールから集計中…（初回は10秒ほどかかります）</div>`);
  const list = tabs[st.tab] || [];
  if (funding && !list.length) el.insertAdjacentHTML("beforeend", `<div class="empty">${st.tab === "要対応" ? "対応が必要なものはありません。" : st.tab === "おすすめ" ? "支援したクリエイターの新作や、締切が近いプロジェクトのお知らせがここに集まります。" : "該当するプロジェクトはありません。"}</div>`);
  if (st.tab === "おすすめ") {
    for (const x of list.slice(0, st.n)) {
      const r = document.createElement("div");
      r.className = "row";
      r.innerHTML = `<div class="thumb" ${x.image ? `style="background-image:url('${esc(x.image)}')"` : ""}>${x.image ? "" : "✨"}</div>
        <a class="rt" href="${esc(x.url)}" target="_blank" rel="noopener"><div class="t">${esc(x.title)}<span class="tag ${x.kind === "締切間近" ? "new" : "rel"}">${esc(x.kind)}</span></div>
        <div class="s">${esc(x.from)} ・ ${md(x.date)}</div></a>
        <div class="acts"><button title="表示しない">✕</button></div>`;
      r.querySelector(".acts button").onclick = () => { cfHidePromo.add(x.url); store.set("bgb.cfpromo.v1", [...cfHidePromo]); render(); };
      el.appendChild(r);
    }
    if (list.length > st.n) {
      const m = document.createElement("button");
      m.className = "more"; m.textContent = `さらに表示（全 ${list.length} 件）`;
      m.onclick = () => { st.n += 10; render(); };
      el.appendChild(m);
    }
    return el;
  }
  for (const p of list.slice(0, st.n)) {
    const row = document.createElement("div");
    row.className = "wrow";
    const act = p.needsAction && p.actions[0];
    const upd = p.lastUpdate ? `更新#${p.lastUpdate.n}（${md(p.lastUpdate.date)}）${p.lastUpdate.title && !(p.needsAction && p.actions[0]?.text === p.lastUpdate.title) ? "：" + p.lastUpdate.title : ""}` : "";
    row.innerHTML = `<div class="row"><div class="thumb big" ${p.image ? `style="background-image:url('${esc(p.image)}')"` : ""}>${p.image ? "" : p.platform === "Kickstarter" ? "🟢" : p.platform === "Gamefound" ? "🟣" : "🔵"}</div>
      <div class="rt"><div class="t">${esc(p.name)}<span class="tag cf-${CF_DONE.includes(p.stage) || CF_RECV.includes(p.stage) ? "done" : "on"}">${esc(p.stage)}${p.manual ? "✎" : ""}</span>${act ? `<span class="tag new">要対応</span>` : ""}</div>
      <div class="s wrap">${esc([p.platform, upd].filter(Boolean).join(" ・ "))}${act ? `<br><span class="hl" style="color:var(--accent)">${esc(act.text)}（${md(act.date)}）</span>` : ""}</div></div>
      ${p.url ? `<a class="x" href="${esc(p.url)}" target="_blank" rel="noopener" title="ページを開く">↗</a>` : ""}</div>`;
    row.querySelector(".rt").onclick = () => { st.open = st.open === p.name ? null : p.name; render(); };
    if (st.open === p.name) {
      const det = document.createElement("div");
      det.className = "wdet";
      const now = new Date().toISOString();
      const ctrl = document.createElement("div");
      ctrl.className = "cfctrl";
      ctrl.innerHTML = `<div class="s">状態を変更：</div><div class="chips">${CF_STAGES.map((x) => `<button class="chip${p.stage === x ? " on" : ""}" data-st="${x}">${x}</button>`).join("")}
        ${p.manual ? `<button class="chip ghost" data-st="">メールの状態に戻す</button>` : ""}</div>
        ${p.needsAction ? `<button class="more" data-done="1">対応済みにする（要対応を外す）</button>` : ""}`;
      ctrl.querySelectorAll("[data-st]").forEach((x) => x.onclick = () => cfSet(p.name, { stage: x.dataset.st || null, date: now }));
      ctrl.querySelector("[data-done]")?.addEventListener("click", () => cfSet(p.name, { doneAt: now }));
      row.appendChild(ctrl);
      det.innerHTML = p.log.map((l) => `<a class="row" href="${esc(l.link)}" target="_blank" rel="noopener"><div class="rt"><div class="t">${esc(l.text)}</div><div class="s">${md(l.date)} ・ メールを開く</div></div></a>`).join("");
      row.appendChild(det);
    }
    el.appendChild(row);
  }
  if (list.length > st.n) {
    const m = document.createElement("button");
    m.className = "more"; m.textContent = `さらに表示（全 ${list.length} 件）`;
    m.onclick = () => { st.n += 10; render(); };
    el.appendChild(m);
  }
  return el;
}

// ---- 注目クラファン（ボドファン一覧＋登録したKickstarter）----
let crowdStar = new Set(store.get("bgb.crowdstar.v1", []));
const yen = (n, c = "¥") => n == null ? "" : c + Number(n).toLocaleString();
function leftText(end) {
  if (!end) return "";
  const ms = new Date(end) - Date.now();
  if (ms <= 0) return "終了";
  const d = Math.floor(ms / 864e5);
  return d >= 1 ? `残り${d}日` : `残り${Math.ceil(ms / 36e5)}時間`;
}
const KS_STATE = { live: "募集中", successful: "成功", failed: "不成立", canceled: "中止", suspended: "停止" };
function crowdBox(b) {
  const st = (ui[b.id] ||= { tab: "注目", n: 6 });
  const bodo = (crowd?.bodofun || []).filter((p) => !p.end || new Date(p.end) > Date.now() - 3 * 864e5)
    .sort((a, c) => (a.end || "9").localeCompare(c.end || "9"));
  const watched = [...(crowd?.watch || []), ...bodo.filter((p) => crowdStar.has(p.id))];
  const tabs = { 注目: watched, ボドファン: bodo };
  const el = boxShell(b, TYPES.crowd.title, watched.length);
  const chips = document.createElement("div");
  chips.className = "chips";
  for (const k of Object.keys(tabs)) {
    const c = document.createElement("button");
    c.className = "chip" + (st.tab === k ? " on" : "");
    c.textContent = `${k === "ボドファン" ? "ボドファン募集中" : k} ${tabs[k].length}`;
    c.onclick = () => { st.tab = k; st.n = 6; render(); };
    chips.appendChild(c);
  }
  el.appendChild(chips);
  const list = tabs[st.tab];
  if (!list.length) el.insertAdjacentHTML("beforeend", `<div class="empty">${st.tab === "注目" ? "ボドファンのプロジェクトは☆で注目に追加できます。KickstarterやGamefoundのプロジェクトは、URLを教えてもらえれば登録します。" : "取得できていません。"}</div>`);
  for (const p of list.slice(0, st.n)) {
    const img = p.image || art(p.title);
    const starred = crowdStar.has(p.id);
    const facts = [p.site, p.rate != null ? `${p.rate}%` : "", p.total != null ? yen(p.total, p.site === "Kickstarter" ? "$" : "¥") : "",
      p.backers != null ? `${p.backers}人` : "", p.state ? KS_STATE[p.state] || p.state : "", leftText(p.end), p.delivery ? `お届け ${p.delivery}` : ""].filter(Boolean);
    const r = document.createElement("div");
    r.className = "row" + (starred ? " starred" : "");
    r.innerHTML = `<div class="thumb big" ${img ? `style="background-image:url('${esc(img)}')"` : ""}>${img ? "" : "💡"}</div>
      <a class="rt" href="${esc(p.url)}" target="_blank" rel="noopener"><div class="t">${esc(p.title)}</div>
      <div class="s wrap">${esc(facts.join(" ・ "))}</div>
      ${p.rate != null ? `<div class="bar"><i style="width:${Math.min(100, p.rate)}%"></i></div>` : ""}</a>
      ${p.site === "ボドファン" ? `<div class="acts"><button class="${starred ? "on" : ""}" title="注目">${starred ? "★" : "☆"}</button></div>` : ""}`;
    r.querySelector(".acts button")?.addEventListener("click", () => {
      starred ? crowdStar.delete(p.id) : crowdStar.add(p.id);
      store.set("bgb.crowdstar.v1", [...crowdStar]); render();
    });
    el.appendChild(r);
  }
  if (list.length > st.n) {
    const m = document.createElement("button");
    m.className = "more"; m.textContent = `さらに表示（全 ${list.length} 件）`;
    m.onclick = () => { st.n += 10; render(); };
    el.appendChild(m);
  }
  return el;
}

function move(id, how) {
  const i = layout.findIndex((b) => b.id === id);
  const b = layout[i];
  if (how === "del") { if (confirm("このボックスを削除しますか？（中身のデータは消えません）")) layout.splice(i, 1); }
  else if (how === "side") { layout.splice(i, 1); b.col = b.col ? 0 : 1; layout.push(b); }
  else {
    const same = layout.map((x, k) => ({ x, k })).filter(({ x }) => x.col === b.col);
    const p = same.findIndex(({ x }) => x.id === id);
    const q = how === "up" ? p - 1 : p + 1;
    if (q < 0 || q >= same.length) return;
    [layout[same[p].k], layout[same[q].k]] = [layout[same[q].k], layout[same[p].k]];
  }
  saveLayout(); render();
}

document.getElementById("editBtn").onclick = (e) => {
  editing = !editing;
  e.target.classList.toggle("on", editing);
  e.target.textContent = editing ? "完了" : "並べ替え";
  document.getElementById("addBar").hidden = !editing;
  render();
};
document.querySelectorAll("[data-add]").forEach((btn) => btn.onclick = () => {
  const t = btn.dataset.add;
  if (t === "reset") { if (confirm("配置を初期状態に戻しますか？")) layout = structuredClone(DEFAULT_LAYOUT); }
  else layout.unshift({ id: "b" + Date.now(), type: t, col: 0 });
  saveLayout(); render();
});

window.addEventListener("hashchange", () => { window.scrollTo(0, 0); render(); });
loadData();
loadFunding();
