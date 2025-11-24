<script setup lang="ts">
import SidebarUserProfile from '@/components/common/SidebarUserProfile.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import CommandDropdown from '@/components/projects/CommandDropdown.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { database } from '@/firebase/config'
import { fetchProject } from '@/firebase/projectService'
import {
  addMessageReaction,
  deleteProjectMessage,
  listenProjectChat,
  sendProjectMessage,
  updateProjectMessage,
  type ChatMessage,
} from '@/services/projectChat'
import { listenProjectMembers, type ProjectMember } from '@/services/projectMembers'
import { createTask, listenTasks, type TaskDoc } from '@/services/taskService'
import { useAuthStore } from '@/store/auth'
import type { ProjectDoc } from '@/types/project'
import { useUserDisplay } from '@/composables/useUserDisplay'
import { ref as dbRef, update } from 'firebase/database'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

type ChatChannel = {
  id: string
  name: string
  description?: string
  type: 'general' | 'task'
  assigneeId?: string
  status?: string
}

const defaultChannel: ChatChannel = {
  id: 'general',
  name: 'general',
  description: '全メンバーと共有するチャネル',
  type: 'general',
}

const route = useRoute()
const { user, profile } = useAuthStore()
const projectId = String(route.params.projectId)
const messages = ref<ChatMessage[]>([])
const input = ref('')
const createTaskOnSend = ref(false)
const selectedTaskId = ref('')
const tasks = ref<TaskDoc[]>([])
const project = ref<ProjectDoc | null>(null)
const projectMembers = ref<ProjectMember[]>([])
const { getDisplayName } = useUserDisplay(projectMembers)
const taskMap = computed(() => Object.fromEntries(tasks.value.map((task) => [task.id, task.title])))
const reactionOptions = ['👍', '🎉', '❤️', '🔥', '😄']
const openReactionFor = ref<string | null>(null)
const defaultReaction = '👍'
const chatContainer = ref<HTMLElement | null>(null)
const composerInputEl = ref<HTMLInputElement | null>(null)
const editingMessageId = ref<string | null>(null)
const editingText = ref('')
const channelSearch = ref('')
const filterAssigneeId = ref('')
const activeChannelId = ref('general')
const notificationsEnabled = ref(true)
const newMessageBanner = ref(false)
const newMessagePreview = ref('新着メッセージがあります')
const unreadChannels = ref<Record<string, boolean>>({})
const seenMessages = ref<Record<string, string>>({})
const replyingTo = ref<ChatMessage | null>(null)
const mentionQuery = ref('')
const mentionDropdownOpen = ref(false)
const mentionCaret = ref(0)
const slashQuery = ref('')
const slashDropdownOpen = ref(false)
const messageSearch = ref('')
const availableCommands = [
  {
    key: '/newTask',
    label: '/newTask/"タイトル","担当者","説明"',
    description: 'タスク名・担当者・説明をまとめて入力',
    insert: '/newTask/"タスク名","担当者","説明"',
  },
  { key: '/private', label: '/private @user メッセージ', description: '指定ユーザーにのみ送信', insert: '/private @' },
  { key: '/ping', label: '/ping', description: 'Botがpongと返信' },
  { key: '/time', label: '/time', description: '現在時刻を返信' },
  { key: '/news', label: '/news', description: '最新ニュースを返信' },
]

let unsubscribeTasks: (() => void) | null = null
let unsubscribeChat: (() => void) | null = null
let unsubscribeMembers: (() => void) | null = null

const keyword = computed(() => channelSearch.value.trim().toLowerCase())

const channels = computed<ChatChannel[]>(() => {
  const taskChannels: ChatChannel[] = tasks.value.map((task) => ({
    id: task.id,
    name: task.title || '無題のタスク',
    description: task.description || 'タスクディスカッション',
    type: 'task',
    assigneeId: task.assigneeId,
    status: task.status,
  }))
  return [{ ...defaultChannel }, ...taskChannels]
})

const filteredTaskChannels = computed(() => {
  return channels.value.filter((channel) => {
    if (channel.type !== 'task') return false
    
    // Search filter
    if (keyword.value) {
      const haystack = `${channel.name} ${channel.id}`.toLowerCase()
      if (!haystack.includes(keyword.value)) return false
    }

    // Assignee filter
    if (filterAssigneeId.value) {
      if (channel.assigneeId !== filterAssigneeId.value) return false
    }

    return true
  })
})

