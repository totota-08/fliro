<script setup lang="ts">
import { appName } from "@/constants/appMeta";
import { onBeforeUnmount, onMounted, ref } from "vue";

interface ChatMessage {
  author: string;
  time: string;
  message: string;
  type?: "update";
  highlight?: boolean;
}

const onlineMembers = ref(8);
const baseMessages: ChatMessage[] = [
  {
    author: "佐藤花子",
    time: "10:30",
    message: "トップページのデザイン、レビューお願いします！",
  },
  {
    author: "田中太郎",
    time: "10:36",
    type: "update",
    message: "新しいタスクが作成されました：「デザイン修正対応」",
  },
  {
    author: "鈴木一郎",
    time: "11:20",
    message: "データベース設計のレビュー会議、明日の14時でどうでしょうか？",
  },
  {
    author: "高橋美咲",
    time: "11:25",
    message: "大丈夫です！参加します。",
  },
];

const demoQueue: ChatMessage[] = [
  {
    author: `${appName} Bot`,
    time: "11:32",
    type: "update",
    message: "進捗レポートが更新されました。",
  },
  {
    author: "大森健太",
    time: "11:35",
    message: "ユーザーテストのフィードバック、まとめました！後ほど共有します。",
  },
];

const conversation = ref<ChatMessage[]>([...baseMessages]);
const typing = ref(false);
let presenceTimer: number | undefined;
let demoTimer: number | undefined;
let queueIndex = 0;

onMounted(() => {
  presenceTimer = window.setInterval(() => {
    onlineMembers.value = onlineMembers.value === 8 ? 9 : 8;
  }, 8000);

  demoTimer = window.setInterval(() => {
    if (!demoQueue.length) return;
    const index = queueIndex % demoQueue.length;
    const next = demoQueue[index];
    if (!next) return;
    queueIndex += 1;
    typing.value = true;
    window.setTimeout(() => {
      const stamped: ChatMessage = {
        ...next,
        time: new Date().toTimeString().slice(0, 5),
        highlight: true,
      };
      const updated = [...conversation.value, stamped];
      conversation.value = updated;
      typing.value = false;
      window.setTimeout(() => {
        const followUp = [...conversation.value];
        const targetIndex = updated.length - 1;
        if (followUp[targetIndex]) {
          followUp[targetIndex] = {
            ...followUp[targetIndex],
            highlight: false,
          };
          conversation.value = followUp;
        }
      }, 2500);
    }, 1400);
  }, 9500);
});

onBeforeUnmount(() => {
  if (presenceTimer) window.clearInterval(presenceTimer);
  if (demoTimer) window.clearInterval(demoTimer);
});
</script>

<template>
  <section class="chat">
    <header class="chat__header">
      <div>
        <h2>チームチャット</h2>
        <p>{{ onlineMembers }}人がオンライン</p>
      </div>
      <button type="button" class="chat__close" aria-label="閉じる">×</button>
    </header>

    <ul class="chat__messages">
      <li
        v-for="message in conversation"
        :key="`${message.time}-${message.author}`"
        :class="{
          'chat__messages--update': message.type === 'update',
          'is-highlight': message.highlight,
        }"
      >
        <header>
          <span class="chat__author">{{ message.author }}</span>
          <time>{{ message.time }}</time>
        </header>
        <p>{{ message.message }}</p>
      </li>
    </ul>

    <div v-if="typing" class="chat__typing">
      <span class="chat__typing-dot" />
      <span class="chat__typing-dot" />
      <span class="chat__typing-dot" />
      {{ appName }} Bot がメッセージを入力しています…
    </div>

    <footer class="chat__footer">
      <input type="text" placeholder="メッセージを入力..." />
      <button type="button">送信</button>
    </footer>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  border-radius: var(--ui-radius-2xl, 1.5rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface, #ffffff);
  box-shadow: var(--ui-shadow-lg, 0 12px 24px rgba(11, 46, 51, 0.1));
  overflow: hidden;
}

.chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ui-space-5, 1.25rem) var(--ui-space-6, 1.5rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.chat__header h2 {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.chat__header p {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.chat__close {
  border: none;
  width: var(--ui-touch-target-min, 2rem);
  height: var(--ui-touch-target-min, 2rem);
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-900, #0b2e33);
  cursor: pointer;
  transition: var(--ui-transition-colors, background-color 120ms ease);
}

.chat__close:hover {
  background: var(--ui-brand-200, #d4f1f5);
}

.chat__close:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus, 0 0 0 3px rgba(79, 124, 130, 0.25));
}

.chat__messages {
  list-style: none;
  margin: 0;
  padding: var(--ui-space-6, 1.5rem) var(--ui-space-6, 1.5rem)
    var(--ui-space-3, 0.75rem);
  display: grid;
  gap: var(--ui-space-4, 1rem);
  max-height: 320px;
  overflow-y: auto;
}

.chat__messages li {
  padding: var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-lg, 1rem);
  background: var(--ui-surface-accent, rgba(184, 227, 233, 0.35));
  display: grid;
  gap: var(--ui-space-2, 0.5rem);
  transition: var(--ui-transition-all, all 180ms ease);
}

.chat__messages--update {
  border: 1px solid var(--ui-brand-400, #8cb8be);
  background: var(--ui-brand-200, #d4f1f5);
}

.chat__messages li.is-highlight {
  background: var(--ui-brand-300, #b8e3e9);
  box-shadow: var(--ui-shadow-lg, 0 12px 24px rgba(11, 46, 51, 0.1));
  transform: translateY(calc(-1 * var(--ui-space-1, 0.25rem)));
}

.chat__messages header {
  display: flex;
  justify-content: space-between;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.chat__author {
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.chat__messages p {
  margin: 0;
  color: var(--ui-text, #0b2e33);
  line-height: var(--ui-leading-relaxed, 1.625);
}

.chat__footer {
  margin-top: auto;
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-6, 1.5rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface-accent, rgba(184, 227, 233, 0.35));
}

.chat__footer input {
  flex: 1;
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  font-size: var(--ui-text-sm, 0.875rem);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  transition: var(--ui-transition-colors, border-color 120ms ease);
}

.chat__footer input::placeholder {
  color: var(--ui-text-placeholder, #94a3b8);
}

.chat__footer input:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus, 0 0 0 3px rgba(79, 124, 130, 0.25));
}

.chat__footer button {
  border-radius: var(--ui-radius-md, 0.75rem);
  border: none;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: var(--ui-brand-600, #4f7c82);
  color: var(--ui-text-inverse, #ffffff);
  font-weight: var(--ui-font-semibold, 600);
  cursor: pointer;
  transition: var(--ui-transition-colors, background-color 120ms ease);
}

.chat__footer button:hover {
  background: var(--ui-brand-700, #1a4a51);
}

.chat__footer button:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus, 0 0 0 3px rgba(79, 124, 130, 0.25));
}

.chat__typing {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: 0 var(--ui-space-6, 1.5rem) var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.chat__typing-dot {
  width: var(--ui-space-1, 0.25rem);
  height: var(--ui-space-1, 0.25rem);
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-600, #4f7c82);
  animation: typing var(--ui-duration-slow, 280ms) infinite ease-in-out;
  animation-duration: 1.2s;
}

.chat__typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}
.chat__typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(calc(-1 * var(--ui-space-1, 0.25rem)));
  }
}

/* prefers-reduced-motion 対応 */
@media (prefers-reduced-motion: reduce) {
  .chat__messages li {
    transition: none;
  }
  .chat__messages li.is-highlight {
    transform: none;
  }
  .chat__typing-dot {
    animation: none;
  }
  .chat__close,
  .chat__footer input,
  .chat__footer button {
    transition: none;
  }
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
