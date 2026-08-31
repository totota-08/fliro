<script setup lang="ts">
/**
 * ChatMessageItem - チャットメッセージ1件の表示
 *
 * ホバー時にアクションバーを表示
 * リアクション、返信、編集、コピー、削除に対応
 */
import { formatTimeShort as formatTime } from "@/utils/datetime";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import UserAvatar from "@/components/common/UserAvatar.vue";
import ChatMessageActions from "./ChatMessageActions.vue";
import ChatEmojiPicker from "./ChatEmojiPicker.vue";
import type { ChatMessage, ReactionDetail } from "@/services/projectChat";

const props = defineProps<{
  message: ChatMessage;
  /** 現在ログイン中のユーザーID */
  currentUserId?: string | null;
  /** 現在のユーザーがOwner/Adminか */
  isAdmin?: boolean;
  /** 返信先メッセージのテキスト（このメッセージが返信の場合） */
  replyToText?: string;
  /** 返信先メッセージの送信者名 */
  replyToSender?: string;
}>();

const emit = defineEmits<{
  (e: "react", payload: { messageId: string; emoji: string }): void;
  (e: "reply", messageId: string): void;
  (e: "edit", messageId: string): void;
  (e: "copy", text: string): void;
  (e: "delete", messageId: string): void;
  (e: "scroll-to-reply", messageId: string): void;
}>();

const isHovered = ref(false);
const isTapped = ref(false);
const showEmojiPicker = ref(false);
const emojiPickerPosition = ref({ top: 0, left: 0 });
const actionBarRef = ref<HTMLElement | null>(null);
const messageItemRef = ref<HTMLElement | null>(null);

// アクションバー表示状態（ホバーまたはタップ）
const showActions = computed(() => isHovered.value || isTapped.value);

// モバイル判定
const isMobile = ref(false);

function checkMobile() {
  isMobile.value = window.innerWidth <= 768;
}

// タップでアクションバーを表示
function handleTap(event: Event) {
  if (!isMobile.value) return;

  // リアクションチップや返信インジケータをタップした場合は無視
  const target = event.target as HTMLElement;
  if (
    target.closest(".reaction-chip") ||
    target.closest(".reply-indicator") ||
    target.closest(".actions-wrapper")
  ) {
    return;
  }

  isTapped.value = !isTapped.value;
}

// 外側タップで閉じる
function handleOutsideClick(event: MouseEvent) {
  if (!isTapped.value) return;
  if (
    messageItemRef.value &&
    !messageItemRef.value.contains(event.target as Node)
  ) {
    isTapped.value = false;
    showEmojiPicker.value = false;
  }
}

onMounted(() => {
  checkMobile();
  window.addEventListener("resize", checkMobile);
  document.addEventListener("click", handleOutsideClick);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", checkMobile);
  document.removeEventListener("click", handleOutsideClick);
});

// 自分のメッセージか
const isOwnMessage = computed(() => {
  if (!props.currentUserId || !props.message.senderId) return false;
  return props.message.senderId === props.currentUserId;
});

// 編集可能か（自分のメッセージのみ）
const canEdit = computed(() => isOwnMessage.value);

// 削除可能か（自分のメッセージまたはOwner/Admin）
const canDelete = computed(() => isOwnMessage.value || props.isAdmin);

// メッセージテキストのフォーマット（HTML変換）
function formatMessage(text: string): string {
  if (!text) return "";
  // 1. HTMLエスケープ
  let formatted = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Markdownリンク [Text](URL) をパース
  formatted = formatted.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>',
  );

  // 3. 改行を <br> に変換
  formatted = formatted.replace(/\n/g, "<br>");

  return formatted;
}

// 自分がリアクションしているか
function hasReacted(reaction: ReactionDetail): boolean {
  if (!props.currentUserId) return false;
  return reaction.userIds.includes(props.currentUserId);
}

// アクション: リアクション追加
function handleReact() {
  if (!actionBarRef.value) return;
  const rect = actionBarRef.value.getBoundingClientRect();
  emojiPickerPosition.value = {
    top: rect.bottom + 4,
    left: rect.left,
  };
  showEmojiPicker.value = true;
}

