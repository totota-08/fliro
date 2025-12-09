<script setup lang="ts">
import UserAvatar from '@/components/common/UserAvatar.vue'
import DashboardSidebar from '@/components/projectDashboard/DashboardSidebar.vue'
import CommandDropdown from '@/components/projects/CommandDropdown.vue'
import { useSlashCommands } from '@/composables/useSlashCommands'
import { useUserDisplay } from '@/composables/useUserDisplay'
import { appName } from '@/constants/appMeta'
import { ROUTE_NAMES } from '@/constants/routes'
import { database, db } from '@/firebase/config'
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
import type { DashboardNavItem } from '@/types/projectDashboard'
import { getLogger } from '@logtape/logtape'
import { ref as dbRef, onValue, remove, set, update } from 'firebase/database'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const logger = getLogger('app.pages.projects.ProjectChat')

type ChatChannel = {
  id: string
  name: string
  description?: string
  type: 'general' | 'task' | 'custom'
  assigneeId?: string
  status?: string
  isPublic?: boolean
  allowedUserIds?: string[]
  createdBy?: string | null
}

const defaultChannel: ChatChannel = {
  id: 'general',
  name: 'general',
  description: '全メンバーと共有するチャネル',
  type: 'general',
}

const ALPHA_NOTICE_KEY = 'teamie_threads_alpha_notice'

const route = useRoute()
const { user, profile } = useAuthStore()
const projectId = ref(String(route.params.projectId || ''))
const messages = ref<ChatMessage[]>([])
const input = ref('')
const createTaskOnSend = ref(false)
const selectedTaskId = ref('')
const tasks = ref<TaskDoc[]>([])
const project = ref<ProjectDoc | null>(null)
const projectMembers = ref<ProjectMember[]>([])
const customChannels = ref<ChatChannel[]>([])
const { getDisplayName } = useUserDisplay(projectMembers)
const taskMap = computed(() =>
  Object.fromEntries(
    tasks.value.map((task) => [task.id, task.threadName || task.title || '無題のタスク']),
  ),
)
const reactionOptions = ['👍', '🎉', '❤️', '🔥', '😄']
const openReactionFor = ref<string | null>(null)
const chatContainer = ref<HTMLElement | null>(null)
const composerInputEl = ref<HTMLInputElement | null>(null)
const editingMessageId = ref<string | null>(null)
const editingText = ref('')
const activeChannelId = ref('general')
const notificationsEnabled = ref(true)
const newMessageBanner = ref(false)
const newMessagePreview = ref('新着メッセージがあります')
const unreadChannels = ref<Record<string, boolean>>({})
const seenMessages = ref<Record<string, string>>({})
const replyingTo = ref<ChatMessage | null>(null)
// const sidebarOpen = ref(true)
const mentionQuery = ref('')
const mentionDropdownOpen = ref(false)
const mentionCaret = ref(0)
const slashQuery = ref('')
const slashDropdownOpen = ref(false)
const messageSearch = ref('')
const typingUsers = ref<Record<string, { name: string }>>({})
const newThreadModalOpen = ref(false)
const newThreadForm = ref<{ name: string; description: string }>({
  name: '',
  description: '',
})
const threadSettingsOpen = ref(false)
const threadSettingsTargetId = ref<string | null>(null)
const threadSettingsForm = ref<{ name: string; description: string }>({ name: '', description: '' })
const showAlphaNotice = ref(false)
const projectList = ref<{ id: string; name: string }[]>([])
const navItems = computed<DashboardNavItem[]>(() =>
  [
    {
      key: 'dashboard',
      label: 'ダッシュボード',
      to: { name: ROUTE_NAMES.projectDashboard, params: { projectId: projectId.value } },
      icon: 'dashboard',
    },
    { key: 'tasks', label: 'マイタスク', to: { name: ROUTE_NAMES.myTasks }, icon: 'tasks' },
    {
      key: 'team',
      label: 'スレッド',
      to: { name: ROUTE_NAMES.projectThreads, params: { projectId: projectId.value } },
      icon: 'team',
    },
    {
      key: 'members',
      label: 'メンバー',
      to: { name: ROUTE_NAMES.projectMembers, params: { projectId: projectId.value } },
      icon: 'members',
    },
    {
      key: 'settings',
      label: '設定',
      to: { name: ROUTE_NAMES.projectSettings, params: { projectId: projectId.value } },
      icon: 'settings',
    },
    {
      key: 'debug',
      label: 'デバッグ',
      to: { name: ROUTE_NAMES.projectDebug, params: { projectId: projectId.value } },
      icon: 'debug',
    },
  ] satisfies DashboardNavItem[],
)

