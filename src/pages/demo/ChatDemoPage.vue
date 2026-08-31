<script setup lang="ts">
import { useSidebarState } from "@/composables/useSidebarState";
import { ref, computed } from "vue";
import DashboardSidebar from "@/components/demo/DashboardSidebar.vue";
import DemoExplainerBanner from "@/components/demo/DemoExplainerBanner.vue";
import { appName } from "@/constants/appMeta";

interface DemoMessage {
  id: string;
  author: string;
  authorInitials: string;
  content: string;
  timestamp: Date;
  isOwn?: boolean;
  reactions?: { emoji: string; count: number }[];
}

interface DemoThread {
  id: string;
  name: string;
  type: "general" | "task" | "custom";
  taskTitle?: string;
  unreadCount?: number;
}

const { isSidebarOpen, toggleSidebar, closeSidebar } = useSidebarState();

const threads: DemoThread[] = [
  { id: "general", name: "全体", type: "general" },
  {
    id: "task-1",
    name: "ランディングページのデザイン",
    type: "task",
    taskTitle: "タスクスレッド",
  },
  {
    id: "task-2",
    name: "APIエンドポイントの実装",
    type: "task",
    taskTitle: "タスクスレッド",
    unreadCount: 3,
  },
  { id: "custom-1", name: "雑談", type: "custom" },
  { id: "custom-2", name: "技術相談", type: "custom", unreadCount: 1 },
];

const activeThreadId = ref("general");

const mockMessages: Record<string, DemoMessage[]> = {
  general: [
    {
      id: "1",
      author: "田中 太郎",
      authorInitials: "田中",
      content: "おはようございます！今日のミーティングは14時からですね。",
      timestamp: new Date(Date.now() - 3600000 * 2),
    },
    {
      id: "2",
      author: "佐藤 花子",
      authorInitials: "佐藤",
      content: "了解です。資料の準備はできていますか？",
      timestamp: new Date(Date.now() - 3600000),
      reactions: [{ emoji: "👍", count: 2 }],
    },
    {
      id: "3",
      author: "鈴木 一郎",
      authorInitials: "鈴木",
      content: "はい、共有ドライブにアップロードしました。確認お願いします！",
      timestamp: new Date(Date.now() - 1800000),
      isOwn: true,
    },
    {
      id: "4",
      author: "田中 太郎",
      authorInitials: "田中",
      content: "ありがとうございます。確認しました。問題なさそうです。",
      timestamp: new Date(Date.now() - 900000),
      reactions: [{ emoji: "✅", count: 1 }],
    },
  ],
  "task-1": [
    {
      id: "t1-1",
      author: "高橋 美咲",
      authorInitials: "高橋",
      content: "デザインの初稿ができました。Figmaのリンクを共有します。",
      timestamp: new Date(Date.now() - 86400000),
    },
    {
      id: "t1-2",
      author: "田中 太郎",
      authorInitials: "田中",
      content: "素晴らしいですね！ヘッダーの色をもう少し濃くできますか？",
      timestamp: new Date(Date.now() - 43200000),
    },
    {
      id: "t1-3",
      author: "高橋 美咲",
      authorInitials: "高橋",
      content: "承知しました。修正して再度共有します。",
      timestamp: new Date(Date.now() - 21600000),
      isOwn: true,
    },
  ],
  "task-2": [
    {
      id: "t2-1",
      author: "佐藤 花子",
      authorInitials: "佐藤",
      content:
        "認証エンドポイントの実装が完了しました。PRをレビューお願いします。",
      timestamp: new Date(Date.now() - 7200000),
    },
  ],
  "custom-1": [
    {
      id: "c1-1",
      author: "鈴木 一郎",
      authorInitials: "鈴木",
      content: "お昼何食べますか？",
      timestamp: new Date(Date.now() - 14400000),
      isOwn: true,
    },
    {
      id: "c1-2",
      author: "田中 太郎",
      authorInitials: "田中",
      content: "カレーにしようかな",
      timestamp: new Date(Date.now() - 10800000),
      reactions: [{ emoji: "🍛", count: 3 }],
    },
  ],
  "custom-2": [
    {
      id: "c2-1",
      author: "佐藤 花子",
      authorInitials: "佐藤",
      content:
        "Vueのcomposableの設計について相談したいのですが、時間ありますか？",
      timestamp: new Date(Date.now() - 3600000),
    },
  ],
};

