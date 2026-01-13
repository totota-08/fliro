#!/bin/bash

# Flilo Multi-Agent System ステータス確認スクリプト

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$SCRIPT_DIR")"
QUEUE_FILE="$AGENT_DIR/tasks/queue.json"
WORKERS_FILE="$AGENT_DIR/tasks/workers.json"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Flilo Multi-Agent System ステータス"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# jq がインストールされているか確認
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq がインストールされていません。"
    echo "   brew install jq (macOS) または apt install jq (Ubuntu) でインストールしてください。"
    echo ""
    echo "📋 Raw queue.json:"
    cat "$QUEUE_FILE"
    exit 1
fi

# キューファイルの存在確認
if [ ! -f "$QUEUE_FILE" ]; then
    echo "❌ queue.json が見つかりません。"
    echo "   ./scripts/init.sh を実行してください。"
    exit 1
fi

echo "📊 タスクキュー状態"
echo "──────────────────────────────────────────────────"

# ステータス別集計
PENDING=$(jq '[.tasks[] | select(.status == "pending")] | length' "$QUEUE_FILE")
ASSIGNED=$(jq '[.tasks[] | select(.status == "assigned")] | length' "$QUEUE_FILE")
IN_PROGRESS=$(jq '[.tasks[] | select(.status == "in_progress")] | length' "$QUEUE_FILE")
REVIEW=$(jq '[.tasks[] | select(.status == "review")] | length' "$QUEUE_FILE")
COMPLETED=$(jq '[.tasks[] | select(.status == "completed")] | length' "$QUEUE_FILE")
REJECTED=$(jq '[.tasks[] | select(.status == "rejected")] | length' "$QUEUE_FILE")
ESCALATED=$(jq '[.tasks[] | select(.status == "escalated")] | length' "$QUEUE_FILE")
TOTAL=$(jq '.tasks | length' "$QUEUE_FILE")

echo "ステータス      | 件数"
echo "──────────────────────────────────────────────────"
printf "🔵 pending      | %d\n" "$PENDING"
printf "🟣 assigned     | %d\n" "$ASSIGNED"
printf "🟠 in_progress  | %d\n" "$IN_PROGRESS"
printf "🔍 review       | %d\n" "$REVIEW"
printf "✅ completed    | %d\n" "$COMPLETED"
printf "❌ rejected     | %d\n" "$REJECTED"
printf "🚨 escalated    | %d\n" "$ESCALATED"
echo "──────────────────────────────────────────────────"
printf "合計            | %d\n" "$TOTAL"
echo ""

# 優先度別集計
echo "📈 優先度別（未完了）"
echo "──────────────────────────────────────────────────"
CRITICAL=$(jq '[.tasks[] | select(.status != "completed" and .priority == "critical")] | length' "$QUEUE_FILE")
HIGH=$(jq '[.tasks[] | select(.status != "completed" and .priority == "high")] | length' "$QUEUE_FILE")
MEDIUM=$(jq '[.tasks[] | select(.status != "completed" and .priority == "medium")] | length' "$QUEUE_FILE")
LOW=$(jq '[.tasks[] | select(.status != "completed" and .priority == "low")] | length' "$QUEUE_FILE")

printf "🔴 critical     | %d\n" "$CRITICAL"
printf "🟠 high         | %d\n" "$HIGH"
printf "🟡 medium       | %d\n" "$MEDIUM"
printf "🟢 low          | %d\n" "$LOW"
echo ""

# Criticalタスク警告
if [ "$CRITICAL" -gt 0 ]; then
    echo "⚠️  Critical タスクがあります:"
    jq -r '.tasks[] | select(.status != "completed" and .priority == "critical") | "   - [\(.id[0:8])...] \(.title)"' "$QUEUE_FILE"
    echo ""
fi

# エスカレーション警告
if [ "$ESCALATED" -gt 0 ]; then
    echo "🚨 エスカレーションが必要なタスク:"
    jq -r '.tasks[] | select(.status == "escalated") | "   - [\(.id[0:8])...] \(.title) (試行: \(.attempts)回)"' "$QUEUE_FILE"
    echo ""
fi

# Worker状態
if [ -f "$WORKERS_FILE" ]; then
    echo "👷 Worker 状態"
    echo "──────────────────────────────────────────────────"
    jq -r '.workers[] | "\(.id): \(.status) \(if .currentTask then "(タスク: " + .currentTask[0:8] + "...)" else "" end)"' "$WORKERS_FILE"
    echo ""
fi

# 最近のタスク
echo "📋 最近のタスク（最新5件）"
echo "──────────────────────────────────────────────────"
jq -r '.tasks | sort_by(.updatedAt) | reverse | .[0:5][] | "[\(.status)] \(.title[0:40])\(if (.title | length) > 40 then "..." else "" end)"' "$QUEUE_FILE" 2>/dev/null || echo "(タスクなし)"
echo ""

# 最終更新
LAST_UPDATED=$(jq -r '.lastUpdated' "$QUEUE_FILE")
echo "⏰ 最終更新: $LAST_UPDATED"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
