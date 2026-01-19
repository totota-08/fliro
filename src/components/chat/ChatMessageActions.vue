<script setup lang="ts">
/**
 * ChatMessageActions - メッセージアクションバー
 *
 * ホバー時に表示されるアクションボタン群
 * - 絵文字リアクション
 * - 返信
 * - 編集（自分のメッセージのみ）
 * - コピー
 * - 削除（自分のメッセージまたはOwner/Admin）
 */

defineProps<{
  /** 編集可能か（自分のメッセージ） */
  canEdit?: boolean;
  /** 削除可能か（自分のメッセージまたはOwner/Admin） */
  canDelete?: boolean;
  /** アクション位置: 'left' | 'right' */
  position?: "left" | "right";
}>();

const emit = defineEmits<{
  (e: "react"): void;
  (e: "reply"): void;
  (e: "edit"): void;
  (e: "copy"): void;
  (e: "delete"): void;
}>();
</script>

<template>
  <div
    class="message-actions"
    :class="{ 'message-actions--right': position === 'right' }"
  >
    <button
      type="button"
      class="action-btn"
      title="リアクション"
      aria-label="リアクションを追加"
      @click="emit('react')"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="16"
        height="16"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    </button>

    <button
      type="button"
      class="action-btn"
      title="返信"
      aria-label="返信する"
      @click="emit('reply')"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="16"
        height="16"
      >
        <polyline points="9 17 4 12 9 7" />
        <path d="M20 18v-2a4 4 0 00-4-4H4" />
      </svg>
    </button>

    <button
      v-if="canEdit"
      type="button"
      class="action-btn"
      title="編集"
      aria-label="編集する"
      @click="emit('edit')"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="16"
        height="16"
      >
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>

    <button
      type="button"
      class="action-btn"
      title="コピー"
      aria-label="メッセージをコピー"
      @click="emit('copy')"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="16"
        height="16"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
    </button>

    <button
      v-if="canDelete"
      type="button"
      class="action-btn action-btn--danger"
      title="削除"
      aria-label="削除する"
      @click="emit('delete')"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="16"
        height="16"
      >
        <polyline points="3 6 5 6 21 6" />
        <path
          d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
        />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.message-actions {
  display: flex;
  gap: var(--ui-space-1);
  padding: var(--ui-space-1);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  box-shadow: var(--ui-shadow-md);
}

.message-actions--right {
  flex-direction: row-reverse;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: var(--ui-radius-sm);
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.action-btn:hover {
  background: var(--ui-surface-muted);
  color: var(--ui-text);
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn--danger:hover {
  background: var(--ui-danger-50);
  color: var(--ui-danger-600);
}

/* モバイル対応：タッチターゲットサイズを拡大 */
@media (max-width: 768px) {
  .message-actions {
    gap: var(--ui-space-2);
    padding: var(--ui-space-2);
  }

  .action-btn {
    width: 40px;
    height: 40px;
  }

  .action-btn svg {
    width: 20px;
    height: 20px;
  }
}
</style>
