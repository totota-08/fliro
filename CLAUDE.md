# Claude Code Skills

## Commands

- **build**: `npm run build`
- **lint**: `npm run lint`
- **test**: `npm run test:rules`
- **server**: `npm run dev`
- **format**: `npm run format`
- **typecheck**: `npm run typecheck`

## Git & PR Rules

- **Language**: All commit messages and Pull Request titles/bodies MUST be written in **Japanese**.
- **Commits**: Keep commits atomic and descriptive.
- **Pull Requests**: Use `gh pr create` (GitHub CLI) for creating PRs.

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

## Project Structure

- `src/`: Source code
  - `components/`: Vue components
  - `pages/`: Page components (routed)
  - `router/`: Vue Router configuration
  - `firebase/`: Firebase configuration and helpers
- `tests/`: Tests (currently for Firestore rules)

## App Design Philosophy（このアプリの設計思想）

### 0) 目的（このアプリが解く課題）

- チームの「今やるべきこと」を迷わせずに提示し、行動（作成・更新・議論）まで最短距離でつなぐ。
- “管理のための管理”ではなく、**意思決定と実行を加速するプロジェクト管理**に徹する。

---

### 1) UXの最重要原則（迷いを消す）

- **“Nowファースト”**：ダッシュボードは「現在の状況」「直近の期限」「滞留」を最優先で見せる。詳細は必ず別画面（またはドロワー）へ逃がす。
- **情報密度は段階的に**：
  - 1st：要点（カード/要約/警告）
  - 2nd：一覧（フィルタ・検索）
  - 3rd：詳細（タスク詳細ページ）
- **同じ操作は同じ見た目・同じ場所**：作成/編集/削除/保存/キャンセルのUI配置・文言・挙動を全ページで統一する。

---

### 2) 画面構造（IA）ルール

- **左サイドバーは原則“固定”**：ページごとに表示が変わるのは最小限にする（ユーザーの場所認知が壊れるため）。
  - 変える必要がある場合は「プロジェクト単位のメニュー」「個人（マイページ）単位のメニュー」など**粒度で切り替え**、同一粒度内では固定。
- **右側は“コンテキスト表示”**：
  - タスクをクリック → 右ドロワーで概要（即時確認/次のアクション）
  - 編集や議論は詳細ページへ（情報の詰め込みを防ぐ）
- **カテゴリ管理は“必ず専用導線”**：タスク作成/編集から迷わず到達できる場所に置く（例：タスク一覧のフィルタバーに「カテゴリ管理」）。

---

### 3) デザイン一貫性（Deep Green / Card UI）

- **アプリ全体のトーン**：Deep Green を基調に、カード/チップ/バッジで情報を整理する。
- **デザイントークンを優先**：色・角丸・影・余白・文字色は CSS 変数（または共通定数）から参照し、ページ単位のハードコードを禁止する。
  - 例：`--brand`, `--text-muted`, `--border`, `--surface`, `--radius-lg` など
- **状態表現の統一**：
  - success / warning / danger / neutral の4系統を基本にし、バッジ・カード・通知で色や文言を揃える。
- **“増やすより削る”**：カードやチャートは必要最低限。表示するなら「意思決定に効く指標」だけ。

---

### 4) 機能思想（プロジェクト管理としての必須）

- **権限（Owner/Admin/Member/Guest）は“UIとルールで二重に守る”**
  - UI：見せない/押せない（ルートガード・ボタン非表示）
  - Firestore Rules：実際に拒否（最終防衛線）
- **招待は“安全に管理できる”**
  - 招待リンクは一覧管理でき、失効/期限/作成者/ロール付与が追跡できる。
- **カテゴリは“運用できる”**
  - 作成・編集（名前/色/説明）
  - 削除は安全第一：使用中なら削除不可（or 将来的に移行UI）

---

### 5) 実装アーキテクチャ（読みやすさ＝バグ減）

- **責務分離の鉄則**
  - `pages/`：購読（listen）・画面構成・ルーティングだけ（ロジックを肥大化させない）
  - `components/`：表示とUIイベント
  - `composables/`：状態・派生・UIロジック（フィルタ、検索、表示名解決など）
  - `services/`：Firestore操作（CRUD / listen / バリデーション / 安全チェック）
- **重複は負債**：同じUI・同じ処理は必ず共通化（コンポーネント or composable）。
- **ハードコード禁止**：ルート名/ラベル/色/ロールなどは constants に集約。
- **O(1)参照を意識**：カテゴリなどは `Map` 化して参照し、ループ検索を避ける。
- **購読の後始末は必須**：`onBeforeUnmount` で unsubscribe を必ず行う。

---

### 6) データ整合性・バリデーション

- **入力はサービスで正規化**
  - 文字列は `trim()`、長さ制限、空文字禁止など
- **削除の安全設計**
  - 参照がある場合の削除は禁止（MVPは block）。
  - 例：カテゴリ削除前に `tasks where categoryId == X limit(1)` を確認。
- **ユーザーに優しい失敗**
  - エラーは握りつぶさず、UI通知（Toast/Alert）＋ logtape で記録。

---

### 7) アニメーション思想（気持ちよさは“邪魔しない”）

- **目的がある動きだけ**
  - 画面遷移：軽い fade/slide（150〜220ms）
  - ドロワー：右からスッと出る、オーバーレイで閉じる
  - ローディング：控えめ（スケルトン/小さなスピナー）
- **Reduced Motion 対応**：`prefers-reduced-motion` を尊重する。

---

### 8) アクセシビリティ（最低ラインを守る）

- クリック要素は `button` を優先、`aria-label` を付与。
- フォーカスリングを消さない。
- 色だけで状態を伝えない（ラベル/アイコン/文言も併用）。

---

### 9) PR運用ルール（実務で崩れないため）

- **小さく分ける**：UI大改修でも「見た目だけ」「ロジック分離」「サービス変更」などに分割。
- **PRには必ず含める**
  - 変更意図（Before/After）
  - 影響範囲
  - 手動検証チェックリスト（スマホ幅含む）
  - スクショ（可能なら）
- **Definition of Done**
  - `lint / typecheck / format / build` が通る
  - 主要導線が壊れていない（ダッシュボード・タスク・カテゴリ・招待・設定）
  - 権限で見える/触れる範囲が想定通り
