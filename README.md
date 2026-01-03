# Fliro

小規模チーム向けのプロジェクト管理ツールです。

## ブランチルール

- ベースブランチ: `develop`
- プレフィックス: 新機能 `feature/`、バグ修正 `fix/`、環境・設定 `chore/`、緊急対応 `hotfix/`
- フロー: `git checkout develop` → `git pull` → `git checkout -b <branch_name>`
- プルリクエストは `develop` 向けに作成（hotfix は `main` と `develop` の両方）

## コミット / PR ルール

- コミット接頭辞は英語で統一（例: `feat:`, `fix:`, `chore:`, `refactor:`）
- タスクIDをコミットメッセージ / ブランチ名 / PRタイトルに含める
- PRタイトル形式: `[T#] 説明`
- PR本文に以下を含める
  - 変更概要と理由
  - 変更点の詳細
  - UI変更がある場合はスクリーンショット
  - テスト手順と実施結果
  - 影響範囲
  - セルフレビューのチェックリスト
