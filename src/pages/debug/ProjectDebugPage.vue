<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import { fetchProject } from '@/firebase/projectService'
import { ROUTE_NAMES } from '@/constants/routes'
import ProjectInviteForm from '@/components/projects/ProjectInviteForm.vue'

const route = useRoute()
const router = useRouter()
const projectId = String(route.params.projectId || '')

const loading = ref(true)
const errorMsg = ref('')
const project = ref<any | null>(null)
const inviteMessage = ref('')

onMounted(async () => {
  try {
    project.value = await fetchProject(projectId)
    if (!project.value) {
      errorMsg.value = 'プロジェクトが見つかりません。'
    }
  } catch (e) {
    console.error(e)
    errorMsg.value = 'プロジェクトの取得に失敗しました。'
  } finally {
    loading.value = false
  }
})

const projectTitle = computed(() => project.value?.name ?? 'プロジェクト')
function formatDate(value: any) {
  if (!value) return '-'
  if (value.seconds) {
    return new Date(value.seconds * 1000).toLocaleDateString()
  }
  try {
    return new Date(value).toLocaleDateString()
  } catch (error) {
    return '-'
  }
}

const infoRows = computed(() => {
  if (!project.value) return []
  return [
    { label: 'ステータス', value: project.value.status },
    { label: '公開設定', value: project.value.settings?.isPublic ? '公開' : '非公開' },
    { label: 'ゲスト閲覧', value: project.value.settings?.allowGuestView ? '有効' : '無効' },
    { label: '開始日', value: formatDate(project.value.startDate) },
    { label: '期限', value: formatDate(project.value.dueDate) },
  ]
})
</script>

<template>
  <div class="project-debug-shell">
    <section class="debug-summary" v-if="!loading && !errorMsg">
      <div>
        <p class="debug-eyebrow">Project Debug</p>
        <h1>{{ projectTitle }}</h1>
        <p class="debug-sub">ID: {{ projectId }}</p>
      </div>
      <dl>
        <div v-for="row in infoRows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <div class="debug-actions">
        <AppButton :to="{ name: ROUTE_NAMES.projectCreate }" variant="primary">新しいプロジェクト</AppButton>
        <AppButton :to="{ name: ROUTE_NAMES.myPage }" variant="secondary">マイページへ</AppButton>
      </div>
    </section>

    <section v-if="loading" class="debug-panel">読み込み中...</section>
    <p v-else-if="errorMsg" class="error">{{ errorMsg }}</p>

    <section v-else class="debug-panel">
      <h2>メンバー招待</h2>
      <ProjectInviteForm :project-id="projectId" mode="send" label="メールアドレス" @sent="inviteMessage = `招待を送信しました。`" />
      <p v-if="inviteMessage" class="info">{{ inviteMessage }}</p>
    </section>

    <section v-if="!loading && !errorMsg" class="debug-panel">
      <h2>Raw JSON</h2>
      <pre>{{ JSON.stringify(project, null, 2) }}</pre>
    </section>
  </div>
</template>

<style scoped>
.project-debug-shell {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 2rem;
  max-width: 960px;
  margin: 0 auto;
}

.debug-summary {
  background: linear-gradient(135deg, #0b2e33, #4f7c82);
  color: #fff;
  border-radius: 1.5rem;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.debug-eyebrow {
  margin: 0;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 600;
  color: #b8e3e9;
}

.debug-summary h1 {
  margin: 0;
  font-size: clamp(1.5rem, 2vw, 2.5rem);
}

.debug-sub {
  margin: 0;
  color: #e3f6f8;
}

.debug-summary dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem 1rem;
  margin: 0;
}

.debug-summary dt {
  font-size: 0.85rem;
  color: #c6ecf0;
}

.debug-summary dd {
  margin: 0;
  font-weight: 600;
}

.debug-actions {
  display: flex;
  gap: 0.75rem;
}

.debug-panel {
  background: #fff;
  border: 2px solid #b8e3e9;
  border-radius: 1.25rem;
  padding: 1.5rem;
}

pre {
  margin: 0;
  padding: 1rem;
  background: #f8fbfb;
  border-radius: 0.75rem;
  font-size: 0.9rem;
  overflow-x: auto;
}

.info {
  color: #0b2e33;
  font-weight: 600;
}

.error { color: #d64545; font-weight: 600; }
</style>