const currentChannel = computed<ChatChannel>(() => {
  return channels.value.find((channel) => channel.id === activeChannelId.value) || defaultChannel
})

const composerPlaceholder = computed(() => `${currentChannel.value?.name || 'このチャネル'}にメッセージを送信`)

const currentChannelMessages = computed(() =>
  messages.value.filter((message) => (message.channelId || 'general') === currentChannel.value?.id),
)

const visibleChannelMessages = computed(() =>
  currentChannelMessages.value.filter((msg) => {
    if (msg.privateFor && msg.privateFor !== user.value?.uid && msg.senderId !== user.value?.uid) return false
    const q = messageSearch.value.trim().toLowerCase()
    if (!q) return true
    const haystack = `${msg.text || ''} ${displayNameFor(msg)}`.toLowerCase()
    return haystack.includes(q)
  }),
)

const threadedMessages = computed(() => {
  const all = visibleChannelMessages.value
  const map = new Map<string, ChatMessage & { replies: ChatMessage[] }>()
  const roots: (ChatMessage & { replies: ChatMessage[] })[] = []

  // Initialize map
  all.forEach((msg) => {
    map.set(msg.id, { ...msg, replies: [] })
  })

  // Build tree
  all.forEach((msg) => {
    const node = map.get(msg.id)!
    if (msg.replyToId && map.has(msg.replyToId)) {
      map.get(msg.replyToId)!.replies.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
})



const memberMap = computed(() => {
  const map = new Map<string, ProjectMember>()
  projectMembers.value.forEach((member) => {
    map.set(member.userId, member)
  })
  return map
})

const mentionCandidates = computed(() => {
  const q = mentionQuery.value.trim().toLowerCase()
  return projectMembers.value
    .map((member) => ({
      id: member.userId,
      name: member.nickname || member.fullName || member.displayName || member.userId,
    }))
    .filter((entry) => (q ? entry.name.toLowerCase().includes(q) : true))
})

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
  replyingTo.value = null
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

function watchMembers() {
  unsubscribeMembers = listenProjectMembers(projectId, (list) => {
    projectMembers.value = list
  })
}

function memberNameById(id?: string | null) {
  if (!id) return ''
  const member = projectMembers.value.find((m) => m.userId === id)
  return member?.nickname || member?.fullName || member?.displayName || getDisplayName(id) || ''
}

function extractMentions(text: string) {
  const matches = text.match(/@([^\s@]+)/g) || []
  return matches
    .map((tag) => tag.replace('@', ''))
    .map((name) => {
      const member = projectMembers.value.find(
        (m) => (m.nickname || m.fullName || m.displayName || '').toLowerCase() === name.toLowerCase(),
      )
      return { name, userId: member?.userId }
    })
}

function displayNameFor(message: { senderId?: string | null; author?: string | null }) {
  const author = message.author || ''
  if (author && author !== message.senderId && author.toLowerCase() !== 'unknown') return author
  if (message.senderId) {
    const name = getDisplayName(message.senderId)
    if (name) return name
  }
  return author || 'User'
}

function handleComposerInput(event: Event) {
  const target = event.target as HTMLInputElement
  mentionCaret.value = target.selectionStart ?? input.value.length
  const uptoCaret = input.value.slice(0, mentionCaret.value)
  const match = uptoCaret.match(/@([^\s@]{0,20})$/)
  if (match) {
    mentionQuery.value = match[1]
    mentionDropdownOpen.value = true
  } else {
    mentionDropdownOpen.value = false
    mentionQuery.value = ''
  }

  const slashMatch = uptoCaret.match(/\/([^\s/]{0,20})$/)
  if (slashMatch) {
    slashQuery.value = slashMatch[1]
    slashDropdownOpen.value = true
  } else {
    slashDropdownOpen.value = false
    slashQuery.value = ''
  }
}

function insertMention(candidate: { id: string; name: string }) {
  const start = mentionCaret.value
  const textBefore = input.value.slice(0, start)
  const match = textBefore.match(/@([^\s@]{0,20})$/)
  const prefixLen = match ? match[0].length : 0
  const insertPos = start - prefixLen
  input.value = `${input.value.slice(0, insertPos)}@${candidate.name} ${input.value.slice(start)}`
  mentionDropdownOpen.value = false
  nextTick(() => {
    const el = composerInputEl.value
    if (el) {
      const cursor = insertPos + candidate.name.length + 2
      el.focus()
      el.setSelectionRange(cursor, cursor)
    }
  })
}

const commandCandidates = computed(() =>
  availableCommands.filter((cmd) =>
    slashQuery.value ? cmd.key.toLowerCase().includes(slashQuery.value.toLowerCase()) : true,
  ),
)

function insertCommand(cmd: { key: string }) {
  const start = mentionCaret.value
  const textBefore = input.value.slice(0, start)
  const match = textBefore.match(/\/([^\s/]{0,20})$/)
  const prefixLen = match ? match[0].length : 0
  const insertPos = start - prefixLen
  const insertText = cmd.insert || `${cmd.key} `
  input.value = `${input.value.slice(0, insertPos)}${insertText}${input.value.slice(start)}`
  slashDropdownOpen.value = false
  nextTick(() => {
    const el = composerInputEl.value
    if (el) {
      const cursor = insertPos + insertText.length
      el.focus()
      el.setSelectionRange(cursor, cursor)
    }
  })
}

function resetComposer() {
  input.value = ''
  replyingTo.value = null
  createTaskOnSend.value = false
  selectedTaskId.value = ''
  mentionDropdownOpen.value = false
  mentionQuery.value = ''
  slashDropdownOpen.value = false
  slashQuery.value = ''
  openReactionFor.value = null
}

async function sendBotMessage(text: string, options?: { privateFor?: string | null }) {
  await sendProjectMessage(
    projectId,
    'bot',
    'Teamie Bot',
    text,
    currentChannel.value?.id || 'general',
    undefined,
    { isBot: true, privateFor: options?.privateFor ?? null },
  )
}

async function handleSlashCommand(text: string, mentions: { name: string; userId?: string | null }[]) {
  const lower = text.toLowerCase()
  if (lower.startsWith('/ping')) {
    await sendBotMessage('pong')
    return true
  }
  if (lower.startsWith('/private')) {
    const match = text.match(/\/private\s+@?([^\s]+)\s+(.+)/i)
    if (!match) {
      await sendBotMessage('private コマンドの形式: /private @ユーザー 本文', { privateFor: user.value?.uid || null })
      return true
    }
    const targetName = match[1]
    const body = match[2]?.trim()
    const targetUser = projectMembers.value.find(
      (m) => (m.nickname || m.fullName || m.displayName || '').toLowerCase() === targetName.toLowerCase(),
    )
    if (!targetUser) {
      await sendBotMessage(`${targetName} さんが見つかりません`, { privateFor: user.value?.uid || null })
      return true
    }
    if (!body) {
      await sendBotMessage('メッセージを入力してください', { privateFor: user.value?.uid || null })
      return true
    }
    await sendProjectMessage(
      projectId,
      user.value!.uid,
      profile.value?.nickname || profile.value?.fullName || 'User',
      body,
      currentChannel.value?.id || 'general',
      undefined,
      { privateFor: targetUser.userId, mentions: [targetUser.userId] },
    )
    await sendBotMessage(`${targetName} さんへのプライベートメッセージを送信しました`, {
      privateFor: user.value?.uid || null,
    })
    return true
  }
  if (lower.startsWith('/time')) {
    await sendBotMessage(new Date().toLocaleString())
    return true
  }
  if (lower.startsWith('/news')) {
    try {
      const res = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page')
      const data = await res.json()
      const items = (data?.hits || []).slice(0, 3).map((hit: any, idx: number) => `${idx + 1}. ${hit?.title}`)
      await sendBotMessage(items.length ? `今日のニュース\n${items.join('\n')}` : 'ニュースを取得できませんでした')
    } catch (error) {
      await sendBotMessage('ニュースの取得に失敗しました')
    }
    return true
  }
  if (lower.startsWith('/newtask')) {
    const match = text.match(/\/newTask\/"([^"]*)","([^"]*)","([^"]*)"/i)
    const title = match?.[1]?.trim() || ''
    const assigneeName = match?.[2]?.trim() || ''
    const description = match?.[3]?.trim() || ''
    if (!title) {
      await sendBotMessage('newTask コマンドが正しくありません。タスク名を入力してください。', {
        privateFor: user.value?.uid || null,
      })
      return true
    }
    const assignee = mentions.find((m) => m.userId)?.userId || null
    const explicitAssignee =
      assigneeName &&
      projectMembers.value.find(
        (m) => (m.nickname || m.fullName || m.displayName || '').toLowerCase() === assigneeName.toLowerCase(),
      )?.userId
    const finalAssignee = explicitAssignee || assignee || null
    const taskId = await createTask(
      projectId,
      {
        title,
        description: description || undefined,
        assigneeId: finalAssignee,
        assigneeName: finalAssignee ? memberNameById(finalAssignee) : null,
      },
      user.value!.uid,
    )
    await sendProjectMessage(
      projectId,
      user.value!.uid,
      profile.value?.nickname || profile.value?.fullName || 'User',
      title,
      currentChannel.value?.id || 'general',
      undefined,
      { linkedTaskId: taskId, mentions: mentions.map((m) => m.userId || m.name), isTask: true },
    )
    await sendBotMessage(
      `${profile.value?.nickname || profile.value?.fullName || 'ユーザー'}さんが${
        finalAssignee ? memberNameById(finalAssignee) || '担当者未設定' : '担当者未設定'
      }にタスクを割り当てました`,
    )
    return true
  }
  return false
}

async function sendMessage() {
  if (!input.value.trim() || !user.value) return
  const text = input.value.trim()
  const mentions = extractMentions(text)

  if (text.startsWith('/')) {
    const handled = await handleSlashCommand(text, mentions)
    if (handled) {
      resetComposer()
      return
    }
  }

  let linkedTaskId: string | null = null
  if (createTaskOnSend.value) {
    const assignee = mentions.find((m) => m.userId)?.userId || null
    linkedTaskId = await createTask(
      projectId,
      {
        title: text,
        assigneeId: assignee,
        assigneeName: assignee ? memberNameById(assignee) : null,
      },
      user.value.uid,
    )
  } else if (selectedTaskId.value) {
    linkedTaskId = selectedTaskId.value
  }

  await sendProjectMessage(
    projectId,
    user.value.uid,
    profile.value?.nickname || profile.value?.fullName || 'User',
    text,
    currentChannel.value?.id || 'general',
    replyingTo.value?.id,
    {
      linkedTaskId: linkedTaskId || undefined,
      mentions: mentions.map((m) => m.userId || m.name),
      isTask: createTaskOnSend.value || Boolean(linkedTaskId),
    },
  )
  if (linkedTaskId) {
    activeChannelId.value = linkedTaskId
  }
  resetComposer()
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

function startReplying(message: ChatMessage) {
  replyingTo.value = message
  const inputEl = document.getElementById('messageInput')
  if (inputEl) inputEl.focus()
}

function cancelReplying() {
  replyingTo.value = null
}

// New helper functions for UI revamp
function detectMessageType(text: string): 'important' | 'question' | 'announcement' | 'success' | 'normal' {
  const lowerText = text.toLowerCase()
  if (lowerText.includes('重要') || lowerText.includes('緊急') || lowerText.includes('注意')) {
    return 'important'
  }
  if (lowerText.includes('?') || lowerText.includes('？') || lowerText.includes('質問') || lowerText.includes('教えて')) {
    return 'question'
  }
  if (lowerText.includes('お知らせ') || lowerText.includes('告知') || lowerText.includes('開催')) {
    return 'announcement'
  }
  if (lowerText.includes('完了') || lowerText.includes('成功') || lowerText.includes('✅')) {
    return 'success'
  }
  return 'normal'
}

function getMessageTypeLabel(type: string) {
  const labels: Record<string, { text: string; class: string }> = {
    important: { text: '重要', class: 'badge-important' },
    question: { text: '質問', class: 'badge-question' },
    announcement: { text: '告知', class: 'badge-announcement' },
  }
  return labels[type] || null
}

onMounted(async () => {
  watchTasks()
  watchChat()
  watchMembers()
  if (projectId) {
      project.value = await fetchProject(projectId)
  }
})

onBeforeUnmount(() => {
  unsubscribeTasks?.()
  unsubscribeChat?.()
  unsubscribeMembers?.()
})
</script>

<template>
  <div class="app-container">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="workspace-header">
        <router-link :to="{ name: ROUTE_NAMES.projectDashboard, params: { projectId } }" class="back-link">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </router-link>
        <div class="workspace-name">{{ project?.name || 'プロジェクト' }}</div>
      </div>
      
      <div class="channels-section">
        <div class="section-title">チャンネル</div>
        <div 
          class="channel-item" 
          :class="{ active: activeChannelId === 'general' }"
          @click="selectChannel('general')"
        >
          <span class="channel-icon">#</span>
          <span>general</span>
          <span v-if="unreadChannels['general']" class="channel-badge"></span>
        </div>

        <div class="section-title" style="margin-top: 2rem;">タスク</div>
        <div class="search-box">
          <input v-model="channelSearch" type="text" placeholder="タスクを検索..." />
        </div>
        
        <div 
          v-for="channel in filteredTaskChannels" 
          :key="channel.id"
          class="channel-item"
          :class="{ active: channel.id === currentChannel?.id }"
          @click="selectChannel(channel.id)"
        >
          <span class="channel-icon">●</span>
          <span>{{ channel.name }}</span>
          <span v-if="unreadChannels[channel.id]" class="channel-badge"></span>
        </div>
        <p v-if="!filteredTaskChannels.length" class="empty-text">タスクが見つかりません</p>
      </div>

      <SidebarUserProfile />
    </aside>

    <!-- Main Chat -->
    <main class="main-chat">
      <header class="chat-header">
        <div class="channel-title">
          <span>#</span>
          <span class="channel-name" :title="currentChannel?.name">{{ currentChannel?.name }}</span>
        </div>
        <div class="channel-search">
          <input
            v-model="messageSearch"
            type="search"
            placeholder="このチャンネル内を検索"
          />
        </div>
      </header>

      <div class="messages-container" ref="chatContainer">
        <div v-if="!threadedMessages.length" class="empty-state">
          <p>まだメッセージがありません。会話を始めましょう！</p>
        </div>

        <div v-for="message in threadedMessages" :key="message.id" class="message-group">
          <div 
            class="message" 
            :class="[detectMessageType(message.text), { bot: message.isBot }]"
            @dblclick="reactToMessage(message.id, defaultReaction)"
          >
            <div class="message-header">
              <UserAvatar 
                :src="memberMap.get(message.senderId || '')?.avatarUrl" 
                :name="displayNameFor(message)" 
                :size="40" 
                class="message-avatar"
              />
              <div class="message-info">
                <span class="username">{{ displayNameFor(message) }}</span>
                <span class="timestamp" v-if="message.createdAt">
                  {{ new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                </span>
                <span v-if="message.isBot" class="bot-label">🤖 Bot</span>
                <span v-if="message.linkedTaskId || message.isTask" class="message-badge badge-task">タスク</span>
                <span 
                  v-if="getMessageTypeLabel(detectMessageType(message.text))" 
                  class="message-badge"
                  :class="getMessageTypeLabel(detectMessageType(message.text))?.class"
                >
                  {{ getMessageTypeLabel(detectMessageType(message.text))?.text }}
                </span>
              </div>
            </div>

            <div v-if="editingMessageId === message.id" class="editor-area">
              <input v-model="editingText" type="text" @keydown.enter="saveEditing" class="editor-input" />
              <div class="editor-actions">
                <button @click="saveEditing" class="save-btn">保存</button>
                <button @click="cancelEditing" class="cancel-btn">キャンセル</button>
              </div>
            </div>
            <div v-else class="message-text">{{ message.text }}</div>

            <div v-if="message.reactionSummary?.length" class="reactions">
              <div 
                v-for="reaction in message.reactionSummary" 
                :key="`${message.id}-${reaction.emoji}`"
                class="reaction"
                @click="reactToMessage(message.id, reaction.emoji)"
              >
                <span>{{ reaction.emoji }}</span>
                <span class="reaction-count">{{ reaction.count }}</span>
              </div>
            </div>

            <!-- Hover Actions -->
            <div class="message-actions">
              <button class="action-btn" @click.stop="toggleReactionPicker(message.id)" title="リアクション">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
              </button>
              <button class="action-btn" @click="startReplying(message)" title="返信">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              </button>
              <button class="action-btn" @click="convertToTask(message.id, message.text)" title="タスク化">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              </button>
              
              <div class="link-task-wrapper">
                <button class="action-btn" title="タスクに紐付け">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                </button>
                <select @change="linkTask(message.id, ($event.target as HTMLSelectElement).value)" class="link-task-select">
                  <option value="">タスクを選択</option>
                  <option v-for="task in tasks" :key="task.id" :value="task.id">{{ task.title }}</option>
                </select>
              </div>

              <template v-if="user && (message.senderId === user.uid || message.author === (profile?.nickname || profile?.fullName))">
                <button class="action-btn" @click="startEditing(message)" title="編集">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="action-btn" @click="deleteMessage(message.id)" title="削除">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </template>
            </div>

            <!-- Reaction Picker -->
            <div v-if="openReactionFor === message.id" class="reaction-picker-popover">
              <button
                v-for="emoji in reactionOptions"
                :key="`${message.id}-picker-${emoji}`"
                @click="reactToMessage(message.id, emoji)"
                class="picker-emoji"
              >
                {{ emoji }}
              </button>
            </div>

            <!-- Linked Task Info -->
            <div v-if="message.linkedTaskId" class="linked-task-info">
              <span class="linked-icon">🔗</span>
              <span>紐付け: {{ taskMap[message.linkedTaskId] || message.linkedTaskId }}</span>
            </div>
          </div>

          <!-- Thread Replies -->
          <div v-if="message.replies && message.replies.length > 0" class="thread-container">
            <div class="thread-line"></div>
            <div v-for="reply in message.replies" :key="reply.id" class="thread-reply">
              <div class="message-header">
                <UserAvatar 
                  :src="memberMap.get(reply.senderId || '')?.avatarUrl" 
                  :name="reply.author" 
                  :size="32" 
                  class="reply-avatar"
                />
                <div class="message-info">
                  <span class="username">{{ displayNameFor(reply) }}</span>
                  <span class="timestamp" v-if="reply.createdAt">
                    {{ new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                  </span>
                </div>
              </div>
              <div class="message-text">{{ reply.text }}</div>
              
              <div class="message-actions">
                <button class="action-btn" @click.stop="toggleReactionPicker(reply.id)" title="リアクション">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                </button>
                <button class="action-btn" @click="startReplying(message)" title="返信">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                </button>
                <template v-if="user && (reply.senderId === user.uid || reply.author === (profile?.nickname || profile?.fullName))">
                  <button class="action-btn" @click="deleteMessage(reply.id)" title="削除">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </template>
              </div>
              
              <div v-if="openReactionFor === reply.id" class="reaction-picker-popover">
                <button
                  v-for="emoji in reactionOptions"
                  :key="`${reply.id}-picker-${emoji}`"
                  @click="reactToMessage(reply.id, emoji)"
                  class="picker-emoji"
                >
                  {{ emoji }}
                </button>
              </div>
              
              <div v-if="reply.reactionSummary?.length" class="reactions">
                <div 
                  v-for="reaction in reply.reactionSummary" 
                  :key="`${reply.id}-${reaction.emoji}`"
                  class="reaction"
                  @click="reactToMessage(reply.id, reaction.emoji)"
                >
                  <span>{{ reaction.emoji }}</span>
                  <span class="reaction-count">{{ reaction.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        <div class="input-area">
          <div v-if="replyingTo" class="reply-banner">
            <span>返信中: <strong>{{ displayNameFor(replyingTo) }}</strong></span>
            <button @click="cancelReplying" class="cancel-reply-btn">✕</button>
          </div>
        <div class="composer-options">
          <label class="option">
            <input v-model="createTaskOnSend" type="checkbox" />
            <span>このメッセージをタスク化</span>
          </label>
          <label class="option">
            <span>既存タスクに紐付け</span>
            <select v-model="selectedTaskId">
              <option value="">なし</option>
              <option v-for="task in tasks" :key="task.id" :value="task.id">{{ task.title }}</option>
            </select>
          </label>
        </div>
        <CommandDropdown
          :open="slashDropdownOpen"
          :commands="commandCandidates"
          @select="insertCommand"
        />
        <div class="input-wrapper">
          <input 
            v-model="input" 
            type="text" 
            id="messageInput" 
            :placeholder="composerPlaceholder"
            ref="composerInputEl"
            @keydown.enter="sendMessage"
            @input="handleComposerInput"
            @keyup="handleComposerInput"
          >
          <button class="send-btn" type="button" @click="sendMessage">→</button>
        </div>
        <div v-if="mentionDropdownOpen && mentionCandidates.length" class="mention-dropdown">
          <button
            v-for="candidate in mentionCandidates"
            :key="candidate.id"
            type="button"
            @click="insertMention(candidate)"
          >
            @{{ candidate.name }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  display: flex;
  height: 100vh;
  background: #f8fafc;
  color: #1e293b;
  font-family: 'Segoe UI', system-ui, sans-serif;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 240px;
  background: #0b2e33;
  display: flex;
  flex-direction: column;
  padding: 20px 0;
}

.workspace-header {
  padding: 0 20px 20px 20px;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.back-link {
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.back-link:hover {
  color: #ffffff;
}

.workspace-name {
  font-size: 20px;
  font-weight: 700;
}

.channels-section {
  flex: 1;
  overflow-y: auto;
}

.channels-section::-webkit-scrollbar {
  width: 6px;
}

.channels-section::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.section-title {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 12px 0;
  padding: 0 20px;
  font-weight: 600;
}

.search-box {
  padding: 0 20px 12px;
}

.search-box input {
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
  color: #ffffff;
  font-size: 13px;
}

.search-box input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.channel-item {
  padding: 8px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  border-left: 3px solid transparent;
  position: relative;
}

.channel-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.channel-item.active {
  background: rgba(184, 227, 233, 0.15);
  color: #ffffff;
  border-left-color: #b8e3e9;
  font-weight: 600;
}

.channel-icon {
  font-size: 12px;
  opacity: 0.7;
}

.channel-badge {
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  margin-left: auto;
}

.empty-text {
  padding: 0 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  text-align: center;
}


/* Main Chat */
.main-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}

.chat-header {
  height: 60px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  padding: 0 25px;
  background: #ffffff;
  gap: 1rem;
}

.channel-title {
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #0b2e33;
}

.channel-name {
  max-width: 240px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Messages */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 25px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.channel-search {
  margin: 0 0 12px 0;
}

.channel-search input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.messages-container::-webkit-scrollbar {
  width: 8px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
}

.message-group {
  margin-bottom: 4px;
}

.message {
  padding: 8px 48px 8px 20px;
  margin-bottom: 2px;
  position: relative;
  cursor: pointer;
  background: transparent;
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
}

.message.important {
  border-left-color: #dc2626;
  background: rgba(220, 38, 38, 0.05);
}

.message.question {
  border-left-color: #0b2e33;
  background: rgba(184, 227, 233, 0.22);
}

.message.announcement {
  border-left-color: #0b2e33;
  background: rgba(184, 227, 233, 0.15);
}

.message.success {
  border-left-color: #16a34a;
  background: rgba(22, 163, 74, 0.05);
}

.message.bot {
  border-left-color: #6b7280;
  background: rgba(148, 163, 184, 0.12);
}

.message:hover {
  background: rgba(11, 46, 51, 0.05);
}

.message:hover .message-actions {
  opacity: 1;
  transform: translateY(0);
}

.message-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.message-info {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.bot-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(11, 46, 51, 0.12);
  color: #0b2e33;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.username {
  font-weight: 600;
  font-size: 15px;
  color: #0f172a;
}

.timestamp {
  font-size: 12px;
  color: #64748b;
}

.message-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-important {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.badge-question {
  background: rgba(11, 46, 51, 0.1);
  color: #0b2e33;
}

.badge-announcement {
  background: rgba(11, 46, 51, 0.1);
  color: #0b2e33;
}

.badge-task {
  background: rgba(79, 124, 130, 0.15);
  color: #0b2e33;
}

.message-text {
  font-size: 15px;
  line-height: 1.6;
  color: #334155;
  word-wrap: break-word;
}

.message-actions {
  position: absolute;
  top: -12px;
  right: 20px;
  background: #ffffff;
  border-radius: 8px;
  padding: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transform: translateY(-5px);
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  z-index: 10;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(11, 46, 51, 0.1);
  transform: scale(1.1);
}

.link-task-wrapper {
  position: relative;
  width: 32px;
  height: 32px;
}

.link-task-select {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

/* Thread */
.thread-container {
  margin-top: 2px;
  margin-bottom: 4px;
  position: relative;
  padding-left: 30px;
}

.thread-line {
  position: absolute;
  left: 20px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, 
    rgba(11, 46, 51, 0.3) 0%, 
    rgba(11, 46, 51, 0.15) 50%,
    rgba(11, 46, 51, 0) 100%);
}

.thread-reply {
  padding: 6px 16px 6px 20px;
  margin-bottom: 2px;
  background: transparent;
  border-left: 3px solid rgba(11, 46, 51, 0.3);
  transition: all 0.2s ease;
  position: relative;
}

.thread-reply:hover {
  background: rgba(184, 227, 233, 0.15);
  border-left-color: rgba(11, 46, 51, 0.5);
}

.thread-reply:hover .message-actions {
  opacity: 1;
  transform: translateY(0);
}

.thread-reply .message-text {
  font-size: 14px;
}

/* Reactions */
.reactions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.reaction {
  padding: 4px 10px;
  background: rgba(11, 46, 51, 0.05);
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid transparent;
}

.reaction:hover {
  background: rgba(11, 46, 51, 0.1);
  border-color: rgba(11, 46, 51, 0.2);
  transform: scale(1.05);
}

.reaction-count {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.reaction-picker-popover {
  position: absolute;
  bottom: 100%;
  left: 0;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  gap: 4px;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.picker-emoji {
  background: transparent;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.picker-emoji:hover {
  background: rgba(11, 46, 51, 0.1);
}

/* Editor */
.editor-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.editor-input {
  width: 100%;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #334155;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 15px;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.save-btn,
.cancel-btn {
  padding: 6px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.save-btn {
  background: #0b2e33;
  color: #fff;
}

.cancel-btn {
  background: transparent;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

/* Linked Task */
.linked-task-info {
  margin-top: 8px;
  font-size: 13px;
  color: #0b2e33;
  background: rgba(184, 227, 233, 0.3);
  padding: 6px 12px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Input Area */
.input-area {
  padding: 20px 25px;
  border-top: 1px solid #e2e8f0;
  background: #ffffff;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.composer-options {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
  align-items: center;
  color: #0b2e33;
  font-weight: 600;
}

.composer-options .option {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  flex-shrink: 0;
}

.composer-options .option span {
  white-space: nowrap;
}

.composer-options select {
  border-radius: 0.65rem;
  border: 1px solid #d1dae8;
  padding: 0.35rem 0.55rem;
  background: #fff;
  width: 200px;
  max-width: 300px;
}

.reply-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(11, 46, 51, 0.1);
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #0b2e33;
}

.cancel-reply-btn {
  background: transparent;
  border: none;
  color: #0b2e33;
  cursor: pointer;
  font-weight: bold;
  font-size: 16px;
  padding: 0 4px;
}

.input-wrapper {
  background: #f8fafc;
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 2px solid #e2e8f0;
  transition: all 0.3s ease;
}

.input-wrapper:focus-within {
  border-color: #0b2e33;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(184, 227, 233, 0.22);
}

.input-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 20px;
  transition: all 0.2s ease;
}

.input-btn:hover {
  background: rgba(11, 46, 51, 0.1);
}

#messageInput {
  flex: 1;
  background: none;
  border: none;
  color: #0f172a;
  font-size: 15px;
  outline: none;
}

#messageInput::placeholder {
  color: #94a3b8;
}

.send-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #0b2e33;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-btn:hover {
  transform: scale(1.05);
  background: #134e4a;
  box-shadow: 0 4px 12px rgba(11, 46, 51, 0.3);
}

.send-btn:active {
  transform: scale(0.95);
}

.mention-dropdown {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  padding: 0.5rem 0;
}

.mention-dropdown button {
  border: 1px solid #d1dae8;
  background: #f8fafc;
  border-radius: 0.75rem;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
  font-weight: 600;
  color: #0b2e33;
}

.mention-dropdown button:hover {
  background: rgba(11, 46, 51, 0.08);
}

.command-dropdown {
  display: grid;
  gap: 0.35rem;
  padding: 0.5rem 0;
  margin-bottom: 0.35rem;
}

.command-dropdown button {
  border: 1px solid #d1dae8;
  background: #fff;
  border-radius: 0.85rem;
  padding: 0.5rem 0.65rem;
  cursor: pointer;
  text-align: left;
  display: grid;
  gap: 0.1rem;
}

.command-dropdown strong {
  color: #0b2e33;
}

.command-dropdown span {
  color: #64748b;
  font-size: 0.85rem;
}
</style>
