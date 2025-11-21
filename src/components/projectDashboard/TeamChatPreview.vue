<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

export interface PreviewChatMessage {
  id?: string
  author: string
  time: string
  message: string
  type?: 'update'
  reactions?: { emoji: string; count: number }[]
  senderId?: string
}

const props = withDefaults(
  defineProps<{
    messages?: PreviewChatMessage[]
    onlineCount?: number
    showComposer?: boolean
    loading?: boolean
    allowReactions?: boolean
    reactionOptions?: string[]
    currentUserId?: string
    currentUserName?: string
  }>(),
  {
    allowReactions: true,
    reactionOptions: () => ['👍', '🎉', '❤️', '🔥', '😄'],
  },
)

const emit = defineEmits<{
  (e: 'send', value: string): void
  (e: 'react', value: { messageId: string; emoji: string }): void
  (e: 'update', value: { messageId: string; text: string }): void
  (e: 'delete', value: string): void
}>()

const input = ref('')
const onlineMembers = computed(() => props.onlineCount ?? 0)
const conversation = computed(() => props.messages ?? [])
const openReactionFor = ref<string | null>(null)
const defaultReaction = '👍'
const chatContainer = ref<HTMLElement | null>(null)
const editingMessageId = ref<string | null>(null)
const editingText = ref('')

const getInitial = (name?: string) => {
  if (!name) return '?'
  return name.trim().charAt(0).toUpperCase()
}

function handleSend() {
  if (!input.value.trim()) return
  emit('send', input.value.trim())
  input.value = ''
  scrollToBottom()
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

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

function startEditing(message: PreviewChatMessage) {
  if (!message.id) return
  editingMessageId.value = message.id
  editingText.value = message.message
}

function cancelEditing() {
  editingMessageId.value = null
  editingText.value = ''
}

function saveEditing() {
  if (!editingMessageId.value || !editingText.value.trim()) return
  emit('update', { messageId: editingMessageId.value, text: editingText.value })
  cancelEditing()
}

function deleteMessage(messageId: string | undefined) {
  if (!messageId) return
  if (!confirm('このメッセージを削除してもよろしいですか？')) return
  emit('delete', messageId)
}

watch(
  () => props.messages,
  () => {
    scrollToBottom()
  },
  { deep: true },
)
</script>

<template>
  <section class="chat">
    <header class="chat__header">
      <div class="chat__title">
        <p class="chat__eyebrow">Team Feed</p>
        <h2>チームチャット</h2>
        <p class="chat__presence">
          <span class="chat__presence-dot" aria-hidden="true" /> {{ onlineMembers }}人がオンライン
        </p>
      </div>
      <div class="chat__badges">
        <span class="chip">Live</span>
        <span class="chip chip--muted">ダブルクリックでリアクションを追加できます</span>
      </div>
    </header>

    <div class="chat__body" role="log" aria-live="polite">
      <p v-if="props.loading" class="chat__empty">読み込み中...</p>
      <p v-else-if="!conversation.length" class="chat__empty">
        まだメッセージがありません。最初のメッセージを送信しましょう。
      </p>
      <ul v-else class="chat__timeline" ref="chatContainer">
        <li
          v-for="message in conversation"
          :key="message.id || `${message.time}-${message.author}-${message.message}`"
          class="chat__message"
        >
          <div class="chat__avatar" aria-hidden="true">{{ getInitial(message.author) }}</div>
          <div class="chat__bubble" @dblclick="handleReact(message.id, defaultReaction)">
            <div class="chat__meta">
              <div class="chat__meta-primary">
                <span class="chat__author">{{ message.author }}</span>
                <time class="chat__time">{{ message.time }}</time>
              </div>
            </div>

            <div v-if="editingMessageId === message.id" class="chat__editor">
              <input v-model="editingText" type="text" @keydown.enter="saveEditing" />
              <div class="chat__editor-actions">
                <button type="button" @click="saveEditing">保存</button>
                <button type="button" @click="cancelEditing">キャンセル</button>
              </div>
            </div>
            <p v-else class="chat__text">{{ message.message }}</p>

            <div class="chat__actions">
              <button
                v-if="props.allowReactions && message.id"
                type="button"
                class="chat__reaction-trigger"
                @click="toggleReactionPicker(message.id)"
                title="リアクションを追加"
              >
                ☺
              </button>
              <div
                v-if="props.currentUserId && (message.senderId === props.currentUserId || message.author === props.currentUserName)"
                class="chat__owner-actions"
              >
                <button type="button" @click="startEditing(message)" title="編集">✎</button>
                <button type="button" @click="deleteMessage(message.id)" title="削除">🗑</button>
              </div>
            </div>

            <div v-if="message.reactions?.length" class="chat__reaction-row">
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
              <p>リアクションを選択</p>
              <div class="chat__reaction-grid">
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
          </div>
        </li>
      </ul>
    </div>

    <footer v-if="props.showComposer !== false" class="chat__composer">
      <div class="chat__input-wrap">
        <input
          v-model="input"
          type="text"
          placeholder="Slackのように、ここからすばやく送信できます"
          @keydown.enter.prevent="handleSend"
        />
        <small>Enter で送信 / ダブルクリックで 👍</small>
      </div>
      <button type="button" class="chat__send" @click="handleSend">送信</button>
    </footer>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  border-radius: 1rem;
  border: 1px solid #e2edef;
  background: linear-gradient(135deg, #f7fbfc, #edf4f6);
  box-shadow: 0 16px 24px rgba(11, 46, 51, 0.08);
  overflow: hidden;
  color: #0b2e33;
}

.chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.86);
  border-bottom: 1px solid #e2edef;
}

