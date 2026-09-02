---
name: design-review
description: 変更したUIが「AIっぽいデザイン」になっていないか自動レビューし、該当したら修正（やり直し）を繰り返させるレビューコマンド。/design-review で起動するほか、UI変更を終えた後の最終確認、PR作成前のチェック、「デザインをレビューして」「AIっぽくないか見て」「デザイン崩れてないか確認して」と言われたら必ず使うこと。checkAiDesign.mjs の機械判定と定性チェックリストの両方で PASS するまで終わらせない。Use to review any UI/design change for AI-generated look before finishing or opening a PR.
---

# Design Review — AIっぽさの自動レビュー & やり直しループ

変更されたUIを「AIっぽいデザイン」判定基準でレビューし、**PASS するまで修正を繰り返す**。
判定基準の本文は必ず `references/ai-design-checklist.md` を読むこと。

## 手順

### 1. 機械判定

```bash
node scripts/checkAiDesign.mjs --diff
```

develop との差分で「追加された行」だけが検査される。
特定ファイルだけ全行を見たい場合は `node scripts/checkAiDesign.mjs <file...>`。

### 2. 定性判定

機械では取れない「AIっぽさ」を見る。`git diff` で変更された `.vue` / `.css` を実際に読み、
`references/ai-design-checklist.md` の **定性判定** セクション（汎用ヒーロー構成、
3枚組アイコンカード、均質リズム、ダミーデータ、中身のないコピー、
components/ui 不使用、Nowファースト違反、モバイル横スクロール）を1項目ずつ確認する。

### 3. 判定とやり直し

- **機械判定 ERROR ≧ 1 または 定性判定に該当あり → REDO**
  - 指摘箇所をすべて修正する（トークン参照化・共通コンポーネント化・絵文字除去など。
    修正方針は human-design スキルに従う）
  - 修正したら手順 1 に戻る。**PASS するまでこのループを抜けない**
- **ERROR 0 かつ 定性該当なし → PASS**
  - WARN が残っている場合は原則修正。意図的に残すなら理由を控えておき PR 本文に書く

### 4. 結果レポート

レビュー完了時、必ずこの形式で報告する:

```
## デザインレビュー結果: PASS / REDO→PASS (N周)

### 機械判定
- ERROR: 0 / WARN: N（残した WARN と理由）

### 定性判定
- 該当なし / 修正した項目の一覧

### 修正内容（あれば）
- <file>: <何をどう直したか>
```

## 補足

- このリポジトリでは編集のたびに PostToolUse フックが同じチェッカーを自動実行し、
  ターン終了時にも Stop フックが最終ゲートとして走る。フックに指摘された場合も
  このスキルの手順 3 と同じ方針で修正する。
- チェッカー自体の誤検出を見つけたら、無効化せず `scripts/checkAiDesign.mjs` の
  ルールを直すこと（検出をすり抜ける形での回避は禁止）。