const activeThread = computed(() =>
  threads.find((t) => t.id === activeThreadId.value),
);
const currentMessages = computed(
  () => mockMessages[activeThreadId.value] || [],
);

const messageInput = ref("");

function formatTime(date: Date) {
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date: Date) {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return "今日";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "昨日";
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}
</script>

<template>
  <div :class="['demo', { 'demo--sidebar-collapsed': !isSidebarOpen }]">
    <DashboardSidebar :open="isSidebarOpen" @close="closeSidebar" />
    <div
      v-if="isSidebarOpen"
      class="demo__overlay"
      aria-hidden="true"
      @click="closeSidebar"
    />

    <div class="demo__main">
      <header class="demo__topbar">
        <div class="demo__topbar-left">
          <button
            type="button"
            class="demo__menu-button"
            @click="toggleSidebar"
          >
            <span class="sr-only">サイドバーを切り替え</span>
            <svg
              v-if="!isSidebarOpen"
              aria-hidden="true"
              class="demo__menu-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            <svg
              v-else
              aria-hidden="true"
              class="demo__menu-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 6l12 12M18 6l-12 12"
              />
            </svg>
          </button>
          <div>
            <p class="demo__breadcrumb">デモ体験 &gt; スレッド</p>
            <h1 class="demo__heading">Webサイトリニューアル</h1>
          </div>
        </div>
      </header>

      <div class="demo__content demo__content--chat">
        <DemoExplainerBanner page="chat" />

        <div class="chat-layout">
          <!-- スレッドリスト -->
          <aside class="thread-list">
            <header class="thread-list__header">
              <h3>スレッド</h3>
              <button
                type="button"
                class="thread-list__add"
                aria-label="スレッドを追加"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M12 5v14M5 12h14" stroke-linecap="round" />
                </svg>
              </button>
            </header>
            <ul class="thread-list__items">
              <li
                v-for="thread in threads"
                :key="thread.id"
                class="thread-item"
                :class="{ 'is-active': activeThreadId === thread.id }"
                @click="activeThreadId = thread.id"
              >
                <div class="thread-item__icon">
                  <svg
                    v-if="thread.type === 'general'"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    />
                  </svg>
                  <svg
                    v-else-if="thread.type === 'task'"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M9 11l3 3L22 4" />
                    <path
                      d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
                    />
                  </svg>
                  <svg
                    v-else
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </div>
                <div class="thread-item__content">
                  <span class="thread-item__name">{{ thread.name }}</span>
                  <span v-if="thread.taskTitle" class="thread-item__label">{{
                    thread.taskTitle
                  }}</span>
                </div>
                <span v-if="thread.unreadCount" class="thread-item__badge">{{
                  thread.unreadCount
                }}</span>
              </li>
            </ul>
          </aside>

          <!-- チャットエリア -->
          <main class="chat-area">
            <header class="chat-area__header">
              <div class="chat-area__info">
                <h2>{{ activeThread?.name }}</h2>
                <span
                  v-if="activeThread?.type === 'task'"
                  class="chat-area__label"
                  >タスクスレッド</span
                >
                <span
                  v-else-if="activeThread?.type === 'custom'"
                  class="chat-area__label"
                  >カスタムスレッド</span
                >
              </div>
            </header>

            <div class="chat-messages">
              <div
                v-for="message in currentMessages"
                :key="message.id"
                class="chat-message"
                :class="{ 'is-own': message.isOwn }"
              >
                <div class="chat-message__avatar">
                  <span>{{ message.authorInitials }}</span>
                </div>
                <div class="chat-message__content">
                  <header class="chat-message__header">
                    <span class="chat-message__author">{{
                      message.author
                    }}</span>
                    <span class="chat-message__time"
                      >{{ formatDate(message.timestamp) }}
                      {{ formatTime(message.timestamp) }}</span
                    >
                  </header>
                  <p class="chat-message__text">{{ message.content }}</p>
                  <div
                    v-if="message.reactions?.length"
                    class="chat-message__reactions"
                  >
                    <span
                      v-for="reaction in message.reactions"
                      :key="reaction.emoji"
                      class="chat-reaction"
                    >
                      {{ reaction.emoji }} {{ reaction.count }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <footer class="chat-composer">
              <input
                v-model="messageInput"
                type="text"
                class="chat-composer__input"
                placeholder="メッセージを入力..."
                disabled
              />
              <button type="button" class="chat-composer__send" disabled>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </footer>
          </main>
        </div>

        <!-- デモ注意書き -->
        <div class="demo-notice">
          <p>
            これはデモ画面です。実際の{{
              appName
            }}では、メッセージの送受信・リアクション・タスク連携などが可能です。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import "@/pages/demo/styles/demo-shell.css";

.demo__content--chat {
  padding: var(--ui-space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
}

/* チャットレイアウト */
.chat-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--ui-space-4, 1rem);
  height: calc(100vh - 320px);
  min-height: 400px;
}

