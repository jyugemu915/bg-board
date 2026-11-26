# ボドゲ情報ボード（bg-board）引き継ぎメモ

最終更新：2026-11-26 昼（所持ゲーム73件登録・次の大きな作業を整理）

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
  - `scripts/owned-info.mjs` → `data/owned-info.json`（所持ゲームの英語名・人数・ベスト/推奨人数・時間・発売年・重さ・評価・メカニクス・デザイナー・版ごとの箱絵・拡張一覧。config/owned.json の BGG ID が対象。拡張一覧に出る拡張は簡易情報を exps に）
  - `scripts/bgg.mjs` → `data/bgg.json`（BGG箱絵。Secrets の `BGG_TOKEN` が必要）
- クラファン状況：Google Apps Script（`apps-script/crowdfunding.gs`）が Gmail の Kickstarter / Gamefound / BackerKit メールを集計し、ウェブアプリのURLから JSON を返す。URLはボードの「クラファン」ボックスの設定に保存（スマホ内）
- スマホ内だけに保存されるもの（localStorage）：配置、既読、所持ゲーム、気になるゲーム、★、非表示、手入力イベント、クラファンの手動状態、ショップの非表示

## 設定ファイル（追加・変更はチャットで依頼する運用）
- `config/sources.json`：メーカー（makers）、ニュース（news）、場所（places：Xリンク）
  - 書き方：`rss`=記事配信URL、`site`=公式サイト（RSS自動検出）、`shop`=BASEのショップ、`shopify`=Shopifyストア、`x`=Xのユーザー名
- `config/events.json`：`homePrefs`（4=宮城）、`trips`（旅行・出張：その期間は現地のボドゲーマも取得）、`manual`（ひよこの杜の月間予定など）
- `config/crowd-watch.json`：注目する Kickstarter のURL、Gamefoundなど手動登録分
- `config/bgg-names.json`：`names`（箱絵を探すゲーム名）、`aliases`（日本語名→英語名 or BGG ID。同名の別ゲームがあるときはIDで指定）
- `config/owned.json`：写真などから読み取った所持ゲーム。ボードを開いたときに所持ゲームへ一度だけ取り込まれる（ボード側で削除したものは戻らない）。`parent`=拡張の本体名、`includes`=同梱メモ（取り込み済みでも parent / includes / bgg は更新される）。箱絵の検索対象にもなる

## 現在の情報源
- メーカー：ホヌゲームズ（BASEショップ / X @Honu_Games）、うちばこや（note / X @uchibacoya）、ブルーフィンチゲームズ（note＋BASEショップ / X @bluefinchgames）
- ニュース：Table Games in the World（RSS）、BGG Store（Shopify商品＋ブログ）
- イベント：ゲームマーケット公式、ボドゲーマ（宮城）、ニュース記事の「◯月◯日開催」、ひよこの杜（手動登録・12月分まで）
- クラファン：Gmail（Apps Script）、ボドファン（募集中一覧）、Kickstarter stats.json

## ボックス一覧
発売カレンダー（予定／⭐気になる／発売済み／非表示、☆✕ボタン）、イベント（宮城／全国／旅行・出張、手入力可）、メーカー記事、ニュース、気になるゲーム、クラファン（要対応／進行中／発送済み／受け取り済み／おすすめ、状態の手動変更可）、注目クラファン（注目／ボドファン募集中）、ショップ入荷（新入荷・⭐気になる・販売状態・非表示、☆✕ボタン。☆で気になるゲームに登録）、所持ゲーム（1件ずつ／まとめて貼り付け追加、写真からの登録分を自動取り込み。拡張は本体の下にまとめて表示、本体の箱に同梱している拡張はメモのタグで表示。表記は 両方（英語名が主・日本語名を小さく。既定）／日本語／English。行をタップで詳細（人数・推奨人数・時間・発売年・重さ・評価・デザイナー・メカニクス（日本語訳）・拡張一覧から＋所持で追加）。人数・時間を表示。✎で名前・英語名・本体・人数・BGG・箱絵（版ごとの候補 or 画像URL）を編集）、Xアカウント
- 共通：タイトルタップで折りたたみ、「未読のみ」「すべて既読」、「並べ替え」で上下・列移動・追加・削除

## わかっている制約
- X・LINE・Discord（非アナウンス）は自動取得できない → ひよこの杜は月の予定画像をチャットに送って手動登録
- TGiW の記事ページ、Kickstarter / Gamefound のページ本体は GitHub Actions から 403（Cloudflare）
  - Kickstarter は stats.json（支援者数・支援額・状態）のみ取得可。締切・達成率は不可
