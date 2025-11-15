<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { database } from '@/firebase/config'
import { onChildAdded, push, ref as dbRef, limitToLast, query } from 'firebase/database'
import { useAuthStore } from '@/store/auth'
import { consumeSecretAccess } from '@/services/secretAccess'
import { ROUTE_NAMES } from '@/constants/routes'

const messages = ref<{ id: string; text: string; author: string }[]>([])
const input = ref('')
const { profile } = useAuthStore()
const router = useRouter()
let unsubscribe: (() => void) | null = null

onMounted(() => {
  const access = consumeSecretAccess()
  if (access !== 'chat') {
    router.replace({ name: ROUTE_NAMES.myPage })
    return
  }
  const messagesRef = query(dbRef(database, 'secretChat/messages'), limitToLast(100))
  unsubscribe = onChildAdded(messagesRef, (snapshot) => {
    const data = snapshot.val() as { text: string; author: string }
    messages.value.push({ id: snapshot.key ?? '', text: data.text, author: data.author })
  })
})

onBeforeUnmount(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})

async function sendMessage() {
  if (!input.value.trim()) return
  await push(dbRef(database, 'secretChat/messages'), {
    text: input.value,
    author: profile.value?.nickname || profile.value?.fullName || 'Anonymous',
    createdAt: Date.now(),
  })
  input.value = ''
}
</script>

<template>
  <div class="chat-layout">
    <aside class="chat-sidebar">
      <div class="logo">TM</div>
      <nav>
        <button class="nav-btn active">💬</button>
        <button class="nav-btn">📁</button>
        <button class="nav-btn">⚙️</button>
      </nav>
      <button class="nav-btn nav-bottom" @click="router.push({ name: ROUTE_NAMES.myPage })">⇦</button>
    </aside>

    <div class="chat-panel">
      <section class="chat-list">
        <header>
          <h2>シークレットスレッド</h2>
          <p>隠しコマンドでのみ参加可能なチャンネル</p>
        </header>
        <div class="thread">
          <strong>Teamie Bot</strong>
          <span>秘密の作戦室</span>
        </div>
      </section>

      <section class="chat-room">
        <header class="chat-room__header">
          <div>
            <h1>Secret Console Chat</h1>
            <p>リアルタイムでメッセージを共有しましょう</p>
          </div>
        </header>
        <div class="chat-room__messages">
          <p v-for="message in messages" :key="message.id">
            <strong>{{ message.author }}</strong>
            <span>{{ message.text }}</span>
          </p>
        </div>
        <form class="chat-room__form" @submit.prevent="sendMessage">
          <input v-model="input" type="text" placeholder="メッセージを入力" />
          <button type="submit">送信</button>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.chat-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 80px 320px 1fr;
  background: #eef2f7;
}

.chat-sidebar {
  background: #0f172a;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 0;
  gap: 1.5rem;
}

.logo {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: linear-gradient(135deg, #5ee1e6, #5c7cfa);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #0b1020;
}

.nav-btn {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
}

.nav-btn.active {
  background: #1e2b4a;
}

.nav-bottom {
  margin-top: auto;
}

.chat-panel {
  display: grid;
  grid-template-columns: 320px 1fr;
}

.chat-list {
  padding: 2rem;
  background: #f8fafd;
  border-right: 1px solid #e1e8f0;
}

.chat-list header h2 {
  margin: 0;
}

.chat-list header p {
  margin: 0.35rem 0 0;
  color: #5b6b84;
}

.thread {
  margin-top: 1.5rem;
  border: 1px solid #dde5f2;
  border-radius: 1rem;
  padding: 1rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.thread strong {
  color: #0f172a;
}

.thread span {
  color: #64728c;
  font-size: 0.9rem;
}

.chat-room {
  display: flex;
  flex-direction: column;
  padding: 2rem;
  gap: 1.5rem;
}

.chat-room__header h1 {
  margin: 0;
  color: #0f172a;
}

.chat-room__header p {
  margin: 0.35rem 0 0;
  color: #5b6b84;
}

.chat-room__messages {
  flex: 1;
  background: #fff;
  border: 1px solid #e1e8f0;
  border-radius: 1rem;
  padding: 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chat-room__messages p {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: #0f172a;
}

.chat-room__messages span {
  color: #475569;
}

.chat-room__form {
  display: flex;
  gap: 0.75rem;
}

.chat-room__form input {
  flex: 1;
  border: 1px solid #d6e0ef;
  border-radius: 0.9rem;
  padding: 0.85rem 1rem;
}

.chat-room__form button {
  border: none;
  border-radius: 0.9rem;
  padding: 0.85rem 1.5rem;
  background: linear-gradient(90deg, #5ee1e6, #5c7cfa);
  color: #0f172a;
  font-weight: 600;
}

@media (max-width: 960px) {
  .chat-layout {
    grid-template-columns: 60px 1fr;
  }
  .chat-panel {
    grid-template-columns: 1fr;
  }
  .chat-list {
    border-right: none;
  }
}
</style>
