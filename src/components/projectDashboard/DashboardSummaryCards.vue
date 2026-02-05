<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { DashboardCardConfig } from "@/services/dashboardSettingsService";

export interface SummaryCard {
  id: string;
  label: string;
  value: number | string;
  caption: string;
  tone?: "neutral" | "alert" | "success";
  icon?: "chart" | "check" | "activity" | "alert" | "star";
}

export interface WeeklyScore {
  completedTasks: number;
  totalTasks: number;
  progressDelta: number; // 先週比
  streak: number; // 連続達成日数
}

const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    note?: string;
    cards?: SummaryCard[];
    rotate?: boolean;
    showHeader?: boolean;
    customizable?: boolean;
    weeklyScore?: WeeklyScore | null;
    cardConfig?: DashboardCardConfig[];
  }>(),
  {
    title: "Webサイトリニューアル",
    description: "今週の状況をひと目で確認できます。",
    rotate: true,
    showHeader: true,
    customizable: false,
    weeklyScore: null,
  },
);

const emit = defineEmits<{
  (e: "update:visibleCards", cardIds: string[]): void;
  (e: "toggle-customize"): void;
  (e: "update:cardConfig", config: DashboardCardConfig[]): void;
}>();

const CARD_VISIBILITY_KEY = "fliro_summary_card_visibility";

// カスタマイズモード
const isCustomizing = ref(false);
const visibleCardIds = ref<string[]>([]);

const defaultCards: SummaryCard[] = [
  { id: "progress", label: "進捗率", value: 68, caption: "計画タスクの達成率" },
  { id: "done", label: "完了", value: 24, caption: "完了済みタスク数" },
  { id: "active", label: "進行中", value: 8, caption: "現在進行中のタスク" },
  {
    id: "overdue",
    label: "期限切れ",
    value: 3,
    caption: "期限超過タスク",
    tone: "alert",
  },
];
const defaultProgressValue = Number(
  defaultCards.find((card) => card.id === "progress")?.value ?? 0,
);

// 週次スコアカードを生成
const weeklyScoreCard = computed<SummaryCard | null>(() => {
  if (!props.weeklyScore) return null;
  const { completedTasks, progressDelta, streak } = props.weeklyScore;
  const deltaPrefix = progressDelta >= 0 ? "+" : "";
  return {
    id: "weekly-score",
    label: "週次スコア",
    value: completedTasks,
    caption: `${deltaPrefix}${progressDelta}% 先週比 • ${streak}日連続`,
    tone: progressDelta >= 0 ? "success" : "neutral",
    icon: "star",
  };
});

// カードリストの生成（週次スコアカードを含む）
const allCards = computed<SummaryCard[]>(() => {
  const base = props.cards && props.cards.length ? props.cards : defaultCards;
  if (weeklyScoreCard.value) {
    return [weeklyScoreCard.value, ...base];
  }
  return base;
});

const cardList = computed<SummaryCard[]>(() => {
  // If cardConfig is provided from props, use it for ordering and visibility
  if (props.cardConfig && props.cardConfig.length > 0) {
    const visibleConfigs = props.cardConfig
      .filter((c) => c.visible)
      .sort((a, b) => a.position - b.position);

    return visibleConfigs
      .map((config) => allCards.value.find((card) => card.id === config.id))
      .filter((card): card is SummaryCard => card !== undefined);
  }

  // Fallback to local visibility
  if (!props.customizable || visibleCardIds.value.length === 0) {
    return allCards.value;
  }
  return allCards.value.filter((card) =>
    visibleCardIds.value.includes(card.id),
  );
});

// Sort cards for customization panel (by position)
const sortedConfigCards = computed(() => {
  if (!props.cardConfig || props.cardConfig.length === 0) {
    return allCards.value.map((card, index) => ({
      id: card.id,
      type: card.id,
      position: index,
      visible: true,
    }));
  }
  return [...props.cardConfig].sort((a, b) => a.position - b.position);
});

