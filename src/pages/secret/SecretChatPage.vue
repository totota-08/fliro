<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { database } from '@/firebase/config'
import { onChildAdded, push, ref as dbRef, limitToLast, query } from 'firebase/database'
import { useAuthStore } from '@/store/auth'

const messages = ref<{ id: string; text: string; author: string }[]>([])
const input = ref('')
const { profile } = useAuthStore()
let unsubscribe: (() => void) | null = null

onMounted(() => {
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
  <div class="secret-shell">
    <section class="secret-card">
      <p class="eyebrow">Easter Egg</p>
      <h1>Secret Console Chat</h1>
      <div class="chat-log">
        <p v-for="message in messages" :key="message.id">
          <strong>{{ message.author }}:</strong> {{ message.text }}
        </p>
      </div>
      <form class="chat-form" @submit.prevent="sendMessage">
        <input v-model="input" type="text" placeholder="メッセージを入力" />
        <button type="submit">送信</button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.secret-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0b0d12;
  padding: 2rem;
  color: #e6f1ff;
}

.secret-card {
  width: min(600px, 100%);
  background: #131722;
  border: 1px solid #202637;
  border-radius: 1rem;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.eyebrow {
  margin: 0;
  letter-spacing: 0.3em;
  color: #5ee1e6;
}

h1 { margin: 0; }

.chat-log {
  background: #0d101a;
  border: 1px solid #1c2336;
  border-radius: 0.8rem;
  padding: 1rem;
  max-height: 320px;
  overflow-y: auto;
  font-family: 'Fira Code', monospace;
}

.chat-log p {
  margin: 0 0 0.5rem;
}

.chat-form {
  display: flex;
  gap: 0.75rem;
}

.chat-form input {
  flex: 1;
  border: 1px solid #2c354d;
  border-radius: 0.75rem;
  background: #0d101a;
  color: #e6f1ff;
  padding: 0.65rem 1rem;
}

.chat-form button {
  border: none;
  border-radius: 0.75rem;
  background: linear-gradient(90deg, #5ee1e6, #5c7cfa);
  color: #0b0d12;
  padding: 0.65rem 1.25rem;
  font-weight: 600;
  cursor: pointer;
}
</style>
