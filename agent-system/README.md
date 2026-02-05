# 🤖 Flilo Multi-Agent Debug System

Claude Code を複数起動して、自動的にバグ検出・タスク管理・修正を行うシステム。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                   📋 タスクキュー (tasks.json)                    │
│         優先度: critical > high > medium > low                   │
└─────────────────────────────────────────────────────────────────┘
        ↑ 作成                ↓ 読取・分配              ↑ 検証
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  🔍 審査官      │      │  👔 マネージャー │      │  🛡️ ガード     │
│  (Reviewer)   │      │  (Manager)    │      │  (Guardian)   │
│               │      │               │      │               │
│ 永続稼働        │      │ タスク分配      │      │ skills準拠    │
│ - バグ検出     │      │ - 優先度判断    │      │ - UI規約確認   │
│ - コードレビュー │      │ - Worker指示  │      │ - 品質ゲート   │
│ - タスク作成   │      │ - 進捗追跡     │      │ - PR前チェック │
└───────────────┘      └───────┬───────┘      └───────────────┘
                               │
                ┌──────────────┼──────────────┐
                ↓              ↓              ↓
          ┌──────────┐  ┌──────────┐  ┌──────────┐
          │ 🔧 Worker │  │ 🔧 Worker │  │ 🔧 Worker │
          │    #1    │  │    #2    │  │    #3    │
          │ 修正実行  │  │ 修正実行  │  │ 修正実行  │
          └──────────┘  └──────────┘  └──────────┘
```

## セットアップ

```bash
# 1. agent-system をプロジェクトルートにコピー
cp -r agent-system /path/to/your/flilo-project/.agent-system

# 2. タスクキューを初期化
cd /path/to/your/flilo-project
./.agent-system/scripts/init.sh

# 3. 各エージェントを別ターミナルで起動
```

## エージェント起動方法

### ターミナル1: 審査官（Reviewer）

```bash
cd /path/to/your/flilo-project
claude --profile reviewer
# または
claude -p "あなたは審査官です。.agent-system/agents/reviewer/CLAUDE.md を読んで作業を開始してください"
```

### ターミナル2: マネージャー（Manager）

```bash
claude --profile manager
```

### ターミナル3: ガード（Guardian）

```bash
claude --profile guardian
```

### ターミナル4-6: ワーカー（Workers）

```bash
claude --profile worker
```

## ファイル構造

```
.agent-system/
├── README.md                 # このファイル
├── tasks/
│   ├── queue.json           # タスクキュー（メイン）
│   ├── completed.json       # 完了タスク履歴
│   └── schema.md            # タスクスキーマ定義
├── agents/
│   ├── reviewer/
│   │   └── CLAUDE.md        # 審査官の指示書
│   ├── manager/
│   │   └── CLAUDE.md        # マネージャーの指示書
│   ├── guardian/
│   │   └── CLAUDE.md        # ガードの指示書
│   └── worker/
│       └── CLAUDE.md        # ワーカーの指示書
├── reports/
│   └── .gitkeep             # レビューレポート保存先
├── scripts/
│   ├── init.sh              # 初期化スクリプト
│   └── status.sh            # 状態確認スクリプト
└── config/
    └── rules-summary.md     # skills要約（エージェント用）
```

## タスクのライフサイクル

```
[pending] → [assigned] → [in_progress] → [review] → [completed]
                                              ↓
                                         [rejected] → [pending]
```

## 使用例

### 1. 全体スキャンを開始

```
# 審査官に指示
「src/pages/ 配下の全ファイルをレビューして、skillsに違反しているコードをタスク化してください」
```

### 2. 特定の問題に集中

```
# 審査官に指示
「ハードコードされた色（hex/rgb）を検出して、すべてタスク化してください」
```

### 3. 進捗確認

```bash
./.agent-system/scripts/status.sh
```

## 注意事項

- **排他制御**: 同じファイルを複数Workerが同時編集しないよう、Managerが調整
- **コンフリクト**: 発生時はManagerがマージ指示を出す
- **無限ループ防止**: 同じタスクが3回rejectされたら人間にエスカレーション