const isDemo = computed(() => !props.cards || props.cards.length === 0);
const activeCardIndex = ref(0);
const progressValue = ref<number>(
  Number(cardList.value.find((card) => card.id === "progress")?.value ?? 0),
);
let highlightTimer: number | undefined;
let progressTimer: number | undefined;
let progressDirection = 1;

// カスタマイズ機能
function loadVisibility() {
  try {
    const stored = localStorage.getItem(CARD_VISIBILITY_KEY);
    if (stored) {
      visibleCardIds.value = JSON.parse(stored);
    } else {
      visibleCardIds.value = allCards.value.map((c) => c.id);
    }
  } catch {
    visibleCardIds.value = allCards.value.map((c) => c.id);
  }
}

function saveVisibility() {
  try {
    localStorage.setItem(
      CARD_VISIBILITY_KEY,
      JSON.stringify(visibleCardIds.value),
    );
    emit("update:visibleCards", visibleCardIds.value);
  } catch {
    // ignore
  }
}

function toggleCardVisibility(cardId: string) {
  const index = visibleCardIds.value.indexOf(cardId);
  if (index === -1) {
    visibleCardIds.value.push(cardId);
  } else if (visibleCardIds.value.length > 1) {
    visibleCardIds.value.splice(index, 1);
  }
  saveVisibility();
}

function getCardLabel(id: string): string {
  const card = allCards.value.find((c) => c.id === id);
  return card?.label || id;
}

function moveCardUp(cardId: string) {
  if (!props.cardConfig) return;

  const sorted = [...props.cardConfig].sort((a, b) => a.position - b.position);
  const index = sorted.findIndex((c) => c.id === cardId);
  if (index <= 0) return;

  // Swap positions
  const currentCard = sorted[index];
  const prevCard = sorted[index - 1];
  if (!currentCard || !prevCard) return;

  const currentPos = currentCard.position;
  const prevPos = prevCard.position;

  const updated = props.cardConfig.map((c) => {
    if (c.id === cardId) return { ...c, position: prevPos };
    if (c.id === prevCard.id) return { ...c, position: currentPos };
    return c;
  });

  emit("update:cardConfig", updated);
}

function moveCardDown(cardId: string) {
  if (!props.cardConfig) return;

  const sorted = [...props.cardConfig].sort((a, b) => a.position - b.position);
  const index = sorted.findIndex((c) => c.id === cardId);
  if (index === -1 || index >= sorted.length - 1) return;

  // Swap positions
  const currentCard = sorted[index];
  const nextCard = sorted[index + 1];
  if (!currentCard || !nextCard) return;

  const currentPos = currentCard.position;
  const nextPos = nextCard.position;

  const updated = props.cardConfig.map((c) => {
    if (c.id === cardId) return { ...c, position: nextPos };
    if (c.id === nextCard.id) return { ...c, position: currentPos };
    return c;
  });

  emit("update:cardConfig", updated);
}

function toggleCardVisible(cardId: string) {
  if (!props.cardConfig) return;

  // Prevent hiding all cards
  const visibleCount = props.cardConfig.filter((c) => c.visible).length;
  const currentCard = props.cardConfig.find((c) => c.id === cardId);
  if (visibleCount <= 1 && currentCard?.visible) return;

  const updated = props.cardConfig.map((c) => {
    if (c.id === cardId) return { ...c, visible: !c.visible };
    return c;
  });

  emit("update:cardConfig", updated);
}

watch(
  () => allCards.value,
  () => {
    // カードが追加された場合、デフォルトで表示
    const existingIds = new Set(visibleCardIds.value);
    allCards.value.forEach((card) => {
      if (!existingIds.has(card.id)) {
        visibleCardIds.value.push(card.id);
      }
    });
  },
);

