<script setup lang="ts">
import DashboardSidebar from "@/components/demo/DashboardSidebar.vue";
import DemoExplainerBanner from "@/components/demo/DemoExplainerBanner.vue";
import { appName } from "@/constants/appMeta";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

// モックタスクデータ
interface DemoTask {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  priority: "high" | "medium" | "low";
  dueDate: Date | null;
  assigneeName: string;
  categoryName: string;
  progress: number;
}

const mockTasks: DemoTask[] = [
  {
    id: "1",
    title: "ランディングページのデザイン作成",
    status: "in-progress",
    priority: "high",
    dueDate: new Date(Date.now() - 86400000), // 昨日（期限切れ）
    assigneeName: "田中 太郎",
    categoryName: "デザイン",
    progress: 75,
  },
  {
    id: "2",
    title: "APIエンドポイントの実装",
    status: "in-progress",
    priority: "high",
    dueDate: new Date(Date.now() + 86400000), // 明日
    assigneeName: "佐藤 花子",
    categoryName: "開発",
    progress: 50,
  },
  {
    id: "3",
    title: "ユーザー認証機能のテスト",
    status: "todo",
    priority: "medium",
    dueDate: new Date(Date.now() + 86400000 * 2), // 2日後
    assigneeName: "鈴木 一郎",
    categoryName: "QA",
    progress: 0,
  },
  {
    id: "4",
    title: "データベース設計書の作成",
    status: "done",
    priority: "medium",
    dueDate: new Date(Date.now() - 86400000 * 3),
    assigneeName: "高橋 美咲",
    categoryName: "ドキュメント",
    progress: 100,
  },
  {
    id: "5",
    title: "コードレビュー：認証モジュール",
    status: "todo",
    priority: "high",
    dueDate: new Date(Date.now() + 86400000 * 3),
    assigneeName: "田中 太郎",
    categoryName: "開発",
    progress: 0,
  },
  {
    id: "6",
    title: "パフォーマンス最適化",
    status: "in-progress",
    priority: "low",
    dueDate: new Date(Date.now() + 86400000 * 7),
    assigneeName: "佐藤 花子",
    categoryName: "開発",
    progress: 25,
  },
];

// サマリーカードデータ
interface SummaryCard {
  id: string;
  label: string;
  value: number | string;
  caption: string;
  tone?: "neutral" | "alert" | "success";
  icon?: "chart" | "check" | "activity" | "alert";
}

const overdueCount = computed(
  () =>
    mockTasks.filter(
      (t) => t.dueDate && t.dueDate < new Date() && t.status !== "done",
    ).length,
);

const inProgressCount = computed(
  () => mockTasks.filter((t) => t.status === "in-progress").length,
);

const doneCount = computed(
  () => mockTasks.filter((t) => t.status === "done").length,
);

const upcomingCount = computed(() => {
  const now = new Date();
  const threeDaysLater = new Date(now.getTime() + 86400000 * 3);
  return mockTasks.filter(
    (t) =>
      t.dueDate &&
      t.dueDate > now &&
      t.dueDate <= threeDaysLater &&
      t.status !== "done",
  ).length;
});

const summaryCards = computed<SummaryCard[]>(() => [
  {
    id: "overdue",
    label: "期限切れ",
    value: overdueCount.value,
    caption: "早めに対応が必要",
    tone: overdueCount.value > 0 ? "alert" : "neutral",
    icon: "alert",
  },
  {
    id: "upcoming",
    label: "直近の期限",
    value: upcomingCount.value,
    caption: "3日以内に期限",
    tone: "neutral",
    icon: "activity",
  },
  {
    id: "in-progress",
    label: "進行中",
    value: inProgressCount.value,
    caption: "現在取り組み中",
    tone: "neutral",
    icon: "chart",
  },
  {
    id: "done",
    label: "完了",
    value: doneCount.value,
    caption: "今週完了したタスク",
    tone: "success",
    icon: "check",
  },
]);

// フィルター状態
const filterStatus = ref<"all" | "todo" | "in-progress" | "done">("all");
const searchQuery = ref("");

const filteredTasks = computed(() => {
  let tasks = [...mockTasks];

  // ステータスフィルター
  if (filterStatus.value !== "all") {
    tasks = tasks.filter((t) => t.status === filterStatus.value);
  }

  // 検索フィルター
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.assigneeName.toLowerCase().includes(query) ||
        t.categoryName.toLowerCase().includes(query),
    );
  }

  // 期限切れを先頭にソート
  return tasks.sort((a, b) => {
    const aOverdue =
      a.dueDate && a.dueDate < new Date() && a.status !== "done" ? 1 : 0;
    const bOverdue =
      b.dueDate && b.dueDate < new Date() && b.status !== "done" ? 1 : 0;
    return bOverdue - aOverdue;
  });
});