const sidebarProjects = computed(() =>
  projectList.value.map((entry, index) => ({
    key: entry.id,
    label: entry.name,
    to: { name: ROUTE_NAMES.projectDashboard, params: { projectId: entry.id } },
    accent: (['primary', 'secondary', 'accent'][index % 3] as 'primary' | 'secondary' | 'accent'),
  })),
)

const profileInfo = computed(() => ({
  name: profile.value?.nickname || profile.value?.fullName || 'Teamie User',
  email: profile.value?.email || '',
}))
let typingTimeoutHandle: ReturnType<typeof setTimeout> | null = null

type SlashCommand = {
  key: string
  label: string
  description?: string
  insert?: string
}

const availableCommands: SlashCommand[] = [
  { key: '/private', label: '/private @user メッセージ', description: '指定ユーザーにのみ送信', insert: '/private @' },
  { key: '/ping', label: '/ping', description: 'Botがpongと返信' },
  { key: '/time', label: '/time', description: '現在時刻を返信' },
  { key: '/news', label: '/news', description: '最新ニュースを返信' },
]

let unsubscribeTasks: (() => void) | null = null
let unsubscribeChat: (() => void) | null = null
let unsubscribeMembers: (() => void) | null = null
let unsubscribeTyping: (() => void) | null = null
let unsubscribeCustomChannels: (() => void) | null = null

const channels = computed<ChatChannel[]>(() => {
  const taskChannels: ChatChannel[] = tasks.value
    .filter((task) => task.hasThread !== false)
    .map((task) => ({
      id: task.id,
      name: task.threadName || task.title || '無題のタスク',
      description: task.description || 'タスクディスカッション',
      type: 'task',
      assigneeId: task.assigneeId,
      status: task.status,
    }))
  const custom = customChannels.value
  const list = [{ ...defaultChannel }, ...custom, ...taskChannels]
  return list.filter(canAccessChannel)
})

const currentChannel = computed<ChatChannel>(() => {
  return channels.value.find((channel) => channel.id === activeChannelId.value) || defaultChannel
})

const filteredTaskChannels = computed(() => channels.value.filter((channel) => channel.type === 'task'))
const customThreadChannels = computed(() => channels.value.filter((channel) => channel.type === 'custom'))

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
  currentChannel,
  (channel) => {
    if (!channel || channel.type !== 'custom' || !canManageCurrentThread.value) {
      threadSettingsOpen.value = false
      threadSettingsTargetId.value = null
    }
  },
  { flush: 'post' },
)

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


function watchChat() {
  unsubscribeChat = listenProjectChat(projectId.value, (list) => {
    messages.value = list
  })
}

function watchTasks() {
  unsubscribeTasks = listenTasks(projectId.value, (list) => {
    tasks.value = list
  })
}

function watchMembers() {
  unsubscribeMembers = listenProjectMembers(projectId.value, (list) => {
    projectMembers.value = list
  })
}

function watchCustomChannels() {
  unsubscribeCustomChannels?.()
  if (!projectId.value) return
  const ref = query(collection(db, 'projects', projectId.value, 'threads'), orderBy('createdAt', 'asc'))
  unsubscribeCustomChannels = onSnapshot(ref, (snapshot) => {
    const list: { channel: ChatChannel; createdAt: number }[] = []
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as any
      list.push({
        channel: {
          id: docSnap.id,
          name: data?.name || '未命名スレッド',
          description: data?.description || '',
          type: 'custom',
          isPublic: data?.isPublic !== false,
          allowedUserIds: Array.isArray(data?.allowedUserIds) ? data.allowedUserIds : undefined,
          createdBy: typeof data?.createdBy === 'string'
            ? data.createdBy
            : typeof data?.userId === 'string'
              ? data.userId
              : null,
        },
        createdAt: toMillis(data?.createdAt) || 0,
      })
    })
    list.sort((a, b) => a.createdAt - b.createdAt)
    customChannels.value = list.map((entry) => entry.channel)
  })
}

