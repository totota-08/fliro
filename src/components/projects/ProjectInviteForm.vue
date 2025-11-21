<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/store/auth'
import { createProjectInvite } from '@/services/projectInvites'

const props = withDefaults(
  defineProps<{
    projectId: string
    label?: string
  }>(),
  {
    label: 'プロジェクト参加リンク',
  },
)

const emit = defineEmits<{
  (e: 'generated', link: string): void
}>()

const { user } = useAuthStore()
const enablePassword = ref(false)
const password = ref('')
const generating = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const generatedLink = ref('')

async function handleGenerate() {
  if (!user.value) {
    errorMessage.value = 'リンクを作成するにはログインが必要です。'
    return
  }
  if (!props.projectId) {
    errorMessage.value = 'プロジェクトIDが無効です。'
    return
  }
  if (enablePassword.value && password.value.trim().length < 4) {
    errorMessage.value = 'パスワードは4文字以上で入力してください。'
    return
  }
  generating.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const token = await createProjectInvite({
      projectId: props.projectId,
      createdBy: user.value.uid,
      password: enablePassword.value ? password.value.trim() : null,
    })
    const link = typeof window !== 'undefined' ? `${window.location.origin}/invite/${token}` : token
    generatedLink.value = link
    successMessage.value = '共有リンクを作成しました。コピーしてメンバーに共有してください。'
    emit('generated', link)
    if (!enablePassword.value) {
      password.value = ''
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = 'リンクの生成に失敗しました。時間をおいてもう一度お試しください。'
  } finally {
    generating.value = false
  }
}

async function copyLink() {
  if (!generatedLink.value) return
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      throw new Error('Clipboard API unavailable')
    }
    await navigator.clipboard.writeText(generatedLink.value)
    successMessage.value = 'リンクをコピーしました。'
  } catch (error) {
    console.warn('Failed to copy link', error)
    const fallbackSuccess = tryFallbackCopy(generatedLink.value)
    if (fallbackSuccess) {
      successMessage.value = 'リンクをコピーしました。'
    } else {
      errorMessage.value = 'コピーに失敗しました。リンクを手動で選択してください。'
    }
  }
}

function tryFallbackCopy(text: string) {
  if (typeof document === 'undefined') return false
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  let success = false
  try {
    success = document.execCommand('copy')
  } catch (error) {
    success = false
  } finally {
    document.body.removeChild(textarea)
  }
  return success
}
</script>

<template>
  <div class="invite-card">
    <header>
      <h3>{{ props.label }}</h3>
      <p>リンクを共有するとプロジェクトへ参加できます。必要に応じてパスワードを設定してください。</p>
    </header>

    <div class="invite-options">
      <label class="toggle">
        <input type="checkbox" v-model="enablePassword" />
        <span>パスワードを設定する</span>
      </label>

      <input
        v-if="enablePassword"
        v-model="password"
        type="password"
        placeholder="共有用パスワード（4文字以上）"
      />
    </div>

    <div class="invite-actions">
      <button type="button" :disabled="generating" @click="handleGenerate">
        {{ generating ? '生成中...' : '参加リンクを生成' }}
      </button>
    </div>

    <div v-if="generatedLink" class="invite-result">
      <label>共有リンク</label>
      <div class="link-box">
        <span>{{ generatedLink }}</span>
        <button type="button" @click="copyLink">コピー</button>
      </div>
      <p v-if="enablePassword" class="password-note">
        ※ パスワードはリンクとは別に安全な経路で共有してください。
      </p>
    </div>

    <p v-if="errorMessage" class="invite-error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="invite-message">{{ successMessage }}</p>
  </div>
</template>

<style scoped>
.invite-card {
  border: 2px dashed #b8e3e9;
  border-radius: 1.25rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.invite-card header h3 {
  margin: 0;
  color: #0b2e33;
}

.invite-card header p {
  margin: 0.35rem 0 0;
  color: #4f7c82;
  font-size: 0.9rem;
}

.invite-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #0b2e33;
}

.invite-options input[type='password'] {
  border: 2px solid #b8e3e9;
  border-radius: 0.9rem;
  padding: 0.75rem 1rem;
  font-size: 1rem;
}

.invite-actions button {
  border: none;
  border-radius: 0.95rem;
  padding: 0.75rem 1.25rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(90deg, #4f7c82, #0b2e33);
  cursor: pointer;
}

.invite-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.invite-result {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.invite-result label {
  font-weight: 600;
  color: #0b2e33;
}

.link-box {
  border: 1px solid #b8e3e9;
  border-radius: 0.9rem;
  padding: 0.65rem;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  background: #f5fbfb;
  font-size: 0.9rem;
  word-break: break-all;
}

.link-box button {
  border: none;
  background: transparent;
  color: #0b2e33;
  font-weight: 600;
  cursor: pointer;
}

.password-note {
  margin: 0;
  font-size: 0.85rem;
  color: #4f7c82;
}

.invite-error {
  margin: 0;
  color: #d64545;
  font-weight: 600;
}

.invite-message {
  margin: 0;
  color: #0b2e33;
  font-weight: 600;
}
</style>
