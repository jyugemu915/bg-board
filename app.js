// ボドゲ情報ボード：ボックスの配置と中身の表示
const LS_LAYOUT = "bgb.layout.v1";
const LS_OWNED = "bgb.owned.v1";

const TYPES = {
  news:   { title: "新着", filter: null },
  maker:  { title: "メーカー新着", filter: "maker" },
  owned:  { title: "所持ゲーム" },
  xlinks: { title: "メーカーのX" },
};
const DEFAULT_LAYOUT = [
  { id: "b1", type: "maker", col: 0 },
  { id: "b2", type: "news", col: 0 },
  { id: "b3", type: "owned", col: 1 },
  { id: "b4", type: "xlinks", col: 1 },
];

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let layout = store.get(LS_LAYOUT, DEFAULT_LAYOUT);
let owned = store.get(LS_OWNED, []);
let editing = false;
let news = null, sources = null;
const ui = {}; // ボックスごとの表示状態（絞り込み・件数）

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const md = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };

async function loadData() {
  const [n, s] = await Promise.all([
    fetch("data/news.json?" + Date.now()).then((r) => r.json()).catch(() => null),
    fetch("config/sources.json?" + Date.now()).then((r) => r.json()).catch(() => null),
  ]);
  news = n; sources = s;
  const d = new Date();
  const upd = news?.updatedAt ? new Date(news.updatedAt) : null;
  document.getElementById("meta").textContent =
    `${d.getMonth() + 1}月${d.getDate()}日` + (upd ? ` ・ 最終更新 ${md(upd)} ${String(upd.getHours()).padStart(2, "0")}:${String(upd.getMinutes()).padStart(2, "0")}` : " ・ まだ自動取得されていません");
  render();
}

function saveLayout() { store.set(LS_LAYOUT, layout); }

function render() {
  const cols = document.querySelectorAll(".col");
  cols.forEach((c) => (c.innerHTML = ""));
  for (const b of layout) cols[b.col]?.appendChild(renderBox(b));
}

function boxShell(b, title, count) {
  const el = document.createElement("section");
  el.className = "box";
  el.innerHTML = `<div class="bh"><h2>${esc(title)}</h2>${count != null ? `<span class="count">${count}</span>` : ""}
    ${editing ? `<div class="tools">
      <button data-mv="up" title="上へ">↑</button><button data-mv="down" title="下へ">↓</button>
      <button data-mv="side" title="反対の列へ">⇄</button><button data-mv="del" title="削除">✕</button></div>` : ""}</div>`;
  el.querySelectorAll("[data-mv]").forEach((btn) => btn.onclick = () => move(b.id, btn.dataset.mv));
  return el;
}

function renderBox(b) {
  if (b.type === "owned") return ownedBox(b);
  if (b.type === "xlinks") return xBox(b);
  return newsBox(b);
}

function newsBox(b) {
  const t = TYPES[b.type];
  const st = (ui[b.id] ||= { src: "すべて", n: 8 });
  let items = (news?.items || []).filter((i) => !t.filter || i.kind === t.filter);
  const names = [...new Set(items.map((i) => i.source))];
  const shown = st.src === "すべて" ? items : items.filter((i) => i.source === st.src);
  const el = boxShell(b, t.title, items.length);
  if (names.length > 1) {
    const chips = document.createElement("div");
    chips.className = "chips";
    for (const name of ["すべて", ...names]) {
      const c = document.createElement("button");
      c.className = "chip" + (st.src === name ? " on" : "");
      c.textContent = name === "すべて" ? `すべて ${items.length}` : `${name} ${items.filter((i) => i.source === name).length}`;
      c.onclick = () => { st.src = name; st.n = 8; render(); };
      chips.appendChild(c);
    }
    el.appendChild(chips);
  }
  if (!news) el.insertAdjacentHTML("beforeend", `<div class="empty">まだデータがありません。自動取得が動くと、ここに新着が並びます。</div>`);
  else if (!shown.length) el.insertAdjacentHTML("beforeend", `<div class="empty">表示できる記事がありません。</div>`);
  for (const i of shown.slice(0, st.n)) {
    el.insertAdjacentHTML("beforeend", `<a class="row" href="${esc(i.url)}" target="_blank" rel="noopener">
      <div class="thumb" ${i.image ? `style="background-image:url('${esc(i.image)}')"` : ""}>${i.image ? "" : "📰"}</div>
      <div class="rt"><div class="t">${esc(i.title)}</div><div class="s">${esc(i.source)}${i.label === "ショップ" ? `<span class="tag">新入荷</span>` : ""}</div></div>
      <div class="rd">${md(i.date)}</div></a>`);
  }
  if (shown.length > st.n) {
    const m = document.createElement("button");
    m.className = "more"; m.textContent = `さらに表示（全 ${shown.length} 件）`;
    m.onclick = () => { st.n += 10; render(); };
    el.appendChild(m);
  }
  const ng = (news?.sources || []).filter((s) => !s.ok && (!t.filter || s.kind === t.filter));
  if (ng.length) el.insertAdjacentHTML("beforeend", `<div class="warn">取得できなかった情報源：${ng.map((s) => `${esc(s.name)}${s.channel ? "・" + esc(s.channel) : ""}（${esc(s.error)}）`).join("、")}</div>`);
  return el;
}

