<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

interface SummaryCard {
  id: string;
  label: string;
  value: string;
  caption: string;
  tone?: "neutral" | "alert";
}

const cards: SummaryCard[] = [
  {
    id: "progress",
    label: "進捗率",
    value: "68%",
    caption: "計画タスクの達成率",
  },
  { id: "done", label: "完了", value: "24", caption: "完了済みタスク数" },
  { id: "active", label: "進行中", value: "8", caption: "現在進行中のタスク" },
  {
    id: "overdue",
    label: "期限切れ",
    value: "3",
    caption: "期限超過タスク",
    tone: "alert",
  },
];

const activeCardIndex = ref(0);
const progressValue = ref(68);
let highlightTimer: number | undefined;
let progressTimer: number | undefined;
let progressDirection = 1;

onMounted(() => {
  highlightTimer = window.setInterval(() => {
    activeCardIndex.value = (activeCardIndex.value + 1) % cards.length;
  }, 3800);

  progressTimer = window.setInterval(() => {
    progressValue.value += progressDirection;
    if (progressValue.value >= 72 || progressValue.value <= 62) {
      progressDirection = -progressDirection;
    }
  }, 1200);
});

onBeforeUnmount(() => {
  if (highlightTimer) window.clearInterval(highlightTimer);
  if (progressTimer) window.clearInterval(progressTimer);
});
</script>

<template>
  <section class="summary">
    <header class="summary__header">
      <div>
        <h2>Webサイトリニューアル</h2>
        <p>今週の状況をひと目で確認できます。</p>
      </div>
      <small class="summary__note">
        ※ デモデータです。本番環境では実際の計測値が反映されます。
      </small>
    </header>

    <div class="summary__grid">
      <article
        v-for="(card, index) in cards"
        :key="card.id"
        class="summary-card"
        :class="{
          'is-alert': card.tone === 'alert',
          'is-active': index === activeCardIndex,
        }"
      >
        <div class="summary-card__content">
          <div class="summary-card__info">
            <p class="summary-card__label">{{ card.label }}</p>
            <p class="summary-card__caption">{{ card.caption }}</p>
          </div>
          <div class="summary-card__value-block">
            <p class="summary-card__value">
              {{ card.id === "progress" ? `${progressValue}%` : card.value }}
            </p>
            <div v-if="card.id === 'progress'" class="summary-card__bar">
              <div
                class="summary-card__bar-fill"
                :style="{ width: `${progressValue}%` }"
              />
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
}

.summary__header {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-6, 1.5rem);
  justify-content: space-between;
  padding: var(--ui-space-6, 1.5rem) var(--ui-space-8, 2rem);
  border-radius: var(--ui-radius-2xl, 1.5rem);
  background: var(--ui-surface-elevated, #fff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-lg, 0 12px 24px rgba(11, 46, 51, 0.1));
}

.summary__header h2 {
  margin: 0;
  font-size: var(--ui-text-2xl, 1.5rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.summary__header p {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-text-muted, #64748b);
}

.summary__note {
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-xs, 0.75rem);
  background: var(--ui-surface-accent, rgba(184, 227, 233, 0.35));
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-md, 0.75rem);
}

.summary__grid {
  display: grid;
  gap: var(--ui-space-4, 1rem);
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.summary-card {
  background: var(--ui-surface-elevated, #fff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-3, 0.75rem);
  box-shadow: var(--ui-shadow-md, 0 4px 12px rgba(11, 46, 51, 0.08));
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  transition: var(--ui-transition-all, all 180ms ease);
}

.summary-card__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2, 0.5rem);
}

.summary-card__info {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  min-width: 0;
}

.summary-card__value-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--ui-space-1, 0.25rem);
  min-width: 5.75rem;
}

.summary-card__label {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  color: var(--ui-text-muted, #64748b);
}

.summary-card__value {
  margin: 0;
  font-size: var(--ui-text-3xl, 1.875rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
  line-height: var(--ui-leading-tight, 1.25);
  text-align: right;
}

.summary-card__caption {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.summary-card.is-alert {
  border-color: var(--ui-border-strong, rgba(11, 46, 51, 0.2));
  box-shadow: var(--ui-shadow-xl, 0 20px 40px rgba(11, 46, 51, 0.12));
}

.summary-card.is-alert .summary-card__value {
  color: var(--ui-brand-900, #0b2e33);
}

.summary-card.is-active {
  transform: translateY(-4px);
  border-color: var(--ui-brand-400, #8cb8be);
  box-shadow: var(--ui-shadow-xl, 0 20px 40px rgba(11, 46, 51, 0.12));
}

.summary-card.is-active .summary-card__label {
  color: var(--ui-brand-600, #4f7c82);
}

.summary-card__bar {
  position: relative;
  height: 0.32rem;
  width: 100%;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-200, rgba(79, 124, 130, 0.18));
  overflow: hidden;
  margin-top: var(--ui-space-1, 0.25rem);
}

.summary-card__bar-fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    var(--ui-brand-600, #4f7c82),
    var(--ui-brand-900, #0b2e33)
  );
  transition: width 400ms var(--ui-ease-standard, ease);
}

@media (prefers-reduced-motion: reduce) {
  .summary-card {
    transition: none;
  }
  .summary-card__bar-fill {
    transition: none;
  }
}

@media (max-width: 768px) {
  .summary__header {
    flex-direction: column;
    gap: var(--ui-space-4, 1rem);
  }
}
</style>