// カードハイライトアニメーション
const activeCardIndex = ref(0);
let highlightTimer: number | undefined;

onMounted(() => {
  highlightTimer = window.setInterval(() => {
    activeCardIndex.value =
      (activeCardIndex.value + 1) % summaryCards.value.length;
  }, 3500);

  if (window.matchMedia("(max-width: 1200px)").matches) {
    isSidebarOpen.value = false;
  }
});

onBeforeUnmount(() => {
  if (highlightTimer) window.clearInterval(highlightTimer);
});

// ヘルパー関数
function isOverdue(task: DemoTask) {
  return task.dueDate && task.dueDate < new Date() && task.status !== "done";
}

function formatDate(date: Date | null) {
  if (!date) return "未設定";
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function statusLabel(status: string) {
  if (status === "in-progress") return "進行中";
  if (status === "done") return "完了";
  return "未着手";
}

// サイドバー状態
const isSidebarOpen = ref(true);

const closeSidebar = () => {
  isSidebarOpen.value = false;
};

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};
</script>

<template>
  <div :class="['demo', { 'demo--sidebar-collapsed': !isSidebarOpen }]">
    <DashboardSidebar :open="isSidebarOpen" @close="closeSidebar" />
    <div
      v-if="isSidebarOpen"
      class="demo__overlay"
      aria-hidden="true"
      @click="closeSidebar"
    />

    <div class="demo__main">
      <header class="demo__topbar">
        <div class="demo__topbar-left">
          <button
            type="button"
            class="demo__menu-button"
            @click="toggleSidebar"
          >
            <span class="sr-only">サイドバーを切り替え</span>
            <svg
              v-if="!isSidebarOpen"
              aria-hidden="true"
              class="demo__menu-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            <svg
              v-else
              aria-hidden="true"
              class="demo__menu-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 6l12 12M18 6l-12 12"
              />
            </svg>
          </button>
          <div>
            <p class="demo__breadcrumb">デモ体験 &gt; ダッシュボード</p>
            <h1 class="demo__heading">Webサイトリニューアル</h1>
          </div>
        </div>
      </header>

      <div class="demo__content">
        <DemoExplainerBanner page="dashboard" />

        <!-- サマリーカード -->
        <section class="summary-section">
          <div class="summary-grid">
            <article
              v-for="(card, index) in summaryCards"
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
                  <div class="summary-card__icon">
                    <svg
                      v-if="card.icon === 'alert'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <svg
                      v-else-if="card.icon === 'activity'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    <svg
                      v-else-if="card.icon === 'chart'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    <svg
                      v-else-if="card.icon === 'check'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <div>
                    <p class="summary-card__label">{{ card.label }}</p>
                    <p class="summary-card__caption">{{ card.caption }}</p>
                  </div>
                </div>
                <div class="summary-card__value-block">
                  <p class="summary-card__value">{{ card.value }}</p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <!-- タスクリスト -->
        <section class="task-list-section">
          <div class="task-list">
            <div class="task-list__header">
              <div class="task-list__header-left">
                <h3>タスク一覧</h3>
                <p>{{ filteredTasks.length }}件のタスク</p>
              </div>
              <div class="task-list__filters">
                <div class="task-search-wrapper">
                  <svg
                    class="task-search-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    v-model="searchQuery"
                    type="text"
                    class="task-search-input"
                    placeholder="タスクを検索..."
                  />
                </div>
                <select v-model="filterStatus" class="task-filter-select">
                  <option value="all">全て</option>
                  <option value="todo">未着手</option>
                  <option value="in-progress">進行中</option>
                  <option value="done">完了</option>
                </select>
              </div>
            </div>

            <ul class="task-list__items">
              <li
                v-for="task in filteredTasks"
                :key="task.id"
                class="task-row"
                :class="{ 'is-overdue': isOverdue(task) }"
              >
                <div class="task-row__content">
                  <div class="task-row__main">
                    <p class="task-row__title">{{ task.title }}</p>
                    <span class="task-row__category">{{
                      task.categoryName
                    }}</span>
                  </div>
                  <div class="task-row__meta">
                    <span class="task-row__assignee">{{
                      task.assigneeName
                    }}</span>
                    <span
                      class="task-row__status"
                      :class="`task-row__status--${task.status}`"
                    >
                      {{ statusLabel(task.status) }}
                    </span>
                  </div>
                  <div class="task-row__metric">
                    <span class="task-row__metric-label">進捗</span>
                    <div class="task-row__progress">
                      <div class="task-row__progress-bar">
                        <div
                          class="task-row__progress-fill"
                          :style="{ width: `${task.progress}%` }"
                        />
                      </div>
                      <span class="task-row__progress-value"
                        >{{ task.progress }}%</span
                      >
                    </div>
                  </div>
                  <div class="task-row__metric">
                    <span class="task-row__metric-label">期限</span>
                    <span
                      class="task-row__due"
                      :class="{ 'task-row__due--overdue': isOverdue(task) }"
                    >
                      {{ formatDate(task.dueDate) }}
                    </span>
                  </div>
                </div>
              </li>
            </ul>

            <p v-if="filteredTasks.length === 0" class="task-list__empty">
              該当するタスクがありません
            </p>
          </div>
        </section>

        <!-- デモ注意書き -->
        <div class="demo-notice">
          <p>
            これはデモ画面です。実際の{{
              appName
            }}では、タスクの作成・編集・削除や、
            チームメンバーとのリアルタイムコラボレーションが可能です。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import "@/pages/demo/styles/demo-shell.css";

