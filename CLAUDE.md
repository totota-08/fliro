# Claude Code Skills

## Commands

- **build**: `npm run build`
- **lint**: `npm run lint`
- **test**: `npm run test:rules`
- **server**: `npm run dev`
- **format**: `npm run format`
- **typecheck**: `npm run typecheck`
- **design-check**: `node scripts/checkAiDesign.mjs --diff`（AIっぽいデザイン検出）

---

## AIっぽいデザインの自動レビュー

- UI を作る・変えるときは `human-design` スキルに従い、仕上げに `/design-review` スキルでレビューする。
- `scripts/checkAiDesign.mjs` が「AIっぽいデザイン」（紫系カラー・135degグラデ・装飾絵文字・ガラスモーフィズム・トークン無視の直書き等）を機械判定する。
  - 編集のたびに PostToolUse フック、ターン終了時に Stop フックが自動実行され、ERROR が残っているとやり直しになる（`.claude/settings.json`）。
  - 検査対象は「変更された行」のみ。既存コードの違反は触ったときに直す。
- 判定基準の一覧: `.claude/skills/design-review/references/ai-design-checklist.md`

---

## Git & PR Rules

- **Language**: All commit messages and Pull Request titles/bodies MUST be written in **Japanese**.
- **Commits**: Keep commits atomic and descriptive.
- **Pull Requests**: Use `gh pr create` (GitHub CLI) for creating PRs.
- **PR Checklist must include**:
  - Desktop / Mobile でレイアウト崩れがない（横スクロールが発生しない）
  - 主要導線（Dashboard / Task / Category / Invite / Settings）が壊れていない
  - `lint / typecheck / format / build` が通る
  - 影響範囲と手動検証項目が PR 本文に書かれている

---

## Coding Guidelines

- **Framework**: Vue 3 with Composition API (`<script setup lang="ts">`)
- **Language**: TypeScript
- **Styling**: Vanilla CSS or Scoped CSS. Use scoped styles.
- **State Management**: Use Vue's built-in reactivity (ref, reactive, computed).
- **Backend**: Firebase (Authentication, Firestore, Storage).
- **Logging**: Use `@logtape/logtape` instead of `console.log`.
- **Formatting**: Prettier is configured. Run `npm run format` before committing.
- **Linting**: ESLint is configured. Run `npm run lint` to check for issues.
- **Testing**: Firestore security rules testing is set up.

---

## Project Structure

- `src/`: Source code
  - `components/`: Vue components
  - `pages/`: Page components (routed)
  - `router/`: Vue Router configuration
  - `firebase/`: Firebase configuration and helpers
  - `services/`: Firestore CRUD / listen / validation / safety checks
  - `composables/`: UI state & derived logic（filters, maps, formatting）
  - `styles/`: Design tokens / shared styles（※なければ作る）
- `tests/`: Tests (currently for Firestore rules)

---

## App Design Philosophy（Flilo UI/UX 設計思想）

### 0) 絶対ゴール（UIが担う責務）

- チームの「今やるべきこと」を迷わせずに提示し、行動（作成・更新・議論）まで最短距離でつなぐ。
- “管理のための管理”ではなく、**意思決定と実行を加速するプロジェクト管理**に徹する。

---

## 1) UI一貫性を壊さないための「禁止事項」（最重要）

### ✅ デザイントークン以外禁止

- **色（hex / rgb）、角丸、影、余白、フォントサイズ** をページ内でハードコードしてはいけない。
- 追加が必要な場合は **まず tokens（CSS変数）へ追加**し、そこから参照する。

### ✅ “ページ直書きUI”禁止（統一感が壊れる原因）

- `pages/` でボタン/モーダル/アラート/フォーム/カードの独自実装を増やさない。
- UIパーツは **共通コンポーネント化**（`components/ui/` 推奨）して全ページで使い回す。

### ✅ レイアウト崩壊の原因を作らない

- 固定幅の多用（px固定で横幅を詰める）禁止。
- モバイルで横スクロールが出る実装は禁止（100vw + padding の罠に注意）。

---

## 2) 画面構造（IA）ルール：迷いを消す

### “Nowファースト”

- ダッシュボードは「現在の状況」「直近の期限」「滞留」を最優先。
- 詳細は必ず別画面（または右ドロワー）へ逃がす。

