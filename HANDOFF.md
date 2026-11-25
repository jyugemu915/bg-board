# ボドゲ情報ボード（bg-board）引き継ぎメモ

最終更新：2026-11-25

## 概要
- ボードゲームの新着・発売日・イベント・クラファン・所持ゲームなどを1ページにまとめる、自分専用のWebアプリ
- 公開URL：https://jyugemu915.github.io/bg-board/ （スマホ中心。ホーム画面に追加して使う）
- リポジトリ：https://github.com/jyugemu915/bg-board （Public / GitHub Pages：main ブランチの root）
- 参考にした見た目：BG-Watch（ベージュ系・カード型のダッシュボード）

## しくみ
- 画面：`index.html` / `style.css` / `app.js`（ビルド不要の素のJS）
- 自動取得：GitHub Actions（`.github/workflows/update.yml`）が日本時間 6:17 / 12:17 / 18:17 頃と、`config/` `scripts/` 変更時に実行
  - `scripts/fetch.mjs` → `data/news.json`（記事・ショップ・発売カレンダー・状態履歴）
  - `scripts/events.mjs` → `data/events.json`（イベント）
  - `scripts/crowd.mjs` → `data/crowd.json`（ボドファン一覧・注目Kickstarter）
  - `scripts/bgg.mjs` → `data/bgg.json`（BGG箱絵。Secrets の `BGG_TOKEN` が必要）
- クラファン状況：Google Apps Script（`apps-script/crowdfunding.gs`）が Gmail の Kickstarter / Gamefound / BackerKit メールを集計し、ウェブアプリのURLから JSON を返す。URLはボードの「クラファン」ボックスの設定に保存（スマホ内）
- スマホ内だけに保存されるもの（localStorage）：配置、既読、所持ゲーム、気になるゲーム、★、非表示、手入力イベント、クラファンの手動状態

## 設定ファイル（追加・変更はチャットで依頼する運用）
- `config/sources.json`：メーカー（makers）、ニュース（news）、場所（places：Xリンク）
  - 書き方：`rss`=記事配信URL、`site`=公式サイト（RSS自動検出）、`shop`=BASEのショップ、`shopify`=Shopifyストア、`x`=Xのユーザー名
- `config/events.json`：`homePrefs`（4=宮城）、`trips`（旅行・出張：その期間は現地のボドゲーマも取得）、`manual`（ひよこの杜の月間予定など）
- `config/crowd-watch.json`：注目する Kickstarter のURL、Gamefoundなど手動登録分
- `config/bgg-names.json`：BGGで箱絵を探すゲーム名（所持・気になるゲーム）

## 現在の情報源
- メーカー：ホヌゲームズ（BASEショップ / X @Honu_Games）、うちばこや（note / X @uchibacoya）、ブルーフィンチゲームズ（note＋BASEショップ / X @bluefinchgames）
- ニュース：Table Games in the World（RSS）、BGG Store（Shopify商品＋ブログ）
- イベント：ゲームマーケット公式、ボドゲーマ（宮城）、ニュース記事の「◯月◯日開催」、ひよこの杜（手動登録・12月分まで）
- クラファン：Gmail（Apps Script）、ボドファン（募集中一覧）、Kickstarter stats.json

## ボックス一覧
発売カレンダー（予定／⭐気になる／発売済み／非表示、☆✕ボタン）、イベント（宮城／全国／旅行・出張、手入力可）、メーカー記事、ニュース、気になるゲーム、クラファン（要対応／進行中／発送済み／受け取り済み／おすすめ、状態の手動変更可）、注目クラファン（注目／ボドファン募集中）、ショップ入荷（新入荷・再入荷）、所持ゲーム、Xアカウント
- 共通：タイトルタップで折りたたみ、「未読のみ」「すべて既読」、「並べ替え」で上下・列移動・追加・削除

## わかっている制約
- X・LINE・Discord（非アナウンス）は自動取得できない → ひよこの杜は月の予定画像をチャットに送って手動登録
- TGiW の記事ページ、Kickstarter / Gamefound のページ本体は GitHub Actions から 403（Cloudflare）
  - Kickstarter は stats.json（支援者数・支援額・状態）のみ取得可。締切・達成率は不可
- BGG XML API は 2025年秋から認証トークン必須

## 残りの作業・待ち
1. **BGG箱絵**：トークン登録済み・取得動作確認済み（2026-11-25）。日本語名だけのゲームは BGG で見つからないため、`config/bgg-names.json` の `aliases`（日本語名→英語名 or BGG ID）を増やしていく
2. **Apps Script の差し替え**：箱絵・おすすめタブ・締切アップデートの要対応化に対応した最新版を、Apps Script に貼り替え →「デプロイを管理」→ 編集 → 新バージョン（URLは変わらない）
3. **通知**（未決定）：BGG Store再入荷や気になるゲームの販売開始を、メール（Apps Script）か GitHubアプリのプッシュ通知で知らせるか
4. **ひよこの杜**：1月の予定が出たら画像を送って登録
5. 注目する Kickstarter / Gamefound のURLがあれば `config/crowd-watch.json` に登録
6. 所持ゲームの写真からの一括登録（未着手）
7. 旅行・出張の予定が決まったら `config/events.json` の trips に登録
8. ショップ入荷にも☆✕ボタンを付けるか（提案済み・未回答）

## 確認・運用メモ
- 推理部（ひよこの杜・毎週水曜）はマーダーミステリー系なら外す（ユーザー確認待ち）
- ひよこの杜の年末年始休業は、カレンダー画像に合わせて 12/30〜1/1 で登録（LINE文面は12/28〜と記載があり食い違い）
- マーダーミステリーはイベントに入れない