/* サマリーカード */
.summary-section {
  width: 100%;
}

.summary-grid {
  display: grid;
  gap: var(--ui-space-4, 1rem);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.summary-card {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-4, 1rem);
  box-shadow: var(--ui-shadow-sm, 0 4px 12px rgba(11, 46, 51, 0.06));
  transition: var(--ui-transition-all, all 180ms ease);
}

.summary-card.is-active {
  transform: translateY(calc(-1 * var(--ui-space-1, 0.25rem)));
  border-color: var(--ui-brand-400, #8cb8be);
  box-shadow: var(--ui-shadow-lg, 0 12px 24px rgba(11, 46, 51, 0.12));
}

.summary-card.is-alert {
  border-color: var(--ui-danger-border, rgba(239, 68, 68, 0.3));
  background: linear-gradient(
    135deg,
    var(--ui-surface, #fff) 0%,
    var(--ui-danger-bg-subtle, rgba(239, 68, 68, 0.03)) 100%
  );
}

.summary-card.is-alert .summary-card__value {
  color: var(--ui-danger, #ef4444);
}

.summary-card.is-alert .summary-card__icon {
  color: var(--ui-danger, #ef4444);
}

.summary-card.is-success {
  border-color: var(--ui-success-border, rgba(34, 197, 94, 0.3));
  background: linear-gradient(
    135deg,
    var(--ui-surface, #fff) 0%,
    var(--ui-success-bg-subtle, rgba(34, 197, 94, 0.03)) 100%
  );
}

.summary-card.is-success .summary-card__value {
  color: var(--ui-success-text, #166534);
}

.summary-card.is-success .summary-card__icon {
  color: var(--ui-success, #22c55e);
}

.summary-card__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3, 0.75rem);
}

.summary-card__info {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-3, 0.75rem);
}

.summary-card__icon {
  color: var(--ui-brand-600, #4f7c82);
}

.summary-card__icon svg {
  width: var(--ui-space-6, 1.5rem);
  height: var(--ui-space-6, 1.5rem);
}

.summary-card__label {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
}

.summary-card__caption {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.summary-card__value-block {
  text-align: right;
}

.summary-card__value {
  margin: 0;
  font-size: var(--ui-text-3xl, 1.875rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
  line-height: 1;
}

/* タスクリスト */
.task-list-section {
  width: 100%;
}

.task-list {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-5, 1.25rem);
  box-shadow: var(--ui-shadow-sm, 0 4px 12px rgba(11, 46, 51, 0.06));
}

.task-list__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--ui-space-4, 1rem);
  margin-bottom: var(--ui-space-4, 1rem);
  padding-bottom: var(--ui-space-4, 1rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  flex-wrap: wrap;
}

.task-list__header-left h3 {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text, #0b2e33);
}

.task-list__header-left p {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.task-list__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2, 0.5rem);
  align-items: center;
}

.task-search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.task-search-icon {
  position: absolute;
  left: var(--ui-space-3, 0.75rem);
  width: var(--ui-space-4, 1rem);
  height: var(--ui-space-4, 1rem);
  color: var(--ui-text-muted, #64748b);
  pointer-events: none;
}

.task-search-input {
  min-width: var(--ui-input-min-width, 180px);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  padding-left: var(--ui-space-9, 2.25rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  font-size: max(var(--ui-text-sm, 0.875rem), 16px);
  color: var(--ui-text, #0b2e33);
  min-height: var(--ui-input-touch-height, 44px);
}

.task-search-input:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus, 0 0 0 3px rgba(79, 124, 130, 0.15));
}

.task-filter-select {
  min-width: var(--ui-select-min-width, 100px);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  font-size: max(var(--ui-text-sm, 0.875rem), 16px);
  color: var(--ui-text, #0b2e33);
  cursor: pointer;
  min-height: var(--ui-input-touch-height, 44px);
}

.task-filter-select:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus, 0 0 0 3px rgba(79, 124, 130, 0.15));
}

.task-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.task-row {
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  cursor: pointer;
  transition: var(--ui-transition-colors, all 150ms ease);
  background: var(--ui-surface, #ffffff);
}

.task-row:hover {
  border-color: var(--ui-brand-300, #b8e3e9);
  box-shadow: var(--ui-shadow-xs, 0 2px 8px rgba(11, 46, 51, 0.08));
}

.task-row.is-overdue {
  border-color: var(--ui-danger-border-subtle, rgba(239, 68, 68, 0.25));
  background-color: var(--ui-danger-bg-subtle, rgba(254, 242, 242, 0.5));
}

.task-row__content {
  display: grid;
  grid-template-columns:
    minmax(0, 1.4fr) minmax(140px, 0.8fr) minmax(150px, 0.8fr)
    minmax(110px, 0.5fr);
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.task-row__main {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  min-width: 0;
}

.task-row__title {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-row__category {
  font-size: var(--ui-text-xs, 0.75rem);
  padding: var(--ui-space-0-5, 0.125rem) var(--ui-space-2, 0.5rem);
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-800, #134e4a);
  border-radius: var(--ui-radius-full, 9999px);
  width: fit-content;
}

.task-row__meta {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.task-row__assignee {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.task-row__status {
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  padding: var(--ui-space-0-5, 0.125rem) var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-full, 9999px);
  width: fit-content;
}

.task-row__status--todo {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
}

.task-row__status--in-progress {
  background: var(--ui-brand-100, rgba(79, 124, 130, 0.2));
  color: var(--ui-brand-800, #134e4a);
}

.task-row__status--done {
  background: var(--ui-success-light, rgba(22, 163, 74, 0.2));
  color: var(--ui-success-text, #166534);
}

.task-row__metric {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.task-row__metric-label {
  font-size: var(--ui-text-2xs, 0.7rem);
  letter-spacing: var(--ui-tracking-wider, 0.08em);
  color: var(--ui-text-muted, #94a3b8);
  text-transform: uppercase;
}

.task-row__progress {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
}

.task-row__progress-bar {
  width: var(--ui-progress-width, 60px);
  height: var(--ui-progress-height, 6px);
  background: var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-full, 9999px);
  overflow: hidden;
}

.task-row__progress-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--ui-brand-600, #4f7c82),
    var(--ui-brand-900, #0b2e33)
  );
  border-radius: inherit;
}

.task-row__progress-value {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  min-width: 2.5rem;
  text-align: right;
}

.task-row__due {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.task-row__due--overdue {
  color: var(--ui-danger, #ef4444);
  font-weight: var(--ui-font-semibold, 600);
}

.task-list__empty {
  text-align: center;
  padding: var(--ui-space-8, 2rem);
  color: var(--ui-text-muted, #64748b);
}

/* デモ注意書き */
.demo-notice {
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-brand-50, #f5fcff);
  border: 1px solid var(--ui-brand-200, #d4f1f5);
  border-radius: var(--ui-radius-lg, 1rem);
  text-align: center;
}

.demo-notice p {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

/* レスポンシブ */
@media (max-width: 900px) {
  .task-row__content {
    grid-template-columns: 1fr;
    gap: var(--ui-space-2, 0.5rem);
  }

  .task-row__meta,
  .task-row__metric {
    flex-direction: row;
    align-items: center;
    gap: var(--ui-space-2, 0.5rem);
  }
}

@media (max-width: 768px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--ui-space-3, 0.75rem);
  }

  .summary-card {
    padding: var(--ui-space-3, 0.75rem);
  }

  .summary-card__content {
    flex-direction: column;
    align-items: flex-start;
  }

  .summary-card__value {
    font-size: var(--ui-text-2xl, 1.5rem);
  }

  .task-list__header {
    flex-direction: column;
  }

  .task-list__filters {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .task-search-input,
  .task-filter-select {
    width: 100%;
    min-width: unset;
  }
}

@media (max-width: 480px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .summary-card {
    transition: none;
  }

  .summary-card.is-active {
    transform: none;
  }
}
</style>