### 情報密度は段階的に

- 1st：要点（カード/要約/警告）
- 2nd：一覧（フィルタ・検索）
- 3rd：詳細（詳細ページ）

---

## 3) ナビゲーション設計：サイドバーは安定させる

- **左サイドバーは原則“固定”**（ページごとに頻繁に変えない）。
- 切り替えが必要な場合は粒度で固定：
  - **個人（マイページ）コンテキスト**
  - **プロジェクトコンテキスト**
- 同一粒度内で項目の並び・見た目・アクティブ表現を統一する。

---

## 4) Flilo Design System（Deep Green / Card UI）— 具体ルール

### トーン

- Deep Green 基調。カード/チップ/バッジで情報を整理。
- 派手な装飾（過剰なグラデ、過剰な影、過剰なアニメ）禁止。
  - グラデーションは **Hero など限定用途のみ**（薄く・控えめに）。

### 状態表現（統一）

- success / warning / danger / neutral の4系統で統一。
- 色だけで伝えない（ラベル/アイコン/文言を併用）。

### タイポグラフィ（統一）

- 見出し・本文・補助テキストの階層を固定し、ページごとに勝手に変えない。
- 行間と余白は「読みやすさ優先」。詰め込みすぎ禁止。

---

## 5) 共有UIコンポーネント方針（必須）

### 作るべき共通UI（例）

- `AppCard`（枠/影/余白統一）
- `AppButton`（primary/outline/ghost/destructive）
- `AppInput` / `AppSelect` / `AppTextarea`
- `AppBadge` / `AppChip`
- `AppAlert`（success/warn/danger/neutral）
- `AppModal` / `AppDrawer`
- `EmptyState`（空表示統一）
- `Skeleton`（読み込み統一）

### 実装ルール

- props で `variant` を持たせ、見た目を統一する（ページ側でCSSを増やさない）。
- 既存デザイン（Deep Green / Card UI）を壊さない。大改修はPR分割。

---

## 6) 実装アーキテクチャ（読みやすさ＝バグ減）

### 責務分離

- `pages/`：購読（listen）・画面構成・ルーティングだけ
- `components/`：UI表示とUIイベント
- `composables/`：状態・派生・UIロジック（filters, maps, formatting）
- `services/`：Firestore操作（CRUD / listen / validation / safety checks）

### パフォーマンスと可読性

- カテゴリ等は `Map` 化して O(1) 参照にする（`categoriesById`）。
- `watch` の重複や二重管理（例：`showMyTasksOnly` と `taskView`）は禁止。単一ソースに統一。

### 購読解除

- `onBeforeUnmount` で unsubscribe を必ず実施。

---

## 7) データ整合性・バリデーション（UI/Serviceで二重化）

- 入力は **service側で正規化**：`trim()`、長さ制限、空文字禁止。
- 削除は安全設計（MVPは block）：
  - 例：カテゴリ削除前に `tasks where categoryId == X limit(1)` で利用中チェック。
- エラーは握りつぶさない：
  - UI通知（Toast/Alert）＋ logtape で記録。

---

## 8) 権限（Owner/Admin/Member/Guest）— UIとRulesで二重防御

- UI：見せない/押せない（ルートガード・ボタン非表示）
- Firestore Rules：実際に拒否（最終防衛線）
- 「Ownerなのに制限される」等の矛盾は、ルール・ガード・UIを同時に点検し統一する。

---

## 9) 動き（アニメーション）— 邪魔しない

- 目的がある動きだけ（150〜220ms程度）
- ドロワー：右から出る + オーバーレイで閉じる
- `prefers-reduced-motion` を尊重する

---

## 10) アクセシビリティ（最低ライン）

- クリック要素は `button` を優先、`aria-label` を付与。
- フォーカスリングを消さない。
- 色だけで状態を伝えない（ラベル/アイコン/文言も併用）。

---

## 11) UI変更の進め方（崩壊防止の運用）

- 変更は必ず PR 分割（例：tokens整備 → 共通UI導入 → ページ適用）。
- 1PRで「デザイン刷新 + ロジック刷新 + データ仕様変更」を同時にやらない。
- 各PRで必ず「Before/After」「手動確認項目」「スクショ（可能なら）」を残す。
