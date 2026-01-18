<script setup lang="ts">
/**
 * ChatEmojiPicker - 絵文字パレット
 *
 * よく使う絵文字をクリックして選択できるシンプルなピッカー
 */

defineProps<{
  /** ピッカーを表示するか */
  visible?: boolean;
}>();

const emit = defineEmits<{
  (e: "select", emoji: string): void;
  (e: "close"): void;
}>();

const reactionPalette = ["👍", "🎉", "🔥", "❤️", "💡", "👀", "😄", "🙏"];

function handleSelect(emoji: string) {
  emit("select", emoji);
  emit("close");
}

function handleBackdropClick() {
  emit("close");
}
</script>

<template>
  <Transition name="emoji-picker">
    <div
      v-if="visible"
      class="emoji-picker-backdrop"
      @click="handleBackdropClick"
    >
      <div class="emoji-picker" @click.stop>
        <button
          v-for="emoji in reactionPalette"
          :key="emoji"
          type="button"
          class="emoji-btn"
          :title="emoji"
          @click="handleSelect(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.emoji-picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--ui-z-modal, 1000);
}

.emoji-picker {
  position: absolute;
  display: flex;
  gap: var(--ui-space-1);
  padding: var(--ui-space-2);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-shadow-lg);
  z-index: var(--ui-z-modal, 1000);
}

.emoji-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  font-size: var(--ui-text-lg);
  transition: var(--ui-transition-all);
}

.emoji-btn:hover {
  background: var(--ui-surface-muted);
  transform: scale(1.15);
}

.emoji-btn:active {
  transform: scale(0.95);
}

/* Transition */
.emoji-picker-enter-active,
.emoji-picker-leave-active {
  transition: opacity var(--ui-duration-fast) var(--ui-ease-standard);
}

.emoji-picker-enter-active .emoji-picker,
.emoji-picker-leave-active .emoji-picker {
  transition:
    transform var(--ui-duration-fast) var(--ui-ease-standard),
    opacity var(--ui-duration-fast) var(--ui-ease-standard);
}

.emoji-picker-enter-from,
.emoji-picker-leave-to {
  opacity: 0;
}

.emoji-picker-enter-from .emoji-picker,
.emoji-picker-leave-to .emoji-picker {
  transform: scale(0.9);
  opacity: 0;
}
</style>