function resetNewThreadForm() {
  newThreadForm.value = {
    name: '',
    description: '',
  }
}

function openNewThreadModal() {
  resetNewThreadForm()
  newThreadModalOpen.value = true
}

function closeNewThreadModal() {
  newThreadModalOpen.value = false
}

async function submitNewThread() {
  if (!projectId.value || !user.value) return
  const name = newThreadForm.value.name.trim()
  if (!name) return
  try {
    const docRef = await addDoc(collection(db, 'projects', projectId.value, 'threads'), {
      name,
      description: newThreadForm.value.description.trim() || '',
      createdBy: user.value.uid,
      userId: user.value.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    activeChannelId.value = docRef.id
    closeNewThreadModal()
    resetNewThreadForm()
  } catch (error) {
    logger.error`Failed to create new thread: ${error}`
  }
}

const canManageCurrentThread = computed(() => {
  const channel = currentChannel.value
  if (!channel || channel.type !== 'custom') return false
  if (!user.value?.uid) return false
  return channel.createdBy === user.value.uid
})

function openThreadSettings() {
  if (!canManageCurrentThread.value) return
  const channel = currentChannel.value
  if (!channel) return
  threadSettingsTargetId.value = channel.id
  threadSettingsForm.value = {
    name: channel.name,
    description: channel.description || '',
  }
  threadSettingsOpen.value = true
}

function closeThreadSettings() {
  threadSettingsOpen.value = false
  threadSettingsTargetId.value = null
}

async function saveThreadSettings() {
  if (!threadSettingsTargetId.value || !projectId.value) return
  const name = threadSettingsForm.value.name.trim()
  if (!name) return
  try {
    await updateDoc(doc(db, 'projects', projectId.value, 'threads', threadSettingsTargetId.value), {
      name,
      description: threadSettingsForm.value.description.trim() || '',
      updatedAt: serverTimestamp(),
    })
    closeThreadSettings()
  } catch (error) {
    logger.error`Failed to update thread: ${error}`
  }
}

async function deleteCurrentThread() {
  if (!threadSettingsTargetId.value || !projectId.value) return
  if (!confirm('このスレッドを削除してもよろしいですか？')) return
  try {
    await deleteDoc(doc(db, 'projects', projectId.value, 'threads', threadSettingsTargetId.value))
    if (activeChannelId.value === threadSettingsTargetId.value) {
      activeChannelId.value = 'general'
    }
    closeThreadSettings()
  } catch (error) {
    logger.error`Failed to delete thread: ${error}`
  }
}

function dismissAlphaNotice() {
  showAlphaNotice.value = false
  try {
    localStorage.setItem(ALPHA_NOTICE_KEY, '1')
  } catch (error) {
    logger.warn`Failed to persist alpha notice dismissal: ${error}`
  }
}

function memberNameById(id?: string | null) {
  if (!id) return ''
  const member = projectMembers.value.find((m) => m.userId === id)
  return member?.nickname || member?.fullName || member?.displayName || getDisplayName(id) || ''
}

const typingIndicator = computed(() => {
  const entries = Object.entries(typingUsers.value).filter(([uid]) => uid !== user.value?.uid)
  if (!entries.length) return ''
  const names = entries.map(([, data]) => data.name || '誰か')
  return `${names.join('、')}さんが入力中…`
})

function typingPath(uid: string) {
  return dbRef(database, `projects/${projectId.value}/typing/${uid}`)
}

function markSelfTyping() {
  if (!user.value) return
  set(typingPath(user.value.uid), {
    name: profile.value?.nickname || profile.value?.fullName || 'あなた',
    updatedAt: Date.now(),
  })
  if (typingTimeoutHandle) window.clearTimeout(typingTimeoutHandle)
  typingTimeoutHandle = window.setTimeout(() => {
    if (user.value) remove(typingPath(user.value.uid))
  }, 3000)
}

function setBotTyping(active: boolean) {
  const ref = typingPath('bot')
  if (active) {
    set(ref, { name: `${appName} Bot`, updatedAt: Date.now() })
  } else {
    remove(ref)
  }
}

function watchTyping() {
  unsubscribeTyping?.()
  const ref = dbRef(database, `projects/${projectId.value}/typing`)
  unsubscribeTyping = onValue(ref, (snapshot) => {
    const map: Record<string, { name: string }> = {}
    snapshot.forEach((child) => {
      const data = child.val()
      map[child.key || ''] = { name: data?.name || 'ユーザー' }
    })
    typingUsers.value = map
  })
}

const { handleSlashCommand } = useSlashCommands({
  projectId: projectId.value,
  currentChannel,
  user,
  profile,
  projectMembers,
  setBotTyping,
})

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

function canAccessChannel(channel: ChatChannel) {
  if (channel.type === 'general' || channel.type === 'task') return true
  if (channel.isPublic !== false) return true
  if (!user.value?.uid) return false
  return Boolean(channel.allowedUserIds?.includes(user.value.uid))
}

function toMillis(value: ChatMessage['createdAt'] | number | null | undefined): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  const seconds = (value as any)?.seconds
  if (typeof seconds === 'number') return seconds * 1000
  return null
}



function handleComposerInput(event: Event) {
  const target = event.target as HTMLInputElement
  mentionCaret.value = target.selectionStart ?? input.value.length
  const uptoCaret = input.value.slice(0, mentionCaret.value)
  const match = uptoCaret.match(/@([^\s@]{0,20})$/)
  if (match) {
    mentionQuery.value = match[1] || ''
    mentionDropdownOpen.value = true
  } else {
    mentionDropdownOpen.value = false
    mentionQuery.value = ''
  }

  const slashMatch = uptoCaret.match(/\/([^\s/]{0,20})$/)
  if (slashMatch) {
    slashQuery.value = slashMatch[1] || ''
    slashDropdownOpen.value = true
  } else {
    slashDropdownOpen.value = false
    slashQuery.value = ''
  }
  markSelfTyping()
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

function insertCommand(cmd: SlashCommand) {
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

async function sendMessage() {
  if (!input.value.trim() || !user.value) return
  const text = input.value.trim()
  const mentions = extractMentions(text)

  if (text.startsWith('/')) {
    const handled = await handleSlashCommand(text)
    if (handled) {
      resetComposer()
      return
    }
  }

  let linkedTaskId: string | null = null
  if (createTaskOnSend.value) {
    const assignee = mentions.find((m) => m.userId)?.userId || null
    linkedTaskId = await createTask(
      projectId.value,
      {
        title: text,
        assigneeId: assignee,
        assigneeName: assignee ? memberNameById(assignee) : null,
        hasThread: true,
        threadName: text,
      },
      user.value.uid,
    )
  } else if (selectedTaskId.value) {
    linkedTaskId = selectedTaskId.value
  }

  await sendProjectMessage(
    projectId.value,
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
  if (user.value) {
    remove(typingPath(user.value.uid))
  }
  resetComposer()
  markChannelAsRead(currentChannel.value?.id || 'general')
  newMessageBanner.value = false
  scrollToBottom()
}

async function convertToTask(messageId: string, text: string) {
  if (!user.value) return
  const taskId = await createTask(projectId.value, { title: text, hasThread: true, threadName: text }, user.value.uid)
  await update(dbRef(database, `projects/${projectId.value}/realtimeChat/${messageId}`), { linkedTaskId: taskId })
  activeChannelId.value = taskId
}

async function linkTask(messageId: string, taskId: string) {
  await update(dbRef(database, `projects/${projectId.value}/realtimeChat/${messageId}`), { linkedTaskId: taskId })
}

async function reactToMessage(messageId: string, emoji: string) {
  if (!user.value || !messageId || !emoji) return
  await addMessageReaction(projectId.value, messageId, emoji, user.value.uid)
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
  await updateProjectMessage(projectId.value, editingMessageId.value, editingText.value)
  cancelEditing()
}

async function deleteMessage(messageId: string) {
  if (!confirm('このメッセージを削除してもよろしいですか？')) return
  await deleteProjectMessage(projectId.value, messageId)
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
  watchTyping()
  watchCustomChannels()
  try {
    const dismissed = localStorage.getItem(ALPHA_NOTICE_KEY)
    if (!dismissed) {
      setTimeout(() => {
        showAlphaNotice.value = true
      }, 600)
    }
  } catch (error) {
    logger.warn`Alpha notice state unavailable: ${error}`
  }
  if (projectId.value) {
    project.value = await fetchProject(projectId.value)
  }
})

onBeforeUnmount(() => {
  unsubscribeTasks?.()
  unsubscribeChat?.()
  unsubscribeMembers?.()
  unsubscribeTyping?.()
  unsubscribeCustomChannels?.()
  if (user.value) {
    remove(typingPath(user.value.uid))
  }
})
</script>

<template>
  <div class="app-container">
    <!-- Main Sidebar -->
    <DashboardSidebar
      :open="true"
      :nav-items="navItems"
      :projects="sidebarProjects"
      :profile="profileInfo"
      brand-subtitle="プロジェクト"
    />
    
    <!-- Content Wrapper -->
    <div class="content-wrapper">
    <!-- Threads Panel -->
    <aside class="threads-panel">
      <div class="threads-header">
        <div class="workspace-name">{{ project?.name || 'プロジェクト' }}</div>
      </div>
      
      <div class="threads-section">
        <div class="section-title">
          <span>Threads</span>
          <button class="new-thread-btn" type="button" @click="openNewThreadModal">+ 新規スレッド</button>
        </div>
        
        <div class="section-subtitle">Channels</div>
        <div 
          class="thread-item" 
          :class="{ active: activeChannelId === 'general' }"
          @click="selectChannel('general')"
        >
          <span class="thread-icon">#</span>
          <span class="thread-name">general</span>
          <span v-if="unreadChannels['general']" class="thread-badge">3</span>
        </div>

        <div class="section-subtitle">Task Threads</div>
        <div 
          v-for="channel in filteredTaskChannels" 
          :key="channel.id"
          class="thread-item"
          :class="{ active: channel.id === currentChannel?.id }"
          @click="selectChannel(channel.id)"
        >
          <UserAvatar 
            :name="channel.name" 
            :size="24" 
            class="thread-avatar"
          />
          <span class="thread-name">{{ channel.name }}</span>
          <span v-if="unreadChannels[channel.id]" class="thread-badge">{{ unreadChannels[channel.id] ? '1' : '' }}</span>
        </div>
        <p v-if="!filteredTaskChannels.length" class="empty-text">No tasks found</p>

        <div class="section-subtitle">Custom Threads</div>
        <div 
          v-for="channel in customThreadChannels" 
          :key="channel.id"
          class="thread-item"
          :class="{ active: channel.id === currentChannel?.id }"
          @click="selectChannel(channel.id)"
        >
          <span class="thread-icon">#</span>
          <div class="thread-info">
            <span class="thread-name">{{ channel.name }}</span>
            <span v-if="channel.description" class="thread-meta">{{ channel.description }}</span>
          </div>
          <span v-if="unreadChannels[channel.id]" class="thread-badge">{{ unreadChannels[channel.id] ? '1' : '' }}</span>
        </div>
        <p v-if="!customThreadChannels.length" class="empty-text">No custom threads</p>
      </div>
    </aside>

    <!-- Main Chat -->
    <main class="main-chat">
      <header class="chat-header">
        <div class="channel-title">
          <span>#</span>
          <span class="channel-name" :title="currentChannel?.name">{{ currentChannel?.name }}</span>
        </div>
        <div class="channel-controls">
          <div class="channel-search">
            <input
              v-model="messageSearch"
              type="search"
              placeholder="このチャンネル内を検索"
            />
          </div>
          <button
            v-if="canManageCurrentThread"
            type="button"
            class="thread-settings-btn"
            @click="openThreadSettings"
          >
            スレッド設定
          </button>
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
            @dblclick="reactToMessage(message.id, '👍')"
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
                  <option v-for="task in tasks" :key="task.id" :value="task.id">
                    {{ task.threadName || task.title }}
                  </option>
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
              <option v-for="task in tasks" :key="task.id" :value="task.id">
                {{ task.threadName || task.title }}
              </option>
            </select>
          </label>
        </div>
        <p v-if="typingIndicator" class="typing-indicator">{{ typingIndicator }}</p>
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

    <div v-if="newThreadModalOpen" class="thread-modal-overlay">
      <div class="thread-modal">
        <header>
          <h3>新しいスレッド</h3>
          <button type="button" @click="closeNewThreadModal">×</button>
        </header>
        <form class="thread-modal__form" @submit.prevent="submitNewThread">
          <label>
            スレッド名
            <input v-model="newThreadForm.name" type="text" placeholder="デザインレビュー" required />
          </label>
          <label>
            説明 (任意)
            <textarea v-model="newThreadForm.description" rows="3" placeholder="スレッドの背景を入力"></textarea>
          </label>
          
          <footer>
            <button type="button" class="ghost" @click="closeNewThreadModal">キャンセル</button>
            <button type="submit" :disabled="!newThreadForm.name.trim()">作成</button>
          </footer>
        </form>
      </div>
    </div>

    <div v-if="threadSettingsOpen" class="thread-modal-overlay">
      <div class="thread-modal">
        <header>
          <h3>スレッド設定</h3>
          <button type="button" @click="closeThreadSettings">×</button>
        </header>
        <form class="thread-modal__form" @submit.prevent="saveThreadSettings">
          <label>
            スレッド名
            <input v-model="threadSettingsForm.name" type="text" required />
          </label>
          <label>
            説明
            <textarea v-model="threadSettingsForm.description" rows="3" placeholder="スレッドの説明"></textarea>
          </label>
          <footer>
            <button type="button" class="ghost" @click="closeThreadSettings">キャンセル</button>
            <button type="submit" :disabled="!threadSettingsForm.name.trim()">保存</button>
          </footer>
        </form>
        <div class="thread-settings__danger">
          <p>このスレッドを削除すると、メッセージ履歴は保持されますがチャネル一覧からは消えます。</p>
          <button type="button" class="danger" @click="deleteCurrentThread">スレッドを削除</button>
        </div>
      </div>
    </div>

    <div v-if="showAlphaNotice" class="alpha-notice">
      <p>スレッド体験は現在アルファ版です。ご意見をお待ちしています！</p>
      <button type="button" @click="dismissAlphaNotice">了解</button>
    </div>
    </div><!-- end content-wrapper -->
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 100vh;
  background: var(--surface-panel);
  color: #1e293b;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

.content-wrapper {
  display: grid;
  grid-template-columns: 320px 1fr;
  min-height: 100vh;
  overflow: hidden;
}

/* Threads Panel (Middle Column) */
.threads-panel {
  background: var(--surface-panel);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-strong);
  height: 100vh;
  min-height: 100vh;
  overflow: hidden
}

.threads-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-strong);
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.workspace-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-strong);
}


