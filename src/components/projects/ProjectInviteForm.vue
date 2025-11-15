<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/store/auth'
import { buildInviteMailTo, createProjectInvite } from '@/services/projectInvites'

interface InviteField {
  email: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: InviteField[]
    mode?: 'collect' | 'send'
    projectId?: string
    label?: string
  }>(),
  {
    modelValue: () => [{ email: '' }],
    mode: 'collect',
    label: 'メンバー招待',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: InviteField[]): void
  (e: 'sent', emails: string[]): void
}>()

const { user } = useAuthStore()
const inviteFields = ref<InviteField[]>(props.modelValue?.length ? props.modelValue : [{ email: '' }])
const sending = ref(false)
const message = ref('')

watch(
  () => props.modelValue,
  (val) => {
    if (props.mode === 'collect' && val) {
      inviteFields.value = val.length ? val.map((item) => ({ ...item })) : [{ email: '' }]
    }
  },
  { deep: true },
)

watch(
  inviteFields,
  (val) => {
    if (props.mode === 'collect') {
      emit('update:modelValue', val)
    }
  },
  { deep: true },
)

const validEmails = computed(() => inviteFields.value.map((field) => field.email.trim()).filter(Boolean))

function addField() {
  inviteFields.value.push({ email: '' })
}

function removeField(index: number) {
  inviteFields.value.splice(index, 1)
  if (!inviteFields.value.length) {
    inviteFields.value.push({ email: '' })
  }
}

async function handleSendInvites() {
  if (props.mode !== 'send' || !props.projectId) {
    return
  }
  if (!user.value) {
    message.value = '招待するにはログインが必要です。'
    return
  }
  const emails = validEmails.value
  if (!emails.length) {
    message.value = 'メールアドレスを入力してください。'
    return
  }

  sending.value = true
  message.value = ''
  try {
    for (const email of emails) {
      const token = await createProjectInvite({ projectId: props.projectId, email, createdBy: user.value.uid })
      if (typeof window !== 'undefined') {
        const mailto = buildInviteMailTo(token, email)
        window.open(mailto, '_blank')
      }
    }
    inviteFields.value = [{ email: '' }]
    emit('sent', emails)
    message.value = `${emails.length}件の招待リンクを作成しました。メール画面が開かない場合は手動でリンクを共有してください。`
  } catch (error) {
    console.error(error)
    message.value = '招待の作成に失敗しました。後でもう一度お試しください。'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="invite-card">
    <header>
      <h3>{{ props.label }}</h3>
      <p v-if="props.mode === 'collect'">作成後に自動で招待リンクを送信します。</p>
      <p v-else>メールアドレスを入力して、すぐに招待リンクを送信できます。</p>
    </header>

    <div class="invite-fields">
      <div v-for="(field, index) in inviteFields" :key="index" class="invite-field">
        <input
          v-model="field.email"
          type="email"
          placeholder="メールアドレスを入力"
          :disabled="sending && props.mode === 'send'"
        />
        <button type="button" class="invite-remove" @click="removeField(index)" :disabled="inviteFields.length === 1">×</button>
      </div>
    </div>

    <div class="invite-actions">
      <button type="button" class="invite-add" @click="addField">＋ メンバーを追加</button>
      <button
        v-if="props.mode === 'send'"
        type="button"
        class="invite-send"
        :disabled="sending"
        @click="handleSendInvites"
      >
        {{ sending ? '送信中...' : '招待メールを送信' }}
      </button>
    </div>

    <p v-if="message" class="invite-message">{{ message }}</p>
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
  margin: 0.25rem 0 0;
  color: #4f7c82;
  font-size: 0.9rem;
}

.invite-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.invite-field {
  display: flex;
  gap: 0.5rem;
}

.invite-field input {
  flex: 1;
  border: 2px solid #b8e3e9;
  border-radius: 0.9rem;
  padding: 0.75rem 1rem;
  font-size: 1rem;
}

.invite-field input:focus {
  outline: none;
  border-color: #4f7c82;
  box-shadow: 0 0 0 3px rgba(79, 124, 130, 0.2);
}

.invite-remove {
  border: none;
  background: #f3f5f5;
  border-radius: 0.8rem;
  padding: 0 0.85rem;
  font-size: 1.1rem;
  cursor: pointer;
}

.invite-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.invite-add,
.invite-send {
  border-radius: 0.85rem;
  padding: 0.65rem 1rem;
  font-weight: 600;
  cursor: pointer;
}

.invite-add {
  border: 1px dashed #4f7c82;
  color: #4f7c82;
  background: transparent;
}

.invite-send {
  border: none;
  background: linear-gradient(90deg, #4f7c82, #0b2e33);
  color: #fff;
}

.invite-message {
  margin: 0;
  color: #0b2e33;
  font-weight: 600;
}
</style>