onMounted(() => {
  loadVisibility();
  if (props.rotate && isDemo.value) {
    highlightTimer = window.setInterval(() => {
      activeCardIndex.value =
        (activeCardIndex.value + 1) % cardList.value.length;
    }, 3800);

    progressTimer = window.setInterval(() => {
      progressValue.value += progressDirection;
      if (
        progressValue.value >= defaultProgressValue + 4 ||
        progressValue.value <= defaultProgressValue - 4
      ) {
        progressDirection = -progressDirection;
      }
    }, 1200);
  } else {
    activeCardIndex.value = 0;
    progressValue.value = Number(
      cardList.value.find((card) => card.id === "progress")?.value ?? 0,
    );
  }
});

onBeforeUnmount(() => {
  if (highlightTimer) window.clearInterval(highlightTimer);
  if (progressTimer) window.clearInterval(progressTimer);
});
</script>

<template>
  <section class="summary">
    <!-- カスタマイズモード（cardConfig使用時） -->
    <div
      v-if="isCustomizing && props.customizable && props.cardConfig"
      class="summary__customize"
    >
      <p class="summary__customize-label">カードの表示・並び順を設定</p>
      <div class="summary__customize-list">
        <div
          v-for="(config, index) in sortedConfigCards"
          :key="config.id"
          class="summary__customize-item"
        >
          <label class="summary__customize-checkbox">
            <input
              type="checkbox"
              :checked="config.visible"
              :disabled="
                sortedConfigCards.filter((c) => c.visible).length === 1 &&
                config.visible
              "
              @change="toggleCardVisible(config.id)"
            />
            <span>{{ getCardLabel(config.id) }}</span>
          </label>
          <div class="summary__customize-actions">
            <button
              type="button"
              class="summary__order-btn"
              :disabled="index === 0"
              aria-label="上へ移動"
              @click="moveCardUp(config.id)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
            <button
              type="button"
              class="summary__order-btn"
              :disabled="index === sortedConfigCards.length - 1"
              aria-label="下へ移動"
              @click="moveCardDown(config.id)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- カスタマイズモード（レガシー：cardConfig未使用時） -->
    <div
      v-else-if="isCustomizing && props.customizable"
      class="summary__customize"
    >
      <p class="summary__customize-label">表示するカードを選択</p>
      <div class="summary__customize-options">
        <label
          v-for="card in allCards"
          :key="card.id"
          class="summary__customize-option"
        >
          <input
            type="checkbox"
            :checked="visibleCardIds.includes(card.id)"
            :disabled="
              visibleCardIds.length === 1 && visibleCardIds.includes(card.id)
            "
            @change="toggleCardVisibility(card.id)"
          />
          {{ card.label }}
        </label>
      </div>
    </div>

    <div class="summary__grid">
      <article
        v-for="(card, index) in cardList"
        :key="card.id"
        class="summary-card"
        :class="{
          'is-alert': card.tone === 'alert',
          'is-success': card.tone === 'success',
          'is-active': index === activeCardIndex,
        }"
      >
        <div class="summary-card__content">
          <div class="summary-card__info">
            <div v-if="card.icon" class="summary-card__icon">
              <svg
                v-if="card.icon === 'chart'"
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              <svg
                v-else-if="card.icon === 'check'"
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <svg
                v-else-if="card.icon === 'activity'"
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              <svg
                v-else-if="card.icon === 'alert'"
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <svg
                v-else-if="card.icon === 'star'"
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polygon
                  points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                ></polygon>
              </svg>
            </div>
            <div>
              <p class="summary-card__label">{{ card.label }}</p>
              <p class="summary-card__caption">{{ card.caption }}</p>
            </div>
          </div>
          <div class="summary-card__value-block">
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
                :style="{
                  width: `${card.id === 'progress' ? (isDemo ? progressValue : parseFloat(String(card.value)) || 0) : 0}%`,
                }"
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
  gap: 1.25rem;
}

.summary__customize {
  background: var(--surface-elevated);
  border: 1px solid var(--border-light);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
}

.summary__customize-label {
  margin: 0 0 0.75rem;
  font-weight: 600;
  color: var(--text-strong);
}

.summary__customize-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.summary__customize-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: 0.75rem;
  background: var(--surface);
  cursor: pointer;
  font-size: var(--ui-text-sm, 0.875rem);
  transition: border-color 150ms ease;
}

