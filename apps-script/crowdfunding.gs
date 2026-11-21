/**
 * ボドゲ情報ボード：クラファン状況（Google Apps Script）
 * Gmail の Kickstarter / Gamefound / BackerKit のメールから、支援中のプロジェクトと状況をまとめて返します。
 * 「ウェブアプリ」としてデプロイし、表示された URL をボードの「クラファン」ボックスに貼り付けてください。
 */

const QUERY = 'from:(kickstarter.com OR gamefound.com OR backerkit.com) newer_than:3y ' +
  '-subject:("別のプロジェクトをバック" OR "almost out of time" OR "days left" OR "Just Launched" OR "Back It Now" OR "Now Live" OR "login code" OR "ログインコード")';
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

function build_() {
  const projects = {};
  const P = (name, platform) => {
    const key = name.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
    if (!projects[key]) projects[key] = { name: name, platform: platform, creator: '', url: '', stage: '支援中', stageDate: null,
      lastUpdate: null, actions: [], log: [] };
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
        if ((r = sub.match(/^(?:プロジェクトアップデート|Project Update)\s*#(\d+)[：:]\s*(.+?)\s+by\s+(.+)$/i))) {
          const p = P(r[2], 'Kickstarter');
          p.creator = r[3];
          if (!p.lastUpdate || date > p.lastUpdate.date) {
            p.lastUpdate = { n: +r[1], date: date, link: link };
            if (!p.url) { const u = (m.getPlainBody() || '').match(/https:\/\/www\.kickstarter\.com\/projects\/[\w-]+\/[\w-]+/); if (u) p.url = u[0]; }
          }
          p.log.push({ date: date, text: 'アップデート#' + r[1], link: link });
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
          if (!p.lastUpdate || date > p.lastUpdate.date) p.lastUpdate = { n: +r[1], date: date, link: link };
          if (!p.url) p.url = gfUrl(body());
          p.log.push({ date: date, text: 'アップデート' + r[1], link: link });
        } else if ((r = sub.match(/^(.+?)\s+pledge confirmation$/i))) {
          const p = P(r[1], 'Gamefound'); setStage(p, '支払い待ち', date); if (!p.url) p.url = gfUrl(body());
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
  return { updatedAt: new Date().toISOString(), count: list.length, projects: list };
}
