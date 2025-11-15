<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ROUTE_NAMES } from '@/constants/routes'
import { grantSecretAccess } from '@/services/secretAccess'

const router = useRouter()
const command = ref('')
const message = ref('')

function handleSubmit() {
  const value = command.value.trim().toLowerCase()
  if (value === 'chat') {
    grantSecretAccess('chat')
    router.push({ name: ROUTE_NAMES.secretChat })
    return
  }
  message.value = 'Access denied'
}
</script>

<template>
  <div class="secret-access-shell">
    <section class="secret-access-card">
      <header>
        <p>Hidden Console</p>
        <h1>Enter the secret key</h1>
      </header>
      <form class="command-form" @submit.prevent="handleSubmit">
        <label>secret key
          <input v-model="command" type="text"/>
        </label>
        <button type="submit">アクセス</button>
      </form>
      <p v-if="message" class="error">{{ message }}</p>
    </section>
  </div>
</template>

<style scoped>
.secret-access-shell {
  min-height: 100vh;
  background: #05070d;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #e6f1ff;
}

.secret-access-card {
  width: min(460px, 100%);
  border: 1px solid #1f2840;
  border-radius: 1.5rem;
  background: #0f1524;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

header p:first-child {
  letter-spacing: 0.35em;
  text-transform: uppercase;
  margin: 0;
  color: #5ee1e6;
}

header h1 {
  margin: 0.25rem 0;
}

.subtitle {
  margin: 0;
  color: #9bbad4;
}

.command-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

input {
  width: 100%;
  border: 1px solid #2d3956;
  border-radius: 0.9rem;
  padding: 0.75rem 1rem;
  background: #070b14;
  color: inherit;
}

button {
  border: none;
  border-radius: 0.9rem;
  padding: 0.8rem;
  background: linear-gradient(90deg, #5ee1e6, #5c7cfa);
  color: #05070d;
  font-weight: 600;
  cursor: pointer;
}

.error {
  color: #ff7a7a;
  margin: 0;
}
</style>