function handleEmojiSelect(emoji: string) {
  emit("react", { messageId: props.message.id, emoji });
  showEmojiPicker.value = false;
}

// アクション: 既存リアクションをクリック
function handleReactionClick(emoji: string) {
  emit("react", { messageId: props.message.id, emoji });
}

// アクション: 返信
function handleReply() {
  emit("reply", props.message.id);
}

// アクション: 編集
function handleEdit() {
  emit("edit", props.message.id);
}

// アクション: コピー
async function handleCopy() {
  try {
    await navigator.clipboard.writeText(props.message.text);
    emit("copy", props.message.text);
  } catch {
    // フォールバック
    const textarea = document.createElement("textarea");
    textarea.value = props.message.text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    emit("copy", props.message.text);
  }
}

// アクション: 削除
function handleDelete() {
  emit("delete", props.message.id);
}

// 返信元へスクロール
function handleScrollToReply() {
  if (props.message.replyToId) {
    emit("scroll-to-reply", props.message.replyToId);
  }
}
</script>

<template>
  <div
    ref="messageItemRef"
    class="message-item"
    :class="{
      'is-bot': message.isBot,
      'is-hovered': isHovered,
      'is-tapped': isTapped,
      'is-own': isOwnMessage,
    }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="handleTap"
  >
    <!-- 返信先表示 -->
    <button
      v-if="message.replyToId && (replyToText || replyToSender)"
      type="button"
      class="reply-indicator"
      @click="handleScrollToReply"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="12"
        height="12"
      >
        <polyline points="9 17 4 12 9 7" />
        <path d="M20 18v-2a4 4 0 00-4-4H4" />
      </svg>
      <span class="reply-indicator__sender">{{ replyToSender }}</span>
      <span class="reply-indicator__text">{{ replyToText }}</span>
    </button>

    <div class="message-row">
      <!-- アバター -->
      <UserAvatar
        v-if="!message.isBot"
        :url="null"
        :name="message.senderName || 'ゲスト'"
        class="message-avatar"
      />
      <div v-else class="bot-avatar">🤖</div>

      <!-- メッセージ本文 -->
      <div class="message-content">
        <div class="message-meta">
          <span class="sender">{{ message.senderName }}</span>
          <span class="time">{{ formatTime(message.createdAt) }}</span>
        </div>
        <div class="message-text" v-html="formatMessage(message.text)"></div>

        <!-- リアクション表示 -->
        <div v-if="message.reactionDetails?.length" class="reactions">
          <button
            v-for="reaction in message.reactionDetails"
            :key="reaction.emoji"
            type="button"
            class="reaction-chip"
            :class="{ 'is-reacted': hasReacted(reaction) }"
            :title="`${reaction.userIds.length}人がリアクション`"
            @click="handleReactionClick(reaction.emoji)"
          >
            <span class="reaction-emoji">{{ reaction.emoji }}</span>
            <span class="reaction-count">{{ reaction.count }}</span>
          </button>
        </div>
      </div>

      <!-- アクションバー（ホバー時/タップ時） -->
      <Transition name="actions-fade">
        <div v-if="showActions" ref="actionBarRef" class="actions-wrapper">
          <ChatMessageActions
            :can-edit="canEdit"
            :can-delete="canDelete"
            @react="handleReact"
            @reply="handleReply"
            @edit="handleEdit"
            @copy="handleCopy"
            @delete="handleDelete"
          />
        </div>
      </Transition>
    </div>

    <!-- 絵文字ピッカー -->
    <Teleport to="body">
      <ChatEmojiPicker
        :visible="showEmojiPicker"
        :style="{
          '--picker-top': `${emojiPickerPosition.top}px`,
          '--picker-left': `${emojiPickerPosition.left}px`,
        }"
        @select="handleEmojiSelect"
        @close="showEmojiPicker = false"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.message-item {
  position: relative;
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-radius-md);
  transition: background-color var(--ui-duration-fast) var(--ui-ease-standard);
}

.message-item.is-hovered {
  background: var(--ui-surface-muted);
}

.message-item.is-bot {
  background: var(--ui-surface-muted);
  border: 1px solid var(--ui-border-light);
}

