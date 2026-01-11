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

## Firebase Storage CORS設定

ローカル開発環境でファイルアップロードを行う場合、Firebase StorageのCORS設定が必要です。

### 設定手順

1. Google Cloud SDK をインストール（未インストールの場合）
   ```bash
   # macOS
   brew install google-cloud-sdk

   # または公式サイトからダウンロード
   # https://cloud.google.com/sdk/docs/install
   ```

2. 認証
   ```bash
   gcloud auth login
   ```

3. CORS設定を適用
   ```bash
   gsutil cors set cors.json gs://teamie-dev.appspot.com
   ```

4. 設定確認
   ```bash
   gsutil cors get gs://teamie-dev.appspot.com
   ```

### 本番環境への設定

本番環境では `cors.json` の `origin` に本番ドメインを追加してください。

```json
[
  {
    "origin": ["http://localhost:5173", "https://your-production-domain.com"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization", "x-goog-resumable"]
  }
]
```