function ownedBox(b) {
  const st = (ui[b.id] ||= { q: "" });
  const el = boxShell(b, TYPES.owned.title, owned.length);
  const form = document.createElement("form");
  form.className = "add";
  form.innerHTML = `<div class="r"><input name="name" placeholder="ゲーム名を追加" required><button>追加</button></div>
    <input name="bgg" placeholder="BGGのURL（任意）" inputmode="url">`;
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(form);
    owned.unshift({ name: f.get("name").trim(), bgg: f.get("bgg").trim(), added: new Date().toISOString() });
    store.set(LS_OWNED, owned); render();
  };
  el.appendChild(form);
  if (owned.length > 5) {
    const q = document.createElement("form");
    q.className = "add";
    q.innerHTML = `<input placeholder="検索" value="${esc(st.q)}">`;
    q.querySelector("input").oninput = (e) => { st.q = e.target.value; drawList(); };
    q.onsubmit = (e) => e.preventDefault();
    el.appendChild(q);
  }
  const list = document.createElement("div");
  el.appendChild(list);
  function drawList() {
    const rows = owned.map((g, idx) => ({ g, idx })).filter(({ g }) => !st.q || g.name.toLowerCase().includes(st.q.toLowerCase()));
    list.innerHTML = rows.length ? "" : `<div class="empty">まだ登録がありません。上の欄から追加できます。</div>`;
    for (const { g, idx } of rows) {
      const r = document.createElement("div");
      r.className = "row";
      r.innerHTML = `<div class="thumb">🎲</div><div class="rt"><div class="t">${esc(g.name)}</div>
        <div class="s">${g.bgg ? `<a href="${esc(g.bgg)}" target="_blank" rel="noopener">BGGを開く ↗</a>` : "BGG未設定"}</div></div>
        <button class="x" title="削除">✕</button>`;
      r.querySelector(".x").onclick = () => { if (confirm(`「${g.name}」を削除しますか？`)) { owned.splice(idx, 1); store.set(LS_OWNED, owned); render(); } };
      list.appendChild(r);
    }
  }
  drawList();
  const foot = document.createElement("div");
  foot.className = "foot";
  foot.innerHTML = `<button type="button" data-a="exp">書き出し</button><label>読み込み<input type="file" accept=".json" hidden></label>`;
  foot.querySelector("[data-a=exp]").onclick = () => {
    const blob = new Blob([JSON.stringify(owned, null, 1)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "owned-games.json" });
    a.click();
  };
  foot.querySelector("input").onchange = async (e) => {
    try {
      const arr = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(arr)) throw 0;
      const have = new Set(owned.map((g) => g.name));
      owned = [...owned, ...arr.filter((g) => g?.name && !have.has(g.name))];
      store.set(LS_OWNED, owned); render();
    } catch { alert("読み込めないファイルです"); }
  };
  el.appendChild(foot);
  return el;
}

function xBox(b) {
  const makers = (sources?.makers || []).filter((m) => m.x);
  const el = boxShell(b, TYPES.xlinks.title, makers.length);
  if (!makers.length) el.insertAdjacentHTML("beforeend", `<div class="empty">config/sources.json に X のユーザー名を入れると、ここから開けます。</div>`);
  for (const m of makers) {
    el.insertAdjacentHTML("beforeend", `<a class="row" href="https://x.com/${esc(m.x)}" target="_blank" rel="noopener">
      <div class="thumb">𝕏</div><div class="rt"><div class="t">${esc(m.name)}</div><div class="s">@${esc(m.x)}</div></div><div class="rd">開く ↗</div></a>`);
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

loadData();