.chat__title h2 {
  margin: 0.25rem 0 0;
  font-size: 1.1rem;
  letter-spacing: 0.01em;
}

.chat__eyebrow {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.7;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chat__presence {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: #54757c;
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.chat__presence-dot {
  width: 8px;
  height: 8px;
  background: #31c48d;
  border-radius: 50%;
  box-shadow: 0 0 0 6px rgba(49, 196, 141, 0.16);
}

.chat__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: #e9f4f7;
  border: 1px solid #d7e2ef;
  font-size: 0.8rem;
}

.chip--muted {
  background: #f5fafc;
  color: #6d8a92;
}

.chat__body {
  flex: 1;
  padding: 1rem 1.25rem 1.25rem;
  background: radial-gradient(circle at 10% 20%, rgba(147, 177, 181, 0.16), transparent 35%),
    radial-gradient(circle at 82% 12%, rgba(79, 124, 130, 0.12), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.15));
}

.chat__empty {
  margin: 0;
  color: #6d8a92;
}

.chat__timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  max-height: 320px;
  overflow-y: auto;
}

.chat__message {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.chat__avatar {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(160deg, #b8e3e9, #4f7c82);
  color: #0b2e33;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.chat__bubble {
  flex: 1;
  background: #ffffff;
  border: 1px solid #d7e2ef;
  color: #0b2e33;
  border-radius: 0 12px 12px 12px;
  padding: 0.75rem 1rem;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  position: relative;
}

.chat__message:hover .chat__actions {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.chat__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.chat__meta-primary {
  display: inline-flex;
  gap: 0.5rem;
  align-items: baseline;
}

.chat__actions {
  position: absolute;
  top: -12px;
  right: 10px;
  background: #ffffff;
  border: 1px solid #e2edef;
  border-radius: 8px;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: all 0.2s ease;
  z-index: 10;
}

.chat__reaction-trigger,
.chat__owner-actions button {
  border: none;
  background: transparent;
  color: #54757c;
  border-radius: 4px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chat__reaction-trigger:hover,
.chat__owner-actions button:hover {
  background: #f0f7f8;
  color: #0b2e33;
}

.chat__owner-actions {
  display: flex;
  gap: 0.25rem;
  border-left: 1px solid #e2edef;
  padding-left: 0.25rem;
  margin-left: 0.25rem;
}

.chat__editor {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat__editor input {
  border: 1px solid #d7e2ef;
  border-radius: 8px;
  padding: 0.6rem;
  width: 100%;
  font-size: 0.9rem;
  background: #f7fbfc;
}

.chat__editor-actions {
  display: flex;
  gap: 0.5rem;
}

.chat__editor-actions button {
  border: none;
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chat__editor-actions button:first-child {
  background: linear-gradient(135deg, #4f7c82, #9acfd7);
  color: #0b2e33;
  font-weight: 600;
}

.chat__editor-actions button:first-child:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(79, 124, 130, 0.25);
}

.chat__editor-actions button:last-child {
  background: #f7fbfc;
  color: #6d8a92;
  border: 1px solid #d7e2ef;
}

.chat__author {
  font-weight: 700;
  color: #0b2e33;
}

.chat__time {
  font-size: 0.78rem;
  color: #6d8a92;
}

.chat__text {
  margin: 0.35rem 0 0;
  line-height: 1.55;
}

.chat__reaction-row {
  margin-top: 0.65rem;
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.chat__reaction-chip {
  border: 1px solid #d7e2ef;
  background: rgba(184, 227, 233, 0.35);
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  color: #0b2e33;
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  font-weight: 600;
}

.chat__reaction-trigger {
  border: 1px dashed #c3d6db;
  background: rgba(184, 227, 233, 0.22);
  color: #4f7c82;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chat__reaction-trigger:hover {
  background: rgba(184, 227, 233, 0.35);
  color: #0b2e33;
}

.chat__reaction-picker {
  margin-top: 0.5rem;
  background: rgba(184, 227, 233, 0.2);
  border: 1px solid #d7e2ef;
  border-radius: 12px;
  padding: 0.65rem;
  box-shadow: 0 12px 22px rgba(11, 46, 51, 0.12);
}

.chat__reaction-picker p {
  margin: 0 0 0.35rem;
  color: #4f6b73;
  font-size: 0.85rem;
}

.chat__reaction-grid {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.chat__reaction-picker button {
  border: 1px solid #d7e2ef;
  background: #ffffff;
  border-radius: 8px;
  padding: 0.4rem 0.55rem;
  cursor: pointer;
  color: #0b2e33;
  transition: transform 0.12s ease, background 0.12s ease;
}

.chat__reaction-picker button:hover {
  background: #f0f7f8;
  transform: translateY(-1px);
}

.chat__composer {
  display: flex;
  gap: 0.75rem;
  padding: 0.9rem 1.25rem 1.1rem;
  align-items: center;
  background: #f7fbfc;
  border-top: 1px solid #e2edef;
}

.chat__input-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat__composer input {
  flex: 1;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  border: 1px solid #d7e2ef;
  background: #ffffff;
  color: #0b2e33;
  font-size: 0.95rem;
  outline: none;
}

.chat__input-wrap small {
  margin-top: 0.3rem;
  color: #6d8a92;
}

.chat__composer input::placeholder {
  color: #93aeb6;
}

.chat__send {
  background: linear-gradient(135deg, #4f7c82, #9acfd7);
  border: none;
  color: #0b2e33;
  padding: 0.85rem 1.2rem;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chat__send:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(79, 124, 130, 0.35);
}

.chat__send:active {
  transform: translateY(0);
}

@media (max-width: 640px) {
  .chat__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .chat__badges {
    width: 100%;
  }

  .chat__composer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
