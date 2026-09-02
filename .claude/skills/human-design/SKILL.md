---
name: human-design
description: Flilo でUIを作る・変えるときの必須デザイン規律。Vue コンポーネント / ページ / CSS の新規作成、スタイル変更、画面デザイン、レイアウト調整、ボタン・カード・モーダル・フォーム等のUI実装を行うときは必ずこのスキルを使うこと。「AIっぽいデザイン」（紫グラデーション、絵文字アイコン、ガラスモーフィズム、均質なカード羅列、Inter 等の定番フォント）を禁止し、Deep Green / Card UI デザインシステムに沿った人間がデザインしたようなUIを作らせる。Use whenever creating or editing any Vue component, page, style, or UI in this repo.
---

# Human Design — AIっぽくないUIを作る

## なぜこのスキルがあるか

AIが生成するUIには強い「指紋」がある: 紫系グラデーション、✨🚀 などの装飾絵文字、
ガラスモーフィズム、等幅グリッドに並んだアイコンカード、中身のないキャッチコピー。
Flilo は Deep Green / Card UI という明確なデザインシステムを持っており、
この指紋が1つ混ざるだけで製品全体が「AIが作った量産アプリ」に見える。

このリポジトリでは編集のたびにフック（`scripts/checkAiDesign.mjs`）が自動レビューし、
該当すると **やり直しを要求される**。手戻りを防ぐため、書く前にこのルールに従うこと。

## 書く前に決まっていること（迷わない）

- **色・角丸・影・余白・フォントは自分で選ばない。** `src/styles/ui-tokens.css` の
  `--ui-*` トークンから参照する。欲しい値が無ければまずトークンを追加し、そこから参照する。
- **UIパーツは自分で作らない。** `src/components/ui/` に AppButton / AppCard(SectionCard) /
  AppModal / AppInput / AppBadge / AppAlert / AppDrawer / AppEmptyState / AppSkeleton 等が
  既にある。まず既存を探し、variant 追加で済むなら共通側を拡張する。`pages/` に直書きしない。
- **配色は Deep Green 基調。** 紫・バイオレット・ネオン系は存在しない。
  アクセントが欲しいときは `--ui-brand-300`〜`900` と semantic 4系統
  (success / warning / danger / info) の範囲で組む。
- **フォントは system-ui スタック** (`--ui-font-sans`)。Google Fonts を足さない。
- **動きは 150〜220ms・控えめ。** ホバーで大きく浮かせない（translateY は 2px 程度まで）。
  `--ui-duration-*` / `--ui-ease-standard` を使い、`prefers-reduced-motion` を尊重する。

## 「AIっぽい」と判定される主な条件

詳細は `.claude/skills/design-review/references/ai-design-checklist.md` を読むこと。要点:

| やりがちなAI指紋                         | 代わりにやること                                           |
| ---------------------------------------- | ---------------------------------------------------------- |
| `linear-gradient(135deg, 紫, 青)`        | グラデ自体を再検討。Hero のみ `--ui-hero-gradient`         |
| 見出しやボタンに ✨🚀🎉💡                | 絵文字を消す。アイコンが要るなら SVG + `currentColor`      |
| `backdrop-filter: blur` のガラス風カード | `--ui-surface` + `--ui-border` + `--ui-shadow-md` のカード |
| `font-family: 'Inter', ...`              | `--ui-font-sans`                                           |
| hex / rgb の直書き                       | トークン参照（無ければ `ui-tokens.css` に追加）            |
| グラデ文字（background-clip: text）      | `--ui-text-strong` の通常テキスト                          |
| アイコン+見出し+説明の3枚カード羅列      | 実データ・実タスクを主役にした情報設計（Nowファースト）    |
| 「〜を、もっとシンプルに。」系コピー     | 機能を具体的に説明する日本語                               |

## 人間らしく見せる設計の勘所

- **情報に強弱をつける**: 1st 要点（カード/警告）→ 2nd 一覧 → 3rd 詳細。
  全部を同じ大きさのカードにしない。主役を1つ決め、脇役の彩度・サイズを落とす。
- **実コンテンツで組む**: ダミー数値やプレースホルダで見た目を埋めない。
  データが無い状態は `AppEmptyState` で正直に見せる。
- **状態は色+ラベルで**: success / warning / danger / neutral の4系統。色だけで伝えない。
- **モバイルで横スクロールを出さない**: 固定 px 幅を並べない。

## 実装後のセルフレビュー（必須）

UI に触れたら、終える前に必ず:

```bash
node scripts/checkAiDesign.mjs --diff
```

- ERROR が出たら **その場で修正して再実行**。クリーンになるまで繰り返す。
- WARN も原則修正。意図的に残す場合は理由を PR 本文に書く。
- 仕上げの総合レビューは `/design-review` スキルを使う。
