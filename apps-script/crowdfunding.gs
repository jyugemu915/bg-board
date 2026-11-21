/**
 * ボドゲ情報ボード：クラファン状況（Google Apps Script）
 * Gmail の Kickstarter / Gamefound / BackerKit のメールから、支援中のプロジェクトと状況をまとめて返します。
 * 「ウェブアプリ」としてデプロイし、表示された URL をボードの「クラファン」ボックスに貼り付けてください。
 */

const QUERY = 'from:(kickstarter.com OR gamefound.com OR backerkit.com) newer_than:3y -subject:("login code" OR "ログインコード")';
const PROMO_DAYS = 120;
// 締切・手続きが必要そうなアップデートの見出し
const ACTION_RE = /pledge manager|survey|address|last call|closes|closing|deadline|final reminder|アンケート|締切|締め切り|住所/i;
const MAX_THREADS = 400;
const CACHE_MIN = 20;

function doGet(e) {
  const cache = CacheService.getScriptCache();
  const force = e && e.parameter && e.parameter.refresh;
  let json = force ? null : cache.get('cf');
  if (!json) {
    json = JSON.stringify(build_());
    try { cache.put('cf', json, CACHE_MIN * 60); } catch (err) {}
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// エディタで「実行」して動作確認する用
function test() { Logger.log(JSON.stringify(build_(), null, 1).slice(0, 5000)); }

const STAGE_RANK = { '支援中': 1, '支払い待ち': 2, '要対応': 3, '支払い済み': 4, '製造中': 5, '発送準備': 6, '発送済み': 7, '到着': 8 };
const GF_STAGE = { 'shipped': '発送済み', 'delivered': '到着', 'in production': '製造中', 'ready to ship': '発送準備', 'awaiting shipping': '発送準備', 'paid': '支払い済み' };

function ksImage_(html) {
  const imgs = (html.match(/https:\/\/i\.kickstarter\.com\/assets\/[^"'\s)]+/g) || []).map((u) => u.replace(/&amp;/g, '&'));
  return imgs.find((u) => /draw0/.test(u)) || imgs[0] || '';
}
function gfImage_(html) {
  const m = html.match(/https:\/\/imgcdn\.gamefound\.com\/projectimagethumb\/[^"'\s)]+/);
  return m ? m[0] : '';
}
function firstLine_(body) { return (body.split('\n').map((x) => x.trim()).find((x) => x) || '').replace(/\s*\(\s*https?:[^)]*\)\s*/g, ' ').trim(); }

function build_() {
  const projects = {};
  const promos = [];
  const promoCut = new Date(Date.now() - PROMO_DAYS * 864e5).toISOString();
  const addPromo = (o) => { if (o.date >= promoCut) promos.push(o); };
  const P = (name, platform) => {
    const key = name.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
    if (!projects[key]) projects[key] = { name: name, platform: platform, creator: '', url: '', stage: '支援中', stageDate: null,
      lastUpdate: null, image: '', actions: [], log: [] };
    return projects[key];
  };
  const setStage = (p, stage, date) => {
    if (!p.stageDate || (STAGE_RANK[stage] || 0) >= (STAGE_RANK[p.stage] || 0) || date > p.stageDate) {
      if (!p.stageDate || date >= p.stageDate) { p.stage = stage; p.stageDate = date; }
    }
  };

  const threads = GmailApp.search(QUERY, 0, MAX_THREADS);
  threads.forEach((th) => {
    th.getMessages().forEach((m) => {
      const sub = m.getSubject() || '';
      const from = m.getFrom() || '';
      const date = m.getDate().toISOString();
      const link = 'https://mail.google.com/mail/u/0/#all/' + th.getId();
      let r;

      // ---- Kickstarter ----
      if (/kickstarter\.com/i.test(from)) {
        if ((r = sub.match(/^(.+?)\s*による別のプロジェクトをバックしましょう/)) || (r = sub.match(/^Back another project by\s+(.+)$/i))) {
          if (date < promoCut) return;
          const b = m.getPlainBody() || '';
          const u = (b.match(/https:\/\/www\.kickstarter\.com\/projects\/[\w-]+\/[\w-]+/) || [])[0] || link;
          addPromo({ date: date, kind: '新作', from: r[1], title: firstLine_(b).slice(0, 80) || (r[1] + 'の新しいプロジェクト'), url: u, image: ksImage_(m.getBody() || ''), link: link });
          return;
        }
        if ((r = sub.match(/(?:almost out of time to back|days? left to back|hours? left to back)\s+(.+)$/i))) {
          if (date < promoCut) return;
          const u = ((m.getPlainBody() || '').match(/https:\/\/www\.kickstarter\.com\/projects\/[\w-]+\/[\w-]+/) || [])[0] || link;
          addPromo({ date: date, kind: '締切間近', from: 'Kickstarter', title: r[1], url: u, image: ksImage_(m.getBody() || ''), link: link });
          return;
        }
        if ((r = sub.match(/^(?:プロジェクトアップデート|Project Update)\s*#(\d+)[：:]\s*(.+?)\s+by\s+(.+)$/i))) {
          const p = P(r[2], 'Kickstarter');
          p.creator = r[3];
          const b = m.getPlainBody() || '';
          const title = firstLine_(b);
          const own = (b.match(/https:\/\/www\.kickstarter\.com\/projects\/[\w-]+\/[\w-]+/) || [])[0] || '';
          if (!p.lastUpdate || date > p.lastUpdate.date) {
            p.lastUpdate = { n: +r[1], date: date, link: link, title: title };
            if (!p.url && own) p.url = own;
          }
          if (!p.image) p.image = ksImage_(m.getBody() || '');
          // アップデートの中で別プロジェクトを宣伝している
          const other = (b.match(/https:\/\/www\.kickstarter\.com\/projects\/[\w-]+\/[\w-]+/g) || []).find((u) => own && u !== own && !u.startsWith(own));
          if (other && /back|campaign|live|launch|ends|pre-?launch|follow|notify/i.test(b) && date >= promoCut) {
            addPromo({ date: date, kind: '支援先の新作', from: r[3], title: title || other.split('/').pop().replace(/-/g, ' '), url: other, image: '', link: link });
          } else if (ACTION_RE.test(title)) {
            p.actions.push({ date: date, text: title, link: link });
          }
          p.log.push({ date: date, text: 'アップデート#' + r[1] + (title ? '：' + title : ''), link: link });
        } else if (/survey|アンケート/i.test(sub)) {
          const name = sub.replace(/.*(?:for|：|:)\s*/i, '').trim();
          const p = P(name, 'Kickstarter');
          p.actions.push({ date: date, text: 'アンケート：' + sub, link: link });
          p.log.push({ date: date, text: sub, link: link });
        }
        return;
      }

      // ---- Gamefound ----
      if (/gamefound\.com/i.test(from)) {
        const body = () => m.getPlainBody() || '';
        const gfUrl = (b) => { const u = b.match(/https:\/\/gamefound\.com\/(?:[a-z]{2}\/)?projects\/[\w-]+\/[\w-]+/); return u ? u[0] : ''; };
        if ((r = sub.match(/^Update\s+(\d+)\s+in\s+(.+)$/i))) {
          const p = P(r[2], 'Gamefound');
          const b = body();
          const title = ((b.match(/UPDATE #\d+\s*\n+\s*([^\n]+)/i) || [])[1] || '').trim();
          if (!p.lastUpdate || date > p.lastUpdate.date) p.lastUpdate = { n: +r[1], date: date, link: link, title: title };
          if (!p.url) p.url = gfUrl(b);
          if (!p.image) p.image = gfImage_(m.getBody() || '');
          if (ACTION_RE.test(title)) p.actions.push({ date: date, text: title, link: link });
          p.log.push({ date: date, text: 'アップデート' + r[1] + (title ? '：' + title : ''), link: link });
        } else if ((r = sub.match(/^(.+?)\s+pledge confirmation$/i))) {
          const p = P(r[1], 'Gamefound'); setStage(p, '支払い待ち', date); if (!p.url) p.url = gfUrl(body());
          if (!p.image) p.image = gfImage_(m.getBody() || '');
          p.log.push({ date: date, text: '支援を確定', link: link });
        } else if ((r = sub.match(/^You paid for your pledge in\s+(.+)$/i))) {
          const p = P(r[1], 'Gamefound'); setStage(p, '支払い済み', date);
          p.log.push({ date: date, text: '支払い完了', link: link });
        } else if ((r = sub.match(/^(.+?)\s+pledge status changed$/i))) {
          const b = body();
          const p = P(r[1], 'Gamefound'); if (!p.url) p.url = gfUrl(b);
          const st = (b.match(/New stage:\s*([^.\n]+)/i) || [])[1] || '';
          const ja = GF_STAGE[st.trim().toLowerCase()] || st.trim();
          if (ja) setStage(p, ja, date);
          p.log.push({ date: date, text: 'ステータス：' + (ja || '変更'), link: link });
        } else if ((r = sub.match(/^Pledge manager for\s+(.+?)\s+is open\.?$/i))) {
          const p = P(r[1], 'Gamefound');
          p.actions.push({ date: date, text: 'プレッジマネージャー受付開始', link: link });
          p.log.push({ date: date, text: 'プレッジマネージャー受付開始', link: link });
        } else if ((r = sub.match(/^Complete your\s+(.+?)\s+pledge$/i))) {
          const p = P(r[1], 'Gamefound');
          p.actions.push({ date: date, text: '支援の手続きを完了してください', link: link });
          p.log.push({ date: date, text: '手続きの催促', link: link });
        } else if ((r = sub.match(/^Late pledge for\s+(.+?)\s+is open\.?$/i))) {
          P(r[1], 'Gamefound').log.push({ date: date, text: 'レイトプレッジ受付', link: link });
        }
        return;
      }

      // ---- BackerKit ----
      if (/backerkit\.com/i.test(from) && (r = sub.match(/^(?:Just Launched|Back It Now|Now Live|Launching Soon|Last Chance)[:：]\s*(.+)$/i))) {
        if (date < promoCut) return;
        const h = m.getBody() || '';
        const img = (h.match(/https:\/\/[^"'\s]*backerkit[^"'\s]*\.(?:jpe?g|png|webp)[^"'\s]*/i) || [])[0] || '';
        addPromo({ date: date, kind: /last chance/i.test(sub) ? '締切間近' : '新作', from: 'BackerKit', title: r[1], url: ((m.getPlainBody() || '').match(/https:\/\/[\w.]*backerkit\.com\/[^\s)]+/) || [])[0] || link, image: img.replace(/&amp;/g, '&'), link: link });
        return;
      }
      if (/backerkit\.com/i.test(from) && /survey|アンケート|pledge|confirm|ship/i.test(sub) && !/launch|live|back it/i.test(sub)) {
        const name = sub.replace(/^(?:Your|Complete your|Reminder:)\s*/i, '').replace(/\s*(survey|pledge).*$/i, '').trim() || sub;
        const p = P(name, 'BackerKit');
        if (/survey|アンケート|complete/i.test(sub)) p.actions.push({ date: date, text: sub, link: link });
        if (/ship/i.test(sub)) setStage(p, '発送済み', date);
        p.log.push({ date: date, text: sub, link: link });
      }
    });
  });

  // 仕上げ：対応が必要なもの＝最後の「要対応」メールより後に支払い・発送などの進展がないもの
  const list = Object.keys(projects).map((k) => {
    const p = projects[k];
    p.log.sort((a, b) => b.date.localeCompare(a.date));
    p.log = p.log.slice(0, 8);
    p.actions.sort((a, b) => b.date.localeCompare(a.date));
    const lastAct = p.actions[0];
    p.needsAction = !!(lastAct && (!p.stageDate || lastAct.date > p.stageDate) && (STAGE_RANK[p.stage] || 0) < 4);
    p.lastActivity = [p.lastUpdate && p.lastUpdate.date, p.stageDate, lastAct && lastAct.date].filter(Boolean).sort().pop() || null;
    return p;
  }).sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''));
  // おすすめ：同じリンクは新しいものだけ
  const seen = {};
  const promoList = promos.sort((a, b) => b.date.localeCompare(a.date)).filter((x) => (seen[x.url] ? false : (seen[x.url] = true)));
  return { updatedAt: new Date().toISOString(), count: list.length, projects: list, promos: promoList };
}