/* スレッドリスト */
.thread-list {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.thread-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ui-space-4, 1rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.thread-list__header h3 {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.thread-list__add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-700, #1a4a51);
  cursor: pointer;
  transition: background 150ms ease;
}

.thread-list__add:hover {
  background: var(--ui-brand-200, #d4f1f5);
}

.thread-list__add svg {
  width: 18px;
  height: 18px;
}

.thread-list__items {
  list-style: none;
  margin: 0;
  padding: var(--ui-space-2, 0.5rem);
  overflow-y: auto;
  flex: 1;
}

.thread-item {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  cursor: pointer;
  transition: background 150ms ease;
}

.thread-item:hover {
  background: var(--ui-surface-muted, #f1f5f9);
}

.thread-item.is-active {
  background: var(--ui-brand-100, #e5f6f8);
}

.thread-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
  flex-shrink: 0;
}

.thread-item.is-active .thread-item__icon {
  background: var(--ui-brand-200, #d4f1f5);
  color: var(--ui-brand-700, #1a4a51);
}

.thread-item__icon svg {
  width: 18px;
  height: 18px;
}

.thread-item__content {
  flex: 1;
  min-width: 0;
}

.thread-item__name {
  display: block;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thread-item__label {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.thread-item__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-600, #4f7c82);
  color: #fff;
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-bold, 700);
}

/* チャットエリア */
.chat-area {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-area__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ui-space-4, 1rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.chat-area__info h2 {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.chat-area__label {
  font-size: var(--ui-text-xs, 0.75rem);
  padding: 2px 8px;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-800, #134e4a);
  margin-left: var(--ui-space-2, 0.5rem);
}

/* メッセージ */
.chat-messages {
  flex: 1;
  padding: var(--ui-space-4, 1rem);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.chat-message {
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
}

.chat-message.is-own {
  flex-direction: row-reverse;
}

.chat-message__avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-800, #134e4a);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-bold, 700);
  flex-shrink: 0;
}

.chat-message__content {
  max-width: 70%;
}

.chat-message__header {
  display: flex;
  align-items: baseline;
  gap: var(--ui-space-2, 0.5rem);
  margin-bottom: var(--ui-space-1, 0.25rem);
}

.chat-message.is-own .chat-message__header {
  flex-direction: row-reverse;
}

.chat-message__author {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.chat-message__time {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.chat-message__text {
  margin: 0;
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-lg, 1rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
  line-height: 1.5;
}

.chat-message.is-own .chat-message__text {
  background: var(--ui-brand-100, #e5f6f8);
}

.chat-message__reactions {
  display: flex;
  gap: var(--ui-space-1, 0.25rem);
  margin-top: var(--ui-space-1, 0.25rem);
}

.chat-reaction {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  font-size: var(--ui-text-xs, 0.75rem);
}

/* コンポーザー */
.chat-composer {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.chat-composer__input {
  flex: 1;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-lg, 1rem);
  font-size: max(var(--ui-text-sm, 0.875rem), 16px);
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface-muted, #f1f5f9);
}

.chat-composer__input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-composer__send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: var(--ui-radius-lg, 1rem);
  background: var(--ui-brand-600, #4f7c82);
  color: #fff;
  cursor: pointer;
}

.chat-composer__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-composer__send svg {
  width: 20px;
  height: 20px;
}

/* デモ注意書き */
.demo-notice {
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-brand-50, #f5fcff);
  border: 1px solid var(--ui-brand-200, #d4f1f5);
  border-radius: var(--ui-radius-lg, 1rem);
  text-align: center;
}

.demo-notice p {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

/* レスポンシブ */
@media (max-width: 900px) {
  .chat-layout {
    grid-template-columns: 1fr;
    height: auto;
  }

  .thread-list {
    max-height: 200px;
  }

  .chat-area {
    min-height: 400px;
  }
}

@media (max-width: 768px) {
  .demo__content--chat {
    padding: var(--ui-space-4, 1rem);
  }
}
</style>
