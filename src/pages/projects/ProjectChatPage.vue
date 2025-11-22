<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { database } from '@/firebase/config'
import {
    addMessageReaction,
    deleteProjectMessage,
    listenProjectChat,
    sendProjectMessage,
    updateProjectMessage,
    type ChatMessage,
} from '@/services/projectChat'
import { createTask, listenTasks, type TaskDoc } from '@/services/taskService'
import { useAuthStore } from '@/store/auth'
import { ref as dbRef, update } from 'firebase/database'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

type ChatChannel = {
  id: string
  name: string
  description?: string
  type: 'general' | 'task'
}

const defaultChannel: ChatChannel = {
  id: 'general',
  name: 'ジェネラル',
  description: '全メンバーと共有するチャネル',
  type: 'general',
}

const route = useRoute()
const { user, profile } = useAuthStore()
const projectId = String(route.params.projectId)
const messages = ref<ChatMessage[]>([])
const input = ref('')
const tasks = ref<TaskDoc[]>([])
const taskMap = computed(() => Object.fromEntries(tasks.value.map((task) => [task.id, task.title])))
const reactionOptions = ['👍', '🎉', '❤️', '🔥', '😄']
const openReactionFor = ref<string | null>(null)
const defaultReaction = '👍'
const chatContainer = ref<HTMLElement | null>(null)
const editingMessageId = ref<string | null>(null)
const editingText = ref('')
const channelSearch = ref('')
const activeChannelId = ref('general')
const notificationsEnabled = ref(true)
const newMessageBanner = ref(false)
const newMessagePreview = ref('新着メッセージがあります')
const unreadChannels = ref<Record<string, boolean>>({})
const seenMessages = ref<Record<string, string>>({})

let unsubscribeTasks: (() => void) | null = null
let unsubscribeChat: (() => void) | null = null

const keyword = computed(() => channelSearch.value.trim().toLowerCase())

const channels = computed<ChatChannel[]>(() => {
  const taskChannels: ChatChannel[] = tasks.value.map((task) => ({
    id: task.id,
    name: task.title || '無題のタスク',
    description: task.description || 'タスクディスカッション',
    type: 'task',
  }))
  return [{ ...defaultChannel }, ...taskChannels]
})

const matchesSearch = (channel: ChatChannel) => {
  if (!keyword.value) return true
  const haystack = `${channel.name} ${channel.id}`.toLowerCase()
  return haystack.includes(keyword.value)
}

const generalChannels = computed(() => channels.value.filter((channel) => channel.type === 'general' && matchesSearch(channel)))
const taskChannels = computed(() => channels.value.filter((channel) => channel.type === 'task' && matchesSearch(channel)))

const currentChannel = computed<ChatChannel>(() => {
  return channels.value.find((channel) => channel.id === activeChannelId.value) || defaultChannel
})

const composerPlaceholder = computed(() => `${currentChannel.value?.name || 'このチャネル'}にメッセージを送信`)

const currentChannelMessages = computed(() =>
  messages.value.filter((message) => (message.channelId || 'general') === currentChannel.value?.id),
)

const lastMessageMeta = computed(() => {
  const map: Record<string, { id: string; senderId?: string; preview: string }> = {}
  messages.value.forEach((message) => {
    const key = message.channelId || 'general'
    map[key] = { id: message.id, senderId: message.senderId, preview: message.text || '' }
  })
  return map
})

