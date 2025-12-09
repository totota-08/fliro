# Fliro
小規模チーム向けのプロジェクト管理ツールです（旧称 Teamie）。

## ブランチルール
- ベースブランチ: `develop`
- プレフィックス: 新機能 `feature/`、バグ修正 `fix/`、環境・設定 `chore/`、緊急対応 `hotfix/`
- フロー: `git checkout develop` → `git pull` → `git checkout -b <branch_name>`
- プルリクエストは `develop` 向けに作成（hotfix は `main` と `develop` の両方）