.message-row {
  display: flex;
  gap: var(--ui-space-3);
  align-items: flex-start;
}

.message-avatar {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.bot-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ui-success-50);
  display: grid;
  place-items: center;
  font-size: var(--ui-text-xl);
  border: 1px solid var(--ui-success-200);
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-meta {
  display: flex;
  gap: var(--ui-space-2);
  align-items: baseline;
  margin-bottom: 2px;
}

.sender {
  font-weight: var(--ui-font-bold);
  font-size: var(--ui-text-sm);
  color: var(--ui-text-strong);
}

.time {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-subtle);
}

.message-text {
  font-size: var(--ui-text-base);
  line-height: var(--ui-leading-relaxed);
  color: var(--ui-text);
  white-space: pre-wrap;
  word-break: break-word;
}

/* Linkスタイル */
.message-text :deep(.chat-link) {
  color: var(--ui-info, #0284c7);
  text-decoration: underline;
}

.message-text :deep(.chat-link:hover) {
  color: var(--ui-brand-600, #4f7c82);
}

/* リアクション */
.reactions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-1);
  margin-top: var(--ui-space-2);
}

.reaction-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  padding: 2px var(--ui-space-2);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  background: var(--ui-surface);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.reaction-chip:hover {
  background: var(--ui-surface-muted);
  border-color: var(--ui-border-light);
}

.reaction-chip.is-reacted {
  background: var(--ui-brand-50);
  border-color: var(--ui-brand-300);
}

.reaction-emoji {
  font-size: var(--ui-text-sm);
}

.reaction-count {
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-muted);
}

.reaction-chip.is-reacted .reaction-count {
  color: var(--ui-brand-700);
}

/* 返信先表示 */
.reply-indicator {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin-left: 48px;
  margin-bottom: var(--ui-space-1);
  padding: var(--ui-space-1) var(--ui-space-2);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--ui-text-muted);
  font-size: var(--ui-text-xs);
  text-align: left;
  transition: var(--ui-transition-colors);
}

.reply-indicator:hover {
  color: var(--ui-text);
  background: var(--ui-surface-muted);
  border-radius: var(--ui-radius-sm);
}

.reply-indicator svg {
  flex-shrink: 0;
  color: var(--ui-text-subtle);
}

.reply-indicator__sender {
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text);
}

.reply-indicator__text {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* アクションバー */
.actions-wrapper {
  position: absolute;
  top: 0;
  right: var(--ui-space-3);
  transform: translateY(-50%);
}

/* アクションのフェードイン */
.actions-fade-enter-active,
.actions-fade-leave-active {
  transition:
    opacity var(--ui-duration-fast) var(--ui-ease-standard),
    transform var(--ui-duration-fast) var(--ui-ease-standard);
}

.actions-fade-enter-from,
.actions-fade-leave-to {
  opacity: 0;
  transform: translateY(-50%) scale(0.95);
}

/* レスポンシブ */
@media (max-width: 768px) {
  .message-avatar {
    width: 32px;
    height: 32px;
  }

  .bot-avatar {
    width: 32px;
    height: 32px;
    font-size: var(--ui-text-lg);
  }

  .reply-indicator {
    margin-left: 44px;
  }

  .message-item {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .message-item.is-tapped {
    background: var(--ui-surface-muted);
  }

  /* モバイルではホバー表示しない（タップのみ） */
  .message-item.is-hovered:not(.is-tapped) .actions-wrapper {
    display: none;
  }

  .actions-wrapper {
    top: auto;
    bottom: 0;
    transform: translateY(50%);
  }
}

/* prefers-reduced-motion: アニメーションとトランジションを無効化 */
@media (prefers-reduced-motion: reduce) {
  .message-item {
    transition: none;
  }

  .reaction-chip {
    transition: none;
  }

  .reply-indicator {
    transition: none;
  }

  .actions-fade-enter-active,
  .actions-fade-leave-active {
    transition: none;
  }
}
</style>

<style>
/* 絵文字ピッカーの位置（グローバル） */
.emoji-picker {
  top: var(--picker-top, 0);
  left: var(--picker-left, 0);
}
</style>
