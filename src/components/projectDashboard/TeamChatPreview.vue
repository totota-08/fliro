<script setup lang="ts">
import { computed, ref } from 'vue'

export interface PreviewChatMessage {
  id?: string
  author: string
  time: string
  message: string
  type?: 'update'
  reactions?: { emoji: string; count: number }[]
}

const props = withDefaults(
  defineProps<{
    messages?: PreviewChatMessage[]
    onlineCount?: number
    showComposer?: boolean
    loading?: boolean
    allowReactions?: boolean
    reactionOptions?: string[]
  }>(),
  {
    allowReactions: true,
    reactionOptions: () => ['👍', '🎉', '❤️', '🔥', '😄'],
  },
)

const emit = defineEmits<{
  (e: 'send', value: string): void
  (e: 'react', value: { messageId: string; emoji: string }): void
}>()

const input = ref('')
const onlineMembers = computed(() => props.onlineCount ?? 0)
const conversation = computed(() => props.messages ?? [])
const openReactionFor = ref<string | null>(null)
const defaultReaction = '👍'

const getInitial = (name?: string) => {
  if (!name) return '?'
  return name.trim().charAt(0).toUpperCase()
}

function handleSend() {
  if (!input.value.trim()) return
  emit('send', input.value.trim())
  input.value = ''
}

function handleReact(messageId: string | undefined, emoji: string) {
  if (!messageId || !emoji) return
  emit('react', { messageId, emoji })
  if (openReactionFor.value === messageId) {
    openReactionFor.value = null
  }
}

function toggleReactionPicker(messageId: string | undefined) {
  if (!messageId) return
  openReactionFor.value = openReactionFor.value === messageId ? null : messageId
}
</script>

<template>
  <section class="chat">
    <header class="chat__header">
      <div>
        <h2>チームチャット</h2>
        <p>{{ onlineMembers }}人がオンライン</p>
      </div>
    </header>

    <div class="chat__body" role="log" aria-live="polite">
      <p v-if="props.loading" class="chat__empty">読み込み中...</p>
      <p v-else-if="!conversation.length" class="chat__empty">
        まだメッセージがありません。最初のメッセージを送信しましょう。
      </p>
      <ul v-else class="chat__messages">
        <li
          v-for="message in conversation"
          :key="message.id || `${message.time}-${message.author}-${message.message}`"
          class="chat__item"
        >
          <div class="chat__avatar" aria-hidden="true">{{ getInitial(message.author) }}</div>
          <div
            class="chat__bubble"
            @dblclick="handleReact(message.id, defaultReaction)"
          >
            <header class="chat__bubble-header">
              <div>
                <span class="chat__author">{{ message.author }}</span>
                <time>{{ message.time }}</time>
              </div>
              <button
                v-if="props.allowReactions && message.id"
                type="button"
                class="chat__reaction-button"
                @click="toggleReactionPicker(message.id)"
              >
                ＋
              </button>
            </header>
            <p>{{ message.message }}</p>
            <div v-if="message.reactions?.length" class="chat__reaction-summary">
              <button
                v-for="reaction in message.reactions"
                :key="`${message.id}-${reaction.emoji}`"
                type="button"
                class="chat__reaction-chip"
                @click="handleReact(message.id, reaction.emoji)"
              >
                {{ reaction.emoji }} <span>{{ reaction.count }}</span>
              </button>
            </div>
            <div
              v-if="props.allowReactions && message.id && openReactionFor === message.id"
              class="chat__reaction-picker"
            >
              <button
                v-for="emoji in props.reactionOptions"
                :key="`${message.id}-picker-${emoji}`"
                type="button"
                @click="handleReact(message.id, emoji)"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <footer v-if="props.showComposer !== false" class="chat__footer">
      <input
        v-model="input"
        type="text"
        placeholder="メッセージを入力..."
        @keydown.enter.prevent="handleSend"
      />
      <button type="button" @click="handleSend">送信</button>
    </footer>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  border-radius: 1.5rem;
  border: 1px solid var(--border-light);
  background: var(--surface-elevated);
  box-shadow: 0 18px 28px rgba(11, 46, 51, 0.12);
  overflow: hidden;
}

.chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(11, 46, 51, 0.08);
}

.chat__header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-strong);
}

.chat__header p {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.chat__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1rem 1.5rem;
  gap: 0.75rem;
}

.chat__empty {
  margin: 0;
  color: var(--text-muted);
}

.chat__messages {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 320px;
  overflow-y: auto;
}

.chat__item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  align-items: flex-start;
}

.chat__avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.22);
  color: var(--primary-strong);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
}

.chat__bubble {
  padding: 0.85rem 1rem;
  border-radius: 1.25rem;
  background: rgba(184, 227, 233, 0.28);
  box-shadow: 0 8px 18px rgba(11, 46, 51, 0.08);
}

.chat__bubble-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: var(--text-muted);
  gap: 0.75rem;
}

.chat__reaction-summary {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.35rem;
}

.chat__reaction-chip {
  border: none;
  border-radius: 999px;
  background: rgba(11, 46, 51, 0.08);
  color: var(--text-strong);
  padding: 0.2rem 0.55rem;
  font-size: 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
}

.chat__reaction-chip span {
  font-weight: 600;
}

.chat__reaction-picker {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-top: 0.35rem;
}

.chat__reaction-picker button {
  border: none;
  background: rgba(11, 46, 51, 0.05);
  border-radius: 0.65rem;
  padding: 0.15rem 0.45rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.chat__reaction-button {
  border: none;
  background: rgba(11, 46, 51, 0.08);
  border-radius: 0.6rem;
  color: var(--primary-strong);
  font-size: 0.9rem;
  width: 1.8rem;
  height: 1.8rem;
  cursor: pointer;
}

.chat__author {
  font-weight: 600;
  color: var(--text-strong);
}

.chat__bubble p {
  margin: 0;
  color: var(--text);
  line-height: 1.6;
}

.chat__footer {
  margin-top: auto;
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.5rem;
  border-top: 1px solid rgba(11, 46, 51, 0.08);
  background: rgba(184, 227, 233, 0.18);
}

.chat__footer input {
  flex: 1;
  border-radius: 0.75rem;
  border: 1px solid rgba(79, 124, 130, 0.3);
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  background: #fff;
}

.chat__footer button {
  border-radius: 0.75rem;
  border: none;
  padding: 0.75rem 1rem;
  background: var(--primary);
  color: var(--surface-elevated);
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 768px) {
  .chat__footer {
    flex-direction: column;
  }
  .chat__footer button {
    width: 100%;
  }
}
</style>
