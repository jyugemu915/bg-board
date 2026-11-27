// 一時的な調査用（終わったら削除）
const TOKEN = process.env.BGG_TOKEN;
const r = await fetch("https://boardgamegeek.com/xmlapi2/thing?id=240822,295981,102181", { headers: { Authorization: `Bearer ${TOKEN}` } });
const x = await r.text();
for (const it of x.split("<item ").slice(1)) {
  const id = it.match(/id="(\d+)"/)[1];
  const nm = it.match(/<name type="primary"[^>]*value="([^"]*)"/)?.[1];
  const pubs = [...it.matchAll(/type="boardgame(publisher|designer)" id="\d+" value="([^"]*)"/g)].map(m => m[1][0] + ":" + m[2]);
  console.log("## " + id + " " + nm + " | " + pubs.join(", "));
}
