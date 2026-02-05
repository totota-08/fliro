# Flilo Skills 要約（エージェント用クイックリファレンス）

このファイルは `.claude/skills.md` の要約です。詳細は元ファイルを参照してください。

---

## 🔴 絶対禁止（違反 = 即修正）

### 1. ハードコード禁止

| 項目     | ❌ 禁止                | ✅ 正しい            |
| -------- | ---------------------- | -------------------- |
| 色       | `#2D5A47`, `rgb(...)`  | `var(--color-*)`     |
| 角丸     | `border-radius: 8px`   | `var(--radius-*)`    |
| 影       | `box-shadow: 0 2px...` | `var(--shadow-*)`    |
| 余白     | 一貫性のない値         | トークン参照         |
| フォント | `font-size: 14px`      | `var(--font-size-*)` |

### 2. ページ直書きUI禁止

`pages/` で以下を独自実装してはいけない：

- ボタン → `AppButton`
- モーダル → `AppModal`
- カード → `AppCard`
- 入力 → `AppInput`
- アラート → `AppAlert`

### 3. 固定幅禁止

```css
/* ❌ */
width: 800px;
/* ✅ */
max-width: 800px;
width: 100%;
```

---

## 🟠 責務分離

| レイヤー       | 責務                         | やってはいけないこと            |
| -------------- | ---------------------------- | ------------------------------- |
| `pages/`       | 購読、画面構成、ルーティング | Firestore直接操作、複雑ロジック |
| `components/`  | UI表示、UIイベント           | Firestore操作                   |
| `services/`    | CRUD、listen、validation     | UIロジック                      |
| `composables/` | 状態、派生、UIロジック       | -                               |

---

## 🟡 必須パターン

### 購読解除

```typescript
const unsubscribe = onSnapshot(query, handler);
onBeforeUnmount(() => {
  unsubscribe(); // 必須
});
```

### Map化でO(1)参照

```typescript
const categoriesById = computed(
  () => new Map(categories.value.map((c) => [c.id, c])),
);
```

### logtape使用

```typescript
// ❌ console.log('debug')
// ✅
import { getLogger } from "@logtape/logtape";
const logger = getLogger(["module", "name"]);
logger.debug("message");
```

---

## 🟢 UI/UXルール

### 状態表現（4系統）

- `success` - 成功
- `warning` - 警告
- `danger` - エラー
- `neutral` - 通常

**色だけで伝えない**（ラベル/アイコン/文言を併用）

### アニメーション

- 目的がある動きだけ
- 150〜220ms
- `prefers-reduced-motion` 尊重

### アクセシビリティ最低ライン

- クリック要素 → `<button>` 優先
- `aria-label` 付与
- フォーカスリング維持

---

## 📁 ファイル構造

```
src/
├── components/
│   └── ui/          # 共通UIコンポーネント
├── pages/           # ページコンポーネント
├── composables/     # 状態・UIロジック
├── services/        # Firestore操作
├── styles/          # デザイントークン
└── router/          # ルーティング
```

---

## ✅ PRチェックリスト

- [ ] Desktop / Mobile でレイアウト崩れがない
- [ ] 主要導線が壊れていない
- [ ] `lint / typecheck / format / build` が通る
- [ ] 影響範囲と手動検証項目が記載されている

---

## コマンド早見表

```bash
npm run dev        # 開発サーバー
npm run build      # ビルド
npm run lint       # ESLint
npm run typecheck  # 型チェック
npm run format     # Prettier
npm run test:rules # Firestoreルールテスト
```
