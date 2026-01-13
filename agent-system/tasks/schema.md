# タスクスキーマ定義

## Task Object

```typescript
interface Task {
  id: string; // UUID v4
  title: string; // タスク概要（日本語）
  description: string; // 詳細説明
  type: TaskType; // タスクの種類
  priority: Priority; // 優先度
  status: Status; // 状態

  // 対象
  files: string[]; // 対象ファイルパス
  lineNumbers?: {
    // 該当行（任意）
    file: string;
    start: number;
    end: number;
  }[];

  // 違反情報
  violation?: {
    rule: string; // 違反したルール名
    category: ViolationCategory; // 違反カテゴリ
    severity: Severity; // 重大度
    evidence: string; // 証拠（コードスニペット等）
  };

  // 管理
  createdBy: AgentRole; // 作成者
  assignedTo?: string; // 担当Worker ID
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601

  // 履歴
  history: HistoryEntry[]; // 状態変更履歴
  attempts: number; // 試行回数（3回でエスカレーション）

  // 関連
  blockedBy?: string[]; // 依存タスクID
  relatedTasks?: string[]; // 関連タスクID
}
```

## Enums

### TaskType

```typescript
type TaskType =
  | "bug" // バグ修正
  | "hardcode" // ハードコード修正
  | "refactor" // リファクタリング
  | "style_violation" // スタイル違反
  | "a11y" // アクセシビリティ
  | "performance" // パフォーマンス
  | "security" // セキュリティ
  | "architecture" // 設計違反
  | "duplicate" // 重複コード
  | "dead_code" // 不要コード
  | "missing_unsubscribe" // 購読解除漏れ
  | "other";
```

### Priority

```typescript
type Priority = "critical" | "high" | "medium" | "low";
```

### Status

```typescript
type Status =
  | "pending" // 未着手
  | "assigned" // 割り当て済み
  | "in_progress" // 作業中
  | "review" // レビュー待ち
  | "completed" // 完了
  | "rejected" // 差し戻し
  | "escalated"; // 人間にエスカレーション
```

### ViolationCategory

```typescript
type ViolationCategory =
  | "design_token" // デザイントークン違反
  | "component_reuse" // 共通コンポーネント未使用
  | "layout" // レイアウト崩壊
  | "responsibility" // 責務分離違反
  | "naming" // 命名規則違反
  | "accessibility" // a11y違反
  | "animation" // アニメーション違反
  | "permission" // 権限処理違反
  | "validation" // バリデーション違反
  | "subscription" // 購読管理違反
  | "other";
```

### Severity

```typescript
type Severity = "critical" | "major" | "minor" | "info";
```

### AgentRole

```typescript
type AgentRole = "reviewer" | "manager" | "guardian" | "worker" | "human";
```

## 例

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "TaskCard.vue でハードコードされた色を修正",
  "description": "#2D5A47 がハードコードされています。CSS変数 --color-primary に置き換えてください。",
  "type": "hardcode",
  "priority": "high",
  "status": "pending",
  "files": ["src/components/TaskCard.vue"],
  "lineNumbers": [
    { "file": "src/components/TaskCard.vue", "start": 45, "end": 45 }
  ],
  "violation": {
    "rule": "デザイントークン以外禁止",
    "category": "design_token",
    "severity": "major",
    "evidence": "background-color: #2D5A47;"
  },
  "createdBy": "reviewer",
  "createdAt": "2025-01-12T10:00:00Z",
  "updatedAt": "2025-01-12T10:00:00Z",
  "history": [
    {
      "status": "pending",
      "timestamp": "2025-01-12T10:00:00Z",
      "by": "reviewer",
      "note": "自動検出"
    }
  ],
  "attempts": 0
}
```
