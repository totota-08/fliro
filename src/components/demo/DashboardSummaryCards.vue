<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export interface SummaryCard {
  id: string
  label: string
  value: number | string
  caption: string
  tone?: 'neutral' | 'alert'
}

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    note?: string
    cards?: SummaryCard[]
    rotate?: boolean
  }>(),
  {
    title: 'Webサイトリニューアル',
    description: '今週の状況をひと目で確認できます。',
    note: '※ デモデータです。本番環境では実際の計測値が反映されます。',
    rotate: true,
  },
)

const defaultCards: SummaryCard[] = [
  { id: 'progress', label: '進捗率', value: 68, caption: '計画タスクの達成率' },
  { id: 'done', label: '完了', value: 24, caption: '完了済みタスク数' },
  { id: 'active', label: '進行中', value: 8, caption: '現在進行中のタスク' },
  { id: 'overdue', label: '期限切れ', value: 3, caption: '期限超過タスク', tone: 'alert' },
]

const cardList = computed(() => (props.cards?.length ? props.cards : defaultCards))
const isDemo = computed(() => !props.cards || props.cards.length === 0)
const activeCardIndex = ref(0)
const progressValue = ref<number>(Number(cardList.value.find((card) => card.id === 'progress')?.value) || 0)
let highlightTimer: number | undefined
let progressTimer: number | undefined
let progressDirection = 1

onMounted(() => {
  if (props.rotate && isDemo.value) {
    highlightTimer = window.setInterval(() => {
      activeCardIndex.value = (activeCardIndex.value + 1) % cardList.value.length
    }, 3800)

    progressTimer = window.setInterval(() => {
      progressValue.value += progressDirection
      if (progressValue.value >= Number(defaultCards[0].value) + 4 || progressValue.value <= Number(defaultCards[0].value) - 4) {
        progressDirection = -progressDirection
      }
    }, 1200)
  } else {
    activeCardIndex.value = 0
    progressValue.value = Number(cardList.value.find((card) => card.id === 'progress')?.value) || 0
  }
})

onBeforeUnmount(() => {
  if (highlightTimer) window.clearInterval(highlightTimer)
  if (progressTimer) window.clearInterval(progressTimer)
})
</script>

<template>
  <section class="summary">
    <header class="summary__header">
      <div>
        <h2>{{ props.title }}</h2>
        <p>{{ props.description }}</p>
      </div>
      <small v-if="props.note" class="summary__note">
        {{ props.note }}
      </small>
    </header>

    <div class="summary__grid">
      <article
        v-for="(card, index) in cardList"
        :key="card.id"
        class="summary-card"
        :class="{ 'is-alert': card.tone === 'alert', 'is-active': index === activeCardIndex }"
      >
        <p class="summary-card__label">{{ card.label }}</p>
        <p class="summary-card__value">
          <template v-if="card.id === 'progress' && isDemo">
            {{ progressValue }}%
          </template>
          <template v-else>
            {{ card.value }}
          </template>
        </p>
        <div v-if="card.id === 'progress'" class="summary-card__bar">
          <div
            class="summary-card__bar-fill"
            :style="{ width: `${card.id === 'progress' ? (isDemo ? progressValue : Number(card.value) || 0) : 0}%` }"
          />
        </div>
        <p class="summary-card__caption">{{ card.caption }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.summary__header {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  justify-content: space-between;
  padding: 1.75rem 2rem;
  border-radius: 1.5rem;
  background: var(--surface-elevated);
  border: 1px solid var(--border-light);
  box-shadow: 0 12px 28px rgba(11, 46, 51, 0.1);
}

.summary__header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-strong);
}

.summary__header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.summary__note {
  color: var(--text-muted);
  font-size: 0.78rem;
  background: rgba(184, 227, 233, 0.35);
  padding: 0.5rem 0.75rem;
  border-radius: 0.75rem;
}

.summary__grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.summary-card {
  background: var(--surface-elevated);
  border: 1px solid var(--border-light);
  border-radius: 1.25rem;
  padding: 1.5rem;
  box-shadow: 0 16px 30px rgba(11, 46, 51, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  transition: transform 240ms ease, box-shadow 240ms ease, border-color 240ms ease;
}

.summary-card__label {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.summary-card__value {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-strong);
}

.summary-card__caption {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.summary-card.is-alert {
  border-color: rgba(11, 46, 51, 0.25);
  box-shadow: 0 20px 34px rgba(11, 46, 51, 0.18);
}

.summary-card.is-alert .summary-card__value {
  color: #0b2e33;
}

.summary-card.is-active {
  transform: translateY(-4px);
  border-color: rgba(79, 124, 130, 0.45);
  box-shadow: 0 22px 36px rgba(11, 46, 51, 0.18);
}

.summary-card.is-active .summary-card__label {
  color: var(--primary);
}

.summary-card__bar {
  position: relative;
  height: 0.45rem;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.18);
  overflow: hidden;
  margin: 0.25rem 0 0.5rem;
}

.summary-card__bar-fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #4f7c82, rgba(11, 46, 51, 0.9));
  transition: width 400ms ease;
}

@media (max-width: 768px) {
  .summary__header {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
