<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'

export interface DemoTaskItem {
  id?: string
  title: string
  description: string
  status: '未着手' | '進行中' | 'レビュー' | '完了'
  priority: '高' | '中' | '低'
  due: string
  assignee: string
  comments?: number
}

export interface BoardColumn {
  key: string
  title: string
  badge?: string
  tasks: DemoTaskItem[]
}

const props = defineProps<{
  columns?: BoardColumn[]
  selectedTaskId?: string | null
  interactive?: boolean
}>()

const emit = defineEmits<{ (e: 'create'): void; (e: 'select', taskId: string): void; (e: 'change-status', payload: { taskId: string; status: string }): void }>()

const fallbackColumns: BoardColumn[] = [
  {
    key: 'todo',
    title: '未着手',
    tasks: [
      {
        title: 'データベース設計レビュー',
        description: '認証まわりのテーブル設計を確認',
        status: '未着手',
        priority: '中',
        due: '2025-11-12',
        assignee: '鈴木一郎',
        comments: 3,
      },
      {
        title: 'APIドキュメント作成',
        description: '社内共有用のエンドポイント一覧',
        status: '未着手',
        priority: '低',
        due: '2025-11-15',
        assignee: '高橋美咲',
        comments: 6,
      },
    ],
  },
  {
    key: 'progress',
    title: '進行中',
    badge: '2',
    tasks: [
      {
        title: 'トップページのデザイン作成',
        description: 'コンポーネントガイドラインに合わせる',
        status: '進行中',
        priority: '高',
        due: '2025-11-10',
        assignee: '田中太郎',
        comments: 5,
      },
      {
        title: 'ユーザー認証機能の実装',
        description: 'Firebase Auth + ロール権限',
        status: '進行中',
        priority: '高',
        due: '2025-11-08',
        assignee: '佐藤花子',
        comments: 12,
      },
    ],
  },
  {
    key: 'review',
    title: 'レビュー',
    badge: '3',
    tasks: [
      {
        title: 'コンテンツ校正',
        description: 'ブログ用コピーを最終チェック',
        status: 'レビュー',
        priority: '中',
        due: '2025-11-09',
        assignee: '山本大輔',
        comments: 4,
      },
    ],
  },
  {
    key: 'done',
    title: '完了',
    badge: '0',
    tasks: [],
  },
]

const columns = computed(() => (props.columns && props.columns.length ? props.columns : fallbackColumns))
const isDemo = computed(() => !props.columns || !props.columns.length)
const isInteractive = computed(() => !isDemo.value && props.interactive !== false)
const activeTask = ref<DemoTaskItem | null>(null)
const focusTrail = ref<number[]>([])
const autoHighlightTimer = ref<number>()
const draggingTask = ref<DemoTaskItem | null>(null)

const flattenedTasks = computed(() => columns.value.flatMap((column) => column.tasks))

function openTask(task: DemoTaskItem) {
  if (isInteractive.value) {
    if (task.id) emit('select', task.id)
    return
  }
  activeTask.value = task
  stopAutoHighlight()
}

function closeTask() {
  activeTask.value = null
}

function stopAutoHighlight() {
  if (autoHighlightTimer.value) {
    window.clearInterval(autoHighlightTimer.value)
    autoHighlightTimer.value = undefined
  }
  focusTrail.value = []
}

function handleDrop(columnKey: string) {
  if (!draggingTask.value || !isInteractive.value) return
  if (draggingTask.value.id) {
    emit('change-status', { taskId: draggingTask.value.id, status: columnKey })
  }
  draggingTask.value = null
}

onMounted(() => {
  if (isDemo.value) {
    let cursor = 0
    autoHighlightTimer.value = window.setInterval(() => {
      const list = flattenedTasks.value
      if (!list.length) return
      const index = cursor % list.length
      const nextTask = list[index]
      if (nextTask) {
        activeTask.value = nextTask
        focusTrail.value = [index]
        cursor += 1
      }
    }, 7000)
  }
})

onBeforeUnmount(() => {
  stopAutoHighlight()
})
</script>