function markChannelAsRead(channelId: string) {
  const info = lastMessageMeta.value[channelId]
  if (info) {
    seenMessages.value[channelId] = info.id
  }
  unreadChannels.value[channelId] = false
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

watch(
  channels,
  (list) => {
    if (!list.length) return
    if (!list.find((channel) => channel.id === activeChannelId.value)) {
      const fallback = list[0]
      if (fallback) {
        activeChannelId.value = fallback.id
      }
    }
  },
  { immediate: true },
)

watch(activeChannelId, () => {
  openReactionFor.value = null
  newMessageBanner.value = false
  markChannelAsRead(activeChannelId.value)
  scrollToBottom()
})

watch(
  lastMessageMeta,
  (meta) => {
    Object.entries(meta).forEach(([channelId, info]) => {
      if (!info) return
      const seenId = seenMessages.value[channelId]
      if (seenId === info.id) return
      if (channelId === activeChannelId.value) {
        seenMessages.value[channelId] = info.id
        unreadChannels.value[channelId] = false
        if (notificationsEnabled.value && info.senderId !== user.value?.uid) {
          newMessagePreview.value =
            info.preview.length > 40 ? `${info.preview.slice(0, 38)}…` : info.preview || '新着メッセージがあります'
          newMessageBanner.value = true
        }
        scrollToBottom()
      } else {
        unreadChannels.value[channelId] = true
      }
    })
  },
  { immediate: true },
)

function selectChannel(channelId: string) {
  if (activeChannelId.value === channelId) return
  activeChannelId.value = channelId
}

function toggleNotifications() {
  notificationsEnabled.value = !notificationsEnabled.value
  if (!notificationsEnabled.value) {
    newMessageBanner.value = false
  }
}

function acknowledgeNotification() {
  newMessageBanner.value = false
  markChannelAsRead(activeChannelId.value)
  scrollToBottom()
}

function watchChat() {
  unsubscribeChat = listenProjectChat(projectId, (list) => {
    messages.value = list
  })
}

function watchTasks() {
  unsubscribeTasks = listenTasks(projectId, (list) => {
    tasks.value = list
  })
}

async function sendMessage() {
  if (!input.value.trim() || !user.value) return
  await sendProjectMessage(
    projectId,
    user.value.uid,
    profile.value?.nickname || profile.value?.fullName || 'User',
    input.value.trim(),
    currentChannel.value?.id || 'general',
  )
  input.value = ''
  markChannelAsRead(currentChannel.value?.id || 'general')
  newMessageBanner.value = false
  scrollToBottom()
}

async function convertToTask(messageId: string, text: string) {
  if (!user.value) return
  const taskId = await createTask(projectId, { title: text }, user.value.uid)
  await update(dbRef(database, `projects/${projectId}/realtimeChat/${messageId}`), { linkedTaskId: taskId })
  activeChannelId.value = taskId
}

async function linkTask(messageId: string, taskId: string) {
  await update(dbRef(database, `projects/${projectId}/realtimeChat/${messageId}`), { linkedTaskId: taskId })
}

async function reactToMessage(messageId: string, emoji: string) {
  if (!user.value || !messageId || !emoji) return
  await addMessageReaction(projectId, messageId, emoji, user.value.uid)
}

function toggleReactionPicker(messageId: string) {
  openReactionFor.value = openReactionFor.value === messageId ? null : messageId
}

function startEditing(message: ChatMessage) {
  editingMessageId.value = message.id
  editingText.value = message.text
}

function cancelEditing() {
  editingMessageId.value = null
  editingText.value = ''
}

async function saveEditing() {
  if (!editingMessageId.value || !editingText.value.trim()) return
  await updateProjectMessage(projectId, editingMessageId.value, editingText.value)
  cancelEditing()
}

async function deleteMessage(messageId: string) {
  if (!confirm('このメッセージを削除してもよろしいですか？')) return
  await deleteProjectMessage(projectId, messageId)
}

onMounted(() => {
  watchTasks()
  watchChat()
})

onBeforeUnmount(() => {
  unsubscribeTasks?.()
  unsubscribeChat?.()
})
</script>

<template>
  <div class="chat-layout">
    <aside class="channel-panel">
      <div class="channel-panel__header">
        <div>
          <p class="channel-panel__eyebrow">Team Channels</p>
          <h2>チャットスペース</h2>
          <p class="channel-panel__hint">タスクごとにチャネルを切り替えて議論できます。</p>
        </div>
        <AppButton :to="{ name: ROUTE_NAMES.myTasks }" variant="outline">タスクを管理</AppButton>
      </div>
      <div class="channel-panel__search">
        <input v-model="channelSearch" type="text" placeholder="チャネルを検索" />
      </div>
      <section class="channel-section">
        <p class="channel-section__title">固定チャネル</p>
        <button
          v-for="channel in generalChannels"
          :key="channel.id"
          type="button"
          class="channel-pill"
          :class="{ 'is-active': channel.id === currentChannel?.id }"
          @click="selectChannel(channel.id)"
        >
          <span># {{ channel.name }}</span>
          <span v-if="unreadChannels[channel.id]" class="pill-indicator" aria-label="新着" />
        </button>
      </section>
      <section class="channel-section">
        <p class="channel-section__title">タスクチャンネル</p>
        <p v-if="!taskChannels.length" class="channel-section__empty">
          タスクを作成すると自動的にチャネルが追加されます。
        </p>
        <button
          v-for="channel in taskChannels"
          :key="channel.id"
          type="button"
          class="channel-pill"
          :class="{ 'is-active': channel.id === currentChannel?.id }"
          @click="selectChannel(channel.id)"
        >
          <span># {{ channel.name }}</span>
          <span v-if="unreadChannels[channel.id]" class="pill-indicator" aria-label="新着" />
        </button>
      </section>
    </aside>

    <section class="chat-main">
      <header class="chat-main__header">
        <div>
          <p class="chat-main__eyebrow">#{{ currentChannel?.name }}</p>
          <h1>{{ currentChannel?.name }}</h1>
          <p class="chat-main__description">
            {{ currentChannel?.description || 'このチャネルで素早くディスカッションしましょう。' }}
          </p>
        </div>
        <div class="chat-main__actions">
          <button
            type="button"
            class="notify-toggle"
            :class="{ 'is-active': notificationsEnabled }"
            @click="toggleNotifications"
          >
            <span class="notify-dot" aria-hidden="true" />
            通知 {{ notificationsEnabled ? 'ON' : 'OFF' }}
          </button>
          <AppButton :to="{ name: ROUTE_NAMES.projectDashboard, params: { projectId } }">
            ダッシュボード
          </AppButton>
        </div>
      </header>

      <div v-if="newMessageBanner" class="chat-banner">
        <div>
          <strong>🔔 新着メッセージ</strong>
          <p>{{ newMessagePreview }}</p>
        </div>
        <button type="button" @click="acknowledgeNotification">表示</button>
      </div>

      <div class="chat-thread" ref="chatContainer">
        <p v-if="!currentChannelMessages.length" class="chat-thread__empty">
          まだメッセージがありません。最初のメッセージを送信して会話を始めましょう。
        </p>
        <article
          v-for="message in currentChannelMessages"
          :key="message.id"
          class="chat-card"
        >
          <div class="chat-card__avatar">{{ (message.author || 'U').charAt(0).toUpperCase() }}</div>
          <div class="chat-card__body" @dblclick="reactToMessage(message.id, defaultReaction)">
            
            <!-- Hover Controls -->
            <div class="chat-message__controls">
              <button type="button" class="reaction-button" @click.stop="toggleReactionPicker(message.id)" title="リアクション">
                ☺
              </button>
              
              <div class="chat-card__actions">
                <button type="button" @click="convertToTask(message.id, message.text)" title="タスク化">📋</button>
                <div class="chat-card__link-task-wrapper">
                  <button type="button" title="タスクに紐付け">🔗</button>
                  <select @change="linkTask(message.id, ($event.target as HTMLSelectElement).value)">
                    <option value="">タスクを選択</option>
                    <option v-for="task in tasks" :key="task.id" :value="task.id">{{ task.title }}</option>
                  </select>
                </div>
              </div>

              <div class="chat-card__actions" v-if="user && (message.senderId === user.uid || message.author === (profile?.nickname || profile?.fullName))">
                <button type="button" @click="startEditing(message)" title="編集">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button type="button" @click="deleteMessage(message.id)" title="削除">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>

            <header class="chat-card__header">
              <div class="chat-card__meta">
                <h3>{{ message.author }}</h3>
                <time v-if="message.createdAt">
                  {{ new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                </time>
              </div>
            </header>

            <div v-if="editingMessageId === message.id" class="chat-card__editor">
              <input v-model="editingText" type="text" @keydown.enter="saveEditing" />
              <div>
                <button type="button" @click="saveEditing">保存</button>
                <button type="button" @click="cancelEditing">キャンセル</button>
              </div>
            </div>
            <p v-else class="chat-card__text">{{ message.text }}</p>

            <div v-if="message.reactionSummary?.length" class="chat-card__reactions">
              <button
                v-for="reaction in message.reactionSummary"
                :key="`${message.id}-${reaction.emoji}`"
                type="button"
                @click="reactToMessage(message.id, reaction.emoji)"
              >
                {{ reaction.emoji }} <span>{{ reaction.count }}</span>
              </button>
            </div>

            <div v-if="openReactionFor === message.id" class="chat-card__picker">
              <p>リアクションを選択</p>
              <div class="picker-grid">
                <button
                  v-for="emoji in reactionOptions"
                  :key="`${message.id}-picker-${emoji}`"
                  type="button"
                  @click="reactToMessage(message.id, emoji)"
                >
                  {{ emoji }}
                </button>
              </div>
            </div>
            
            <div v-if="message.linkedTaskId" class="chat-card__linked-task-row">
              <span class="chat-card__linked-task">
                紐付け済み: {{ taskMap[message.linkedTaskId] || message.linkedTaskId }}
              </span>
            </div>
          </div>
        </article>
      </div>

      <form class="composer" @submit.prevent="sendMessage">
        <div class="composer__info">
          <p>#{{ currentChannel?.name }}</p>
          <input v-model="input" type="text" :placeholder="composerPlaceholder" />
        </div>
        <button type="submit">送信</button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.chat-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 300px 1fr;
  background: linear-gradient(135deg, #f7fbfc, #edf4f6);
}

.channel-panel {
  background: #0b2e33;
  color: #e9f4f7;
  padding: 2rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.channel-panel__header h2 {
  margin: 0.3rem 0;
}

.channel-panel__eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.75rem;
  opacity: 0.7;
}

.channel-panel__hint {
  margin: 0.35rem 0 0;
  color: rgba(233, 244, 247, 0.75);
}

.channel-panel__search input {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.65rem 0.9rem;
  background: rgba(255, 255, 255, 0.08);
  color: #f5fbfc;
}

.channel-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.channel-section__title {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: rgba(233, 244, 247, 0.6);
}

.channel-section__empty {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(233, 244, 247, 0.7);
}

.channel-pill {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.55rem 0.9rem;
  border-radius: 0.85rem;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.channel-pill:hover {
  background: rgba(255, 255, 255, 0.12);
}

.channel-pill.is-active {
  border-color: rgba(184, 227, 233, 0.8);
  background: rgba(184, 227, 233, 0.25);
  color: #0b2e33;
  font-weight: 600;
}

.pill-indicator {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #ffba08;
}

.chat-main {
  display: flex;
  flex-direction: column;
  padding: 2rem clamp(1rem, 4vw, 4rem);
  gap: 1rem;
}

.chat-main__header {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.25rem 1.5rem;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 1rem;
  border: 1px solid #e2edef;
  box-shadow: 0 18px 26px rgba(11, 46, 51, 0.08);
}

.chat-main__eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #6d8a92;
}

.chat-main__description {
  margin: 0.35rem 0 0;
  color: #6d8a92;
}

.chat-main__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.notify-toggle {
  border: 1px solid #d7e2ef;
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  background: #fff;
  color: #0b2e33;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.notify-toggle.is-active {
  background: rgba(184, 227, 233, 0.4);
  border-color: #4f7c82;
}

.notify-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #4f7c82;
}

.chat-banner {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid #ffd5a4;
  background: #fff7ed;
  border-radius: 0.9rem;
  padding: 0.75rem 1rem;
  color: #8c3b04;
  align-items: center;
}

.chat-banner button {
  border: none;
  background: #ffba08;
  color: #0b2e33;
  padding: 0.45rem 0.9rem;
  border-radius: 0.75rem;
  cursor: pointer;
  font-weight: 600;
}

.chat-thread {
  flex: 1;
  border: 1px solid #e2edef;
  border-radius: 1rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.9);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: inset 0 0 0 1px rgba(230, 242, 244, 0.6);
}

.chat-thread__empty {
  margin: 0;
  color: #6d8a92;
  text-align: center;
}

.chat-card {
  display: flex;
  gap: 0.85rem;
  position: relative;
}

.chat-card:hover .chat-message__controls {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.chat-card__avatar {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #4f7c82;
  color: #ffffff;
  font-weight: 700;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.chat-card__body {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  border: 1px solid #e2edef;
  box-shadow: 0 2px 8px rgba(11, 46, 51, 0.06);
  transition: all 0.2s ease;
  position: relative;
}

.chat-card__body:hover {
  box-shadow: 0 4px 12px rgba(11, 46, 51, 0.1);
}

.chat-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.chat-card__meta {
  display: flex;
  gap: 0.6rem;
  align-items: baseline;
}

.chat-card__meta h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #0b2e33;
}

.chat-card__meta time {
  font-size: 0.78rem;
  color: #6d8a92;
}

.chat-message__controls {
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

.chat-card__actions {
  display: flex;
  gap: 0.25rem;
  border-left: 1px solid #e2edef;
  padding-left: 0.25rem;
  margin-left: 0.25rem;
}

.chat-card__actions button,
.reaction-button {
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
  padding: 0;
}

.chat-card__actions button:hover,
.reaction-button:hover {
  background: #f0f7f8;
  color: #0b2e33;
}

.chat-card__editor {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat-card__editor input {
  border: 1px solid #d7e2ef;
  border-radius: 8px;
  padding: 0.6rem;
  width: 100%;
  font-size: 0.9rem;
  background: #f7fbfc;
}

.chat-card__editor > div {
  display: flex;
  gap: 0.5rem;
}

.chat-card__editor button {
  border: none;
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chat-card__editor button:first-child {
  background: #4f7c82;
  color: #ffffff;
  font-weight: 600;
}

.chat-card__editor button:first-child:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(79, 124, 130, 0.25);
}

.chat-card__editor button:last-child {
  background: #f7fbfc;
  color: #6d8a92;
  border: 1px solid #d7e2ef;
}

.chat-card__text {
  margin: 0.35rem 0 0;
  line-height: 1.55;
  color: #0b2e33;
}

.chat-card__link-task-wrapper {
  position: relative;
  width: 28px;
  height: 28px;
}

.chat-card__link-task-wrapper select {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.chat-card__linked-task-row {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #54757c;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chat-card__linked-task {
  background: #f0f7f8;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  border: 1px solid #e2edef;
}

.chat-card__reactions {
  margin-top: 0.65rem;
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.chat-card__reactions button {
  border: 1px solid #d7e2ef;
  background: rgba(184, 227, 233, 0.35);
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
  cursor: pointer;
  color: #0b2e33;
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  font-weight: 600;
  font-size: 0.8rem;
  transition: all 0.15s ease;
}

.chat-card__reactions button:hover {
  background: rgba(184, 227, 233, 0.5);
  transform: translateY(-1px);
}

.chat-card__picker {
  margin-top: 0.5rem;
  background: rgba(184, 227, 233, 0.2);
  border: 1px solid #d7e2ef;
  border-radius: 12px;
  padding: 0.65rem;
  box-shadow: 0 12px 22px rgba(11, 46, 51, 0.12);
}

.chat-card__picker p {
  margin: 0 0 0.35rem;
  color: #4f6b73;
  font-size: 0.85rem;
}

.picker-grid {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.picker-grid button {
  border: 1px solid #d7e2ef;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.picker-grid button:hover {
  background: #fff;
  transform: scale(1.1);
}

.composer {
  border-top: 1px solid #e2edef;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.composer__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.composer__info p {
  margin: 0;
  font-size: 0.85rem;
  color: #6d8a92;
  font-weight: 600;
}

.composer__info input {
  border: 1px solid #d7e2ef;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  background: #f7fbfc;
  transition: all 0.2s ease;
}

.composer__info input:focus {
  outline: none;
  border-color: #4f7c82;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(79, 124, 130, 0.1);
}

.composer button[type='submit'] {
  border: none;
  border-radius: 12px;
  padding: 0.75rem 1.5rem;
  background: #4f7c82;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.composer button[type='submit']:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(79, 124, 130, 0.3);
}

.composer button[type='submit']:active {
  transform: translateY(0);
}

@media (max-width: 1024px) {
  .chat-layout {
    grid-template-columns: 240px 1fr;
  }
}

@media (max-width: 768px) {
  .chat-layout {
    grid-template-columns: 1fr;
  }

  .channel-panel {
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .chat-main__header {
    flex-direction: column;
  }

  .composer {
    flex-direction: column;
  }
}
</style>