.threads-section {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  max-height: calc(100vh - 80px);
}

.threads-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.threads-scroll::-webkit-scrollbar {
  width: 6px;
}

.threads-scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.section-title {
  font-size: 20px;
  color: var(--text-strong);
  font-weight: 700;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.new-thread-btn {
  border: none;
  background: #2563eb;
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.new-thread-btn:hover {
  background: #1d4ed8;
}

.section-subtitle {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
  margin: 20px 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.thread-item {
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #475569;
  font-size: 14px;
  border-radius: 8px;
  position: relative;
  margin-bottom: 2px;
}

.thread-item:hover {
  background: #ffffff;
  color: var(--text-strong);
}

.thread-item.active {
  background: #e0f2f1;
  color: var(--text-strong);
  font-weight: 600;
}

.thread-icon {
  font-size: 16px;
  color: #64748b;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.thread-avatar {
  flex-shrink: 0;
}

.thread-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-badge {
  background: #0b2e33;
  color: #ffffff;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  min-width: 20px;
  text-align: center;
}

.empty-text {
  padding: 12px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}


/* Main Chat */
.main-chat {
  display: flex;
  flex-direction: column;
  background: var(--surface-panel);
  height: 100vh;
  overflow: hidden;
}

.chat-header {
  height: 60px;
  border-bottom: 1px solid var(--border-strong);
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
  flex: 1;
  max-width: 400px;
}

.channel-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.thread-settings-btn {
  border: 1px solid #d1dae8;
  background: #fff;
  color: var(--text-strong);
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.thread-settings-btn:hover {
  border-color: var(--text-muted);
  background: #f1f5f9;
}

.channel-search input {
  width: 100%;
  padding: 10px 16px 10px 40px;
  border: 2px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface-panel);
  font-size: 14px;
  color: var(--text-strong);
  transition: all 0.3s ease;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cpath d='m21 21-4.35-4.35'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 12px center;
  background-size: 18px;
}

.channel-search input::placeholder {
  color: var(--text-muted);
}

.channel-search input:focus {
  outline: none;
  border-color: #0b2e33;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(184, 227, 233, 0.22);
}

.messages-container::-webkit-scrollbar {
  width: 8px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

@media (max-width: 1200px) {
  .app-container {
    grid-template-columns: 200px 1fr;
  }
  
  /* Prevent sidebar from shrinking too much */
  .sidebar {
    min-width: 200px;
  }

  .content-wrapper {
    grid-template-columns: 280px 1fr;
  }

  .threads-panel {
    min-height: 200px;
  }
}

@media (max-width: 768px) {
  .app-container {
    grid-template-columns: 60px 1fr;
  }

  .content-wrapper {
    grid-template-columns: 200px 1fr;
  }

  .threads-panel {
    min-height: 100vh;
  }

  .chat-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .channel-search {
    width: 100%;
  }

  /* Mobile: Message Actions always visible or easier to access */
  .message-actions {
    opacity: 1;
    transform: translateY(0);
    top: -20px;
    right: 10px;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border: 1px solid #cbd5e1;
  }

  .action-btn {
    width: 36px;
    height: 36px;
    font-size: 20px;
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
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
  color: var(--text-strong);
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
  border: 1px solid var(--border-strong);
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

.thread-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.thread-meta {
  font-size: 11px;
  color: var(--text-muted);
}

.thread-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
}

.thread-modal {
  background: #ffffff;
  border-radius: 16px;
  padding: 20px;
  width: 360px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}

.thread-modal header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.thread-modal header h3 {
  margin: 0;
  font-size: 18px;
}

.thread-modal header button {
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
}

.thread-modal__form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.thread-modal__form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}

.thread-modal__form input,
.thread-modal__form textarea,
.thread-modal__form select {
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
}

.thread-modal__form textarea {
  resize: vertical;
}

.thread-modal__form footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.thread-modal__form footer button {
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-weight: 600;
  cursor: pointer;
}

.thread-modal__form footer .ghost {
  background: var(--border-strong);
  color: #475569;
}

.thread-modal__form footer button:last-child {
  background: #2563eb;
  color: #fff;
}

.thread-modal__form footer button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.thread-settings__danger {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-strong);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.thread-settings__danger .danger {
  align-self: flex-start;
  border: none;
  border-radius: 8px;
  padding: 0.45rem 1rem;
  background: #dc2626;
  color: #fff;
  cursor: pointer;
}

.alpha-notice {
  position: fixed;
  bottom: 24px;
  right: 32px;
  background: #0b2e33;
  color: #fff;
  padding: 0.85rem 1.1rem;
  border-radius: 12px;
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.25);
  display: flex;
  align-items: center;
  gap: 1rem;
  z-index: 60;
}

.alpha-notice button {
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border-radius: 20px;
  padding: 0.2rem 0.9rem;
  cursor: pointer;
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
  border: 1px solid var(--border-strong);
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
  border: 1px solid var(--border-strong);
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
  border: 1px solid var(--border-strong);
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
  border-top: 1px solid var(--border-strong);
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
  background: var(--surface-panel);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 2px solid var(--border-strong);
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
  color: var(--text-strong);
  font-size: 15px;
  outline: none;
}

#messageInput::placeholder {
  color: var(--text-muted);
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
  background: var(--surface-panel);
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

.typing-indicator {
  font-size: 0.85rem;
  color: #64748b;
  margin: 0.35rem 0;
}

</style>
