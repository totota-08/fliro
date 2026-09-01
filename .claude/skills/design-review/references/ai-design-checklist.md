# 「AIっぽいデザイン」判定基準（Flilo 公式チェックリスト）

Flilo は Deep Green / Card UI のデザインシステム（`src/styles/ui-tokens.css`）を持つ。
ここから逸脱した「AI生成にありがちな見た目」を **機械判定** と **定性判定** の二段でレビューし、
1つでも ERROR に該当したら **REDO（やり直し）** とする。

---

## 1. 機械判定（`node scripts/checkAiDesign.mjs`）

変更された行だけが対象。ERROR はブロック、WARN は修正推奨。

| ルール             | 重さ  | 内容                                                                              | 正しいやり方                                           |
| ------------------ | ----- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `ai-purple`        | ERROR | 紫〜バイオレット〜マゼンタ系の色（#8b5cf6, #667eea 等）。AI生成UIの最頻出シグナル | Deep Green パレット `--ui-brand-*`                     |
| `ai-gradient`      | ERROR | `linear-gradient(135deg …)`（AI定番の斜めグラデ）                                 | グラデ自体を再検討。Hero 用途のみ `--ui-hero-gradient` |
| `gradient-text`    | ERROR | `background-clip: text` によるグラデ文字                                          | 通常のテキストカラー（`--ui-text-*`）                  |
| `ai-font`          | ERROR | Inter / Poppins / Space Grotesk / Manrope 等の直指定                              | `--ui-font-sans`（system-ui スタック）                 |
| `hardcoded-color`  | ERROR | hex / rgb() / white / black の直書き                                              | `ui-tokens.css` のトークン参照（無ければ追加）         |
| `ai-emoji`         | ERROR | ✨🚀🎉🔥⚡🌟💫🪄🌈🤖💡🎯 の装飾利用                                               | 削除、またはSVG/共通コンポーネントのアイコン           |
| `inline-style`     | ERROR | インライン style のグラデーション                                                 | scoped CSS + トークン                                  |
| `placeholder-copy` | ERROR | Lorem ipsum                                                                       | 実コンテンツ                                           |
| `gradient`         | WARN  | 135deg 以外のグラデ直書き                                                         | 限定用途のみ・トークン化                               |
| `glassmorphism`    | WARN  | `backdrop-filter: blur`                                                           | Card UI（`--ui-surface` + `--ui-shadow-*`）            |
| `emoji`            | WARN  | その他絵文字のUI装飾利用                                                          | SVG/共通コンポーネント（ユーザー入力表示は除外）       |
| `template-color`   | WARN  | テンプレート内の色直書き（SVG fill 等）                                           | `currentColor` / トークン                              |
| `token-size`       | WARN  | font-size 直書き                                                                  | `--ui-text-xs`〜`3xl`                                  |
| `token-radius`     | WARN  | border-radius 直書き                                                              | `--ui-radius-sm`〜`full`                               |
| `token-font`       | WARN  | font-family 直書き                                                                | `--ui-font-sans` / `--ui-font-mono`                    |
| `floaty-hover`     | WARN  | `:hover` での `translateY(-6px)` 以上の浮遊                                       | 動きは控えめに（〜2px、150〜220ms）                    |

### 意図的に許容しているパターン（違反ではない）

- `src/pages/secret/`（イースターエッグの演出ページ）と `src/pages/debug/`（開発用ツール）は検査対象外。
- モーダル / ドロワー / モバイルサイドバーの**オーバーレイ**の `blur(2px)` 程度、および
  スティッキートップバーの半透明 + blur は、全画面で統一された既存パターンとして許容。
  ただし**カード・パネル面**のガラスモーフィズムは不可（Card UI で表現する）。
- `var(--token, フォールバック値)` のフォールバックリテラルは既存規約として許容
  （トークン参照が主であるため。色チェックの対象外）。
- エントランスアニメーションの開始オフセット（例: `translateY(-8px)` → 0）は
  浮遊ホバーとは別物として許容。

---

## 2. 定性判定（機械では取れない「AIっぽさ」）

変更されたUIを実際に読んで、以下に該当しないか確認する。該当 = REDO。

### 構成のAIっぽさ

- [ ] **汎用ヒーロー構成**: 中央寄せの大見出し + サブコピー + CTAボタン2つ、だけの構成
- [ ] **3枚組アイコンカード**: アイコン + 見出し + 説明文のカードを等幅グリッドで並べただけの機能紹介
- [ ] **均質リズム**: 全要素が同じ角丸・同じ影・同じ余白で、情報の強弱（1st 要点 / 2nd 一覧 / 3rd 詳細）がない
- [ ] **ダミーデータ**: 実データではなく「99+」「1,234」などのそれっぽい数値やプレースホルダ文言

### 文言のAIっぽさ

- [ ] 「〜を、もっとシンプルに。」「〜の新しいカタチ」系の中身のないキャッチコピー
- [ ] 見出し・ボタンへの装飾絵文字（機械判定と重複するが script 内の文字列定数も見る）
- [ ] 過剰な感嘆符・煽り文言（「今すぐ始めよう！」の乱発）

### Flilo 設計思想との整合（CLAUDE.md 準拠）

- [ ] `pages/` にページ独自のボタン/モーダル/カードを直書きしていないか（`components/ui/` を使ったか）
- [ ] Nowファースト: ダッシュボード系は「現在の状況・直近の期限・滞留」が最優先になっているか
- [ ] 状態表現は success / warning / danger / neutral の4系統 + ラベル/アイコン併用か（色だけで伝えていないか）
- [ ] モバイルで横スクロールが発生しないか（固定幅の多用がないか）
- [ ] `prefers-reduced-motion` を壊す独自アニメを足していないか

---

## 3. 判定

- **PASS**: 機械判定 ERROR 0 かつ 定性判定すべて非該当
- **REDO**: それ以外。指摘箇所を修正して再判定。PASS するまで繰り返す
- WARN は原則修正する。意図があって残す場合は PR 本文に理由を書く
