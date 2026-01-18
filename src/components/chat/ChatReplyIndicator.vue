<script setup lang="ts">
/**
 * ChatReplyIndicator - 返信先表示
 *
 * Composer上部に表示される返信先メッセージのプレビュー
 * Xボタンで返信をキャンセル可能
 */

defineProps<{
  /** 返信先の送信者名 */
  senderName: string;
  /** 返信先のメッセージテキスト */
  messageText: string;
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "click"): void;
}>();
</script>

<template>
  <div class="reply-indicator">
    <button type="button" class="reply-content" @click="emit('click')">
      <svg
        class="reply-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="14"
        height="14"
      >
        <polyline points="9 17 4 12 9 7" />
        <path d="M20 18v-2a4 4 0 00-4-4H4" />
      </svg>
      <span class="reply-sender">{{ senderName }}</span>
      <span class="reply-text">{{ messageText }}</span>
    </button>
    <button
      type="button"
      class="cancel-btn"
      title="返信をキャンセル"
      aria-label="返信をキャンセル"
      @click="emit('cancel')"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="16"
        height="16"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.reply-indicator {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-3);
  background: var(--ui-brand-50);
  border-left: 3px solid var(--ui-brand-500);
  border-radius: 0 var(--ui-radius-md) var(--ui-radius-md) 0;
}

.reply-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: inherit;
}

.reply-content:hover {
  text-decoration: underline;
  text-decoration-color: var(--ui-text-muted);
}

.reply-icon {
  flex-shrink: 0;
  color: var(--ui-brand-600);
}

.reply-sender {
  flex-shrink: 0;
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-strong);
}

.reply-text {
  flex: 1;
  min-width: 0;
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: var(--ui-radius-sm);
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.cancel-btn:hover {
  background: var(--ui-brand-100);
  color: var(--ui-text);
}
</style>