.summary__customize-option:hover {
  border-color: var(--primary);
}

.summary__customize-option input {
  width: 16px;
  height: 16px;
}

.summary__customize-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.summary__customize-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-light);
  border-radius: 0.75rem;
  background: var(--surface);
  transition: border-color 150ms ease;
}

.summary__customize-item:hover {
  border-color: var(--primary);
}

.summary__customize-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: var(--ui-text-sm, 0.875rem);
}

.summary__customize-checkbox input {
  width: 16px;
  height: 16px;
}

.summary__customize-actions {
  display: flex;
  gap: 0.25rem;
}

.summary__order-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-light);
  border-radius: 0.5rem;
  background: var(--surface-elevated);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.summary__order-btn:hover:not(:disabled) {
  background: rgba(79, 124, 130, 0.1);
  border-color: var(--primary);
  color: var(--primary);
}

.summary__order-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.summary__grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.summary-card {
  background: var(--surface-elevated);
  border: 1px solid var(--border-light);
  border-radius: 1.25rem;
  padding: 0.75rem 0.85rem;
  box-shadow: 0 12px 22px rgba(11, 46, 51, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  transition:
    transform 240ms ease,
    box-shadow 240ms ease,
    border-color 240ms ease;
}

.summary-card__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.summary-card__info {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  min-width: 0;
}

.summary-card__value-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
  min-width: 5.75rem;
}

.summary-card__icon {
  margin-top: 0.2rem;
  color: #4f7c82;
}

.summary-card__icon svg {
  display: block;
}

.summary-card__label {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  color: var(--text-muted);
}

.summary-card__value {
  margin: 0;
  font-size: 2.1rem;
  font-weight: 700;
  color: var(--text-strong);
  text-align: right;
  line-height: 1.1;
}

.summary-card__caption {
  margin: 0.05rem 0 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--text-muted);
}

.summary-card.is-alert {
  border-color: rgba(11, 46, 51, 0.25);
  box-shadow: 0 20px 34px rgba(11, 46, 51, 0.18);
}

.summary-card.is-alert .summary-card__value {
  color: #0b2e33;
}

.summary-card.is-success {
  border-color: rgba(34, 197, 94, 0.35);
  background: linear-gradient(135deg, #fff 0%, rgba(34, 197, 94, 0.05) 100%);
}

.summary-card.is-success .summary-card__value {
  color: #166534;
}

.summary-card.is-success .summary-card__icon {
  color: #22c55e;
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
  height: 0.32rem;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.18);
  overflow: hidden;
  margin: 0.08rem 0 0.2rem;
}

.summary-card__bar-fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #4f7c82, rgba(11, 46, 51, 0.9));
  transition: width 400ms ease;
}

/* モバイル対応 */
@media (max-width: 768px) {
  .summary__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .summary-card {
    padding: 0.65rem 0.75rem;
    border-radius: 1rem;
  }

  .summary-card__content {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .summary-card__info {
    width: 100%;
  }

  .summary-card__label {
    font-size: var(--ui-text-sm, 0.875rem);
    line-height: 1.3;
  }

  .summary-card__caption {
    font-size: var(--ui-text-xs, 0.75rem);
    line-height: 1.3;
  }

  .summary-card__value-block {
    width: 100%;
    align-items: flex-start;
    min-width: auto;
  }

  .summary-card__value {
    font-size: var(--ui-text-3xl, 1.875rem);
  }

  .summary-card__bar {
    width: 100%;
  }
}

@media (max-width: 400px) {
  .summary__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .summary-card {
    padding: 0.5rem 0.6rem;
  }

  .summary-card__icon svg {
    width: 18px;
    height: 18px;
  }

  .summary-card__label {
    font-size: var(--ui-text-sm, 0.875rem);
  }

  .summary-card__caption {
    font-size: var(--ui-text-xs, 0.75rem);
  }

  .summary-card__value {
    font-size: var(--ui-text-2xl, 1.5rem);
  }
}
</style>