- BGG XML API は 2025年秋から認証トークン必須

## 残りの作業・待ち
1. **Apps Script の差し替え**（ユーザー作業・PC）：最新の `apps-script/crowdfunding.gs` を貼り替え →「デプロイを管理」→ 編集 → 新バージョン（URLは変わらない）。箱絵・おすすめタブ・締切アップデートの要対応化が有効になる
2. **通知**（未決定）：BGG Store再入荷や気になるゲームの販売開始を、メール（Apps Script）か GitHubアプリのプッシュ通知で知らせるか
3. **所持ゲームの写真登録**（2026-11-26時点で config に73件。全体で200件近く。写真は棚4枚分まで登録済み）：棚の写真をもらったらゲーム名を読み取り `config/owned.json` の games に追加（from に「写真 日付」）。英語名がわかるものは `bgg-names.json` の aliases にも足す
4. **BGG箱絵**：2026-11-25 に未ヒット38件のうち32件をIDで対応。BGGに見つからなかったもの：メモリーチ、ペントリーニ、チェスレース、フリップタウン、ローリー、ブラッドハント。P.I はSecond Edition（2026）のIDにしたので、箱絵が違えば 129050（2012年版）へ
5. **ひよこの杜**：1月の予定が出たら画像を送ってもらい登録（マーダーミステリーは除外）
6. 注目する Kickstarter / Gamefound のURLがあれば `config/crowd-watch.json` に登録
7. 旅行・出張の予定が決まったら `config/events.json` の trips に登録

## 確認・運用メモ
- 所持ゲーム：クルセイダーズの木箱・ラッツ・オブ・ウィスターの白いケースはインサートなので登録しない。黒い布袋はエターナルデックス
- 所持ゲームが200件近くになるため、次の大きな作業（新しいチャットで）：
  1. 所持リストを別タブ（専用ページ）へ移す
  2. BGGのカテゴリー・出版社・アーティスト・説明文を追加（owned-info.mjs の SCHEMA を上げて取り直し）
  3. 検索機能（名前・メカニクス・カテゴリー・人数など）
  4. 箱絵だけのグリッド表示（箱絵の下部に人数・時間だけを重ねる）
  5. 拡張の二重表示の修正：拡張一覧から「＋所持」で追加すると、本体の下と別の場所に二重に出ると報告あり（要再現・修正）
- 所持ゲームのレキシオ（BGG 19184）は棚の「New Lexio」と同じもの
- BGG ID 未確定（箱絵なし）：クランプス ホリデーハボック、ペイバック（BGGに2025年の同名が2件）、16タビーキャッツ、セイル（allplay）、ログ（ifromgames）、プロジェクトL、ひらがじゃん、バグハント
- 推理部（ひよこの杜・毎週水曜）はマーダーミステリー系なら外す（ユーザー確認待ち）
- ひよこの杜の年末年始休業は、カレンダー画像に合わせて 12/30〜1/1 で登録（LINE文面は12/28〜と記載があり食い違い）
- マーダーミステリーはイベントに入れない

## 開発メモ（次のClaude向け）
- リポジトリは add_repo（access: push）で接続 → clone → 変更 → main に直接 push（個人用リポジトリ）。コミットは user.name=jyugemu915 で作成し、末尾にセッションの帰属行を付ける
- index.html の `style.css?v=…` `app.js?v=…` は変更のたびに上げる（ホーム画面アプリのキャッシュ対策）
- 自動取得の実行中に push すると bot の保存が衝突するが、保存ステップは pull --rebase して再試行する。push 前に `git pull --rebase origin main`
- gh は GraphQL 不可。REST を使う（例：`gh api -X POST repos/jyugemu915/bg-board/actions/workflows/update.yml/dispatches -f ref=main` で自動取得を手動実行、`gh run view <id> --log` でログ確認）
- 作業環境からは外部サイトに直接アクセスできない。BGGの検索候補などは一時的な probe 用ワークフロー（BGG_TOKEN 使用）で調べ、終わったら削除
- 所持ゲームの写真登録：BGG ID を probe で確認 → `config/owned.json` に name / bgg（URL）/ parent / includes / from を追記 → `bgg-names.json` の aliases に ID も追加
- 所持ゲームのデータは localStorage（bgb.owned.v1）。key=登録時の名前で、画面で名前を変えても config からの再取り込みで重複しない
- BGG の新規検索は1回30件まで（bgg.mjs）、所持ゲーム詳細は40件まで（owned-info.mjs）。あふれた分は次の実行で取得
- 画面の確認はローカルで `python3 -m http.server` ＋ Playwright（/usr/bin/google-chrome）でスクリーンショット
