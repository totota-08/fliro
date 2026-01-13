#!/bin/bash

# Flilo Multi-Agent System 初期化スクリプト

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🤖 Flilo Multi-Agent System を初期化しています..."

# タスクキューの初期化
if [ ! -f "$AGENT_DIR/tasks/queue.json" ]; then
    echo '{"version":"1.0.0","lastUpdated":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","tasks":[]}' > "$AGENT_DIR/tasks/queue.json"
    echo "✅ tasks/queue.json を作成しました"
else
    echo "ℹ️  tasks/queue.json は既に存在します"
fi

# 完了タスク履歴の初期化
if [ ! -f "$AGENT_DIR/tasks/completed.json" ]; then
    echo '{"version":"1.0.0","tasks":[]}' > "$AGENT_DIR/tasks/completed.json"
    echo "✅ tasks/completed.json を作成しました"
else
    echo "ℹ️  tasks/completed.json は既に存在します"
fi

# Worker追跡ファイルの初期化
if [ ! -f "$AGENT_DIR/tasks/workers.json" ]; then
    cat > "$AGENT_DIR/tasks/workers.json" << 'EOF'
{
  "workers": [
    {"id": "worker-1", "status": "idle", "currentTask": null, "lastSeen": null},
    {"id": "worker-2", "status": "idle", "currentTask": null, "lastSeen": null},
    {"id": "worker-3", "status": "idle", "currentTask": null, "lastSeen": null}
  ]
}
EOF
    echo "✅ tasks/workers.json を作成しました"
else
    echo "ℹ️  tasks/workers.json は既に存在します"
fi

# レポートディレクトリの作成
mkdir -p "$AGENT_DIR/reports"
touch "$AGENT_DIR/reports/.gitkeep"
echo "✅ reports/ ディレクトリを準備しました"

# .gitignore の確認
if [ -f "$AGENT_DIR/../.gitignore" ]; then
    if ! grep -q ".agent-system/reports/" "$AGENT_DIR/../.gitignore" 2>/dev/null; then
        echo "" >> "$AGENT_DIR/../.gitignore"
        echo "# Agent system reports (generated)" >> "$AGENT_DIR/../.gitignore"
        echo ".agent-system/reports/*.md" >> "$AGENT_DIR/../.gitignore"
        echo "!.agent-system/reports/.gitkeep" >> "$AGENT_DIR/../.gitignore"
        echo "✅ .gitignore にレポート除外設定を追加しました"
    fi
fi

echo ""
echo "🎉 初期化完了！"
echo ""
echo "次のステップ:"
echo "  1. 各ターミナルでエージェントを起動"
echo "  2. 詳細は README.md を参照"
echo ""
echo "エージェント起動コマンド:"
echo "  ターミナル1: claude -p \"審査官です。.agent-system/agents/reviewer/CLAUDE.md を読んで開始\""
echo "  ターミナル2: claude -p \"マネージャーです。.agent-system/agents/manager/CLAUDE.md を読んで開始\""
echo "  ターミナル3: claude -p \"ガードです。.agent-system/agents/guardian/CLAUDE.md を読んで開始\""
echo "  ターミナル4: claude -p \"Worker-1です。.agent-system/agents/worker/CLAUDE.md を読んで開始\""