<template>
  <section class="board">
    <div class="board__header">
      <h2>タスク管理</h2>
      <button type="button" class="board__new" @click="emit('create')">＋ 新規タスク</button>
    </div>

    <div class="board__columns">
      <article v-for="column in columns" :key="column.key" class="board-column">
        <header class="board-column__header">
          <h3>{{ column.title }}</h3>
          <span v-if="column.badge" class="badge">{{ column.badge }}</span>
        </header>

        <p v-if="column.tasks.length === 0" class="board-column__empty">
          完了したタスクはまだありません。
        </p>

        <div v-else class="board-column__tasks" @dragover.prevent @drop.prevent="handleDrop(column.key)">
          <article
            v-for="task in column.tasks"
            :key="task.id || task.title"
            class="task-card"
            :class="{
              'is-selected': activeTask?.title === task.title,
              'is-highlight': focusTrail[0] !== undefined && flattenedTasks[focusTrail[0]]?.title === task.title,
            }"
            role="button"
            tabindex="0"
            :draggable="isInteractive && !!task.id"
            @dragstart="isInteractive ? (draggingTask.value = task) : undefined"
            @click="openTask(task)"
            @keydown.enter.prevent="openTask(task)"
          >
            <div class="task-card__head">
              <h4>{{ task.title }}</h4>
              <span class="priority" :class="`priority--${task.priority}`">{{ task.priority }}</span>
            </div>
            <p class="task-card__description">{{ task.description }}</p>
            <dl class="task-card__meta">
              <div>
                <dt>期限</dt>
                <dd>{{ task.due }}</dd>
              </div>
              <div>
                <dt>担当</dt>
                <dd>{{ task.assignee }}</dd>
              </div>
              <div>
                <dt>コメント</dt>
                <dd>{{ task.comments }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </article>
    </div>

    <transition name="task-detail">
      <div v-if="activeTask && isDemo" class="task-detail" role="dialog" aria-modal="true">
        <div class="task-detail__header">
          <h3>{{ activeTask.title }}</h3>
          <button type="button" class="task-detail__close" @click="closeTask" aria-label="閉じる">
            ×
          </button>
        </div>
        <p class="task-detail__description">{{ activeTask.description }}</p>
        <dl class="task-detail__grid">
          <div>
            <dt>ステータス</dt>
            <dd>{{ activeTask.status }}</dd>
          </div>
          <div>
            <dt>優先度</dt>
            <dd>{{ activeTask.priority }}</dd>
          </div>
          <div>
            <dt>期限</dt>
            <dd>{{ activeTask.due }}</dd>
          </div>
          <div>
            <dt>担当者</dt>
            <dd>{{ activeTask.assignee }}</dd>
          </div>
          <div>
            <dt>コメント</dt>
            <dd>{{ activeTask.comments }}</dd>
          </div>
        </dl>
        <p class="task-detail__hint">※ このデモではカードをクリックすると詳細が開きます。実際の Teamie ではさらにサブタスクやコメントを閲覧できます。</p>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.board__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.25rem;
}

.board__header h2 {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-strong);
}

.board__new {
  border: none;
  border-radius: 0.75rem;
  padding: 0.65rem 1.4rem;
  font-weight: 600;
  background: #4f7c82;
  color: var(--surface-elevated);
  cursor: pointer;
  box-shadow: 0 12px 20px rgba(79, 124, 130, 0.25);
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.board__new:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 24px rgba(79, 124, 130, 0.3);
}

.board__columns {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  position: relative;
}

.board-column {
  background: var(--surface-elevated);
  border-radius: 1.25rem;
  border: 1px solid var(--border-light);
  padding: 1.25rem;
  min-height: 320px;
  box-shadow: 0 14px 28px rgba(11, 46, 51, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.board-column__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.board-column__header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-strong);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.8rem;
  height: 1.8rem;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.18);
  color: var(--primary-strong);
  font-weight: 600;
  font-size: 0.85rem;
}

.board-column__empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.board-column__tasks {
  display: grid;
  gap: 1rem;
}

.task-card {
  border-radius: 1rem;
  border: 1px solid rgba(11, 46, 51, 0.1);
  padding: 1rem;
  background: rgba(184, 227, 233, 0.2);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.task-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.task-card__head h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-strong);
}

.task-card__description {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.task-card__meta {
  margin: 0;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.task-card__meta div {
  display: flex;
  flex-direction: column;
  min-width: 90px;
}

.task-card__meta dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.task-card__meta dd {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
  color: var(--text);
}

.priority {
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--surface-elevated);
}

.priority--高 {
  background: #0b2e33;
}
.priority--中 {
  background: rgba(79, 124, 130, 0.85);
}
.priority--低 {
  background: rgba(147, 177, 181, 0.8);
}

.task-card:hover {
  transform: translateY(-2px);
  border-color: rgba(79, 124, 130, 0.4);
  box-shadow: 0 16px 26px rgba(11, 46, 51, 0.12);
}

.task-card.is-selected {
  border-color: rgba(11, 46, 51, 0.5);
  box-shadow: 0 22px 34px rgba(11, 46, 51, 0.18);
  background: rgba(184, 227, 233, 0.35);
}

.task-card.is-highlight {
  animation: pulse 1.4s ease-in-out infinite alternate;
}

@keyframes pulse {
  from {
    transform: translateY(-2px);
  }
  to {
    transform: translateY(-6px);
  }
}

.task-detail-enter-active,
.task-detail-leave-active {
  transition: opacity 200ms ease;
}

.task-detail-enter-from,
.task-detail-leave-to {
  opacity: 0;
}

.task-detail {
  margin-top: 0.5rem;
  border-radius: 1.5rem;
  background: var(--surface-elevated);
  border: 1px solid rgba(11, 46, 51, 0.12);
  padding: 1.5rem;
  box-shadow: 0 20px 40px rgba(11, 46, 51, 0.16);
  display: grid;
  gap: 1rem;
}

.task-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.task-detail__header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.task-detail__close {
  border: none;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.18);
  color: var(--primary-strong);
  cursor: pointer;
}

.task-detail__description {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.7;
}

.task-detail__grid {
  margin: 0;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}

.task-detail__grid dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.task-detail__grid dd {
  margin: 0.2rem 0 0;
  font-weight: 600;
  color: var(--text-strong);
}

.task-detail__hint {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 0.9rem;
  background: rgba(184, 227, 233, 0.4);
  color: var(--text-muted);
  font-size: 0.85rem;
}

@media (max-width: 960px) {
  .board__columns {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }
}
</style>
