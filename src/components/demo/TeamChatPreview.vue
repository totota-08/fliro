<script setup lang="ts">
import { appName } from '@/constants/appMeta'
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface ChatMessage {
  author: string
  time: string
  message: string
  type?: 'update'
  highlight?: boolean
}

const onlineMembers = ref(8)
const baseMessages: ChatMessage[] = [
  {
    author: '佐藤花子',
    time: '10:30',
    message: 'トップページのデザイン、レビューお願いします！',
  },
  {
    author: '田中太郎',
    time: '10:36',
    type: 'update',
    message: '新しいタスクが作成されました：「デザイン修正対応」',
  },
  {
    author: '鈴木一郎',
    time: '11:20',
    message: 'データベース設計のレビュー会議、明日の14時でどうでしょうか？',
  },
  {
    author: '高橋美咲',
    time: '11:25',
    message: '大丈夫です！参加します。',
  },
]

const demoQueue: ChatMessage[] = [
  {
    author: `${appName} Bot`,
    time: '11:32',
    type: 'update',
    message: '進捗レポートが更新されました。',
  },
  {
    author: '大森健太',
    time: '11:35',
    message: 'ユーザーテストのフィードバック、まとめました！後ほど共有します。',
  },
]

const conversation = ref<ChatMessage[]>([...baseMessages])
const typing = ref(false)
let presenceTimer: number | undefined
let demoTimer: number | undefined
let queueIndex = 0

onMounted(() => {
  presenceTimer = window.setInterval(() => {
    onlineMembers.value = onlineMembers.value === 8 ? 9 : 8
  }, 8000)

  demoTimer = window.setInterval(() => {
    if (!demoQueue.length) return
    const index = queueIndex % demoQueue.length
    const next = demoQueue[index]
    if (!next) return
    queueIndex += 1
    typing.value = true
    window.setTimeout(() => {
      const stamped: ChatMessage = {
        ...next,
        time: new Date().toTimeString().slice(0, 5),
        highlight: true,
      }
      const updated = [...conversation.value, stamped]
      conversation.value = updated
      typing.value = false
      window.setTimeout(() => {
        const followUp = [...conversation.value]
        const targetIndex = updated.length - 1
        if (followUp[targetIndex]) {
          followUp[targetIndex] = { ...followUp[targetIndex], highlight: false }
          conversation.value = followUp
        }
      }, 2500)
    }, 1400)
  }, 9500)
})

onBeforeUnmount(() => {
  if (presenceTimer) window.clearInterval(presenceTimer)
  if (demoTimer) window.clearInterval(demoTimer)
})
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

.chat__close {
  border: none;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.15);
  color: var(--primary-strong);
  cursor: pointer;
}

.chat__messages {
  list-style: none;
  margin: 0;
  padding: 1.5rem 1.5rem 0.75rem;
  display: grid;
  gap: 1rem;
  max-height: 320px;
  overflow-y: auto;
}

.chat__messages li {
  padding: 1rem;
  border-radius: 1rem;
  background: rgba(184, 227, 233, 0.28);
  display: grid;
  gap: 0.4rem;
  transition: background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.chat__messages--update {
  border: 1px solid rgba(79, 124, 130, 0.4);
  background: rgba(184, 227, 233, 0.4);
}

.chat__messages li.is-highlight {
  background: rgba(184, 227, 233, 0.6);
  box-shadow: 0 16px 28px rgba(11, 46, 51, 0.15);
  transform: translateY(-2px);
}

.chat__messages header {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.chat__author {
  font-weight: 600;
  color: var(--text-strong);
}

.chat__messages p {
  margin: 0;
  color: var(--text);
  line-height: 1.6;
}

.chat__footer {
  margin-top: auto;
  display: flex;
  gap: 0.75rem;
  padding: 1.5rem 1.5rem 1.5rem;
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

.chat__typing {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 1.5rem 0.75rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.chat__typing-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.75);
  animation: typing 1.2s infinite ease-in-out;
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
    transform: translateY(-0.25rem);
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
