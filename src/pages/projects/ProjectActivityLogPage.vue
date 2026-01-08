<script setup lang="ts">
import WeeklyEventSparkline from "@/components/projectActivity/WeeklyEventSparkline.vue";
import { useProjectShellData } from "@/composables/useProjectShellData";
import ProjectAppShell from "@/layouts/ProjectAppShell.vue";
import {
  fetchProjectEventsPage,
  listenProjectEvents,
  type ProjectEventCursor,
} from "@/services/projectActivityLogService";
import type { ProjectEvent, ProjectEventCategory } from "@/types/projectEvent";
import {
  categorizeProjectEvent,
  getEventTemplate,
  iconPath,
} from "@/utils/projectEventTemplate";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

type DecoratedEvent = {
  event: ProjectEvent;
  category: ProjectEventCategory;
  title: string;
  description: string;
  icon: string;
};

type IconDef = { path: string; bg: string; color: string };

const iconMap = {
  task: {
    path: iconPath("task"),
    bg: "var(--ui-surface-muted)",
    color: "var(--ui-brand-900)",
  },
  check: {
    path: iconPath("check"),
    bg: "var(--ui-success-light)",
    color: "var(--ui-success-text)",
  },
  clock: {
    path: iconPath("clock"),
    bg: "var(--ui-info-light)",
    color: "var(--ui-info)",
  },
  user: {
    path: iconPath("user"),
    bg: "var(--ui-surface-muted)",
    color: "var(--ui-brand-900)",
  },
  bot: {
    path: iconPath("bot"),
    bg: "var(--ui-surface-muted)",
    color: "var(--ui-text-strong)",
  },
  alert: {
    path: iconPath("alert"),
    bg: "var(--ui-danger-light)",
    color: "var(--ui-danger-text)",
  },
  note: {
    path: iconPath("note"),
    bg: "var(--ui-surface-muted)",
    color: "var(--ui-brand-900)",
  },
} satisfies Record<string, IconDef>;

const route = useRoute();
const projectId = ref(String(route.params.projectId || ""));
const { navItems, sidebarProjects, profileInfo } =
  useProjectShellData(projectId);
const filterType = ref<ProjectEventCategory | "all">("all");
const loading = ref(true);
const loadingMore = ref(false);
const hasMore = ref(true);
const previewLimit = 5;
const isLogExpanded = ref(false);
const liveEvents = ref<ProjectEvent[]>([]);
const olderEvents = ref<ProjectEvent[]>([]);
const liveCursor = ref<ProjectEventCursor>(null);
const pagingCursor = ref<ProjectEventCursor>(null);
let stopEvents: (() => void) | null = null;

const events = computed(() => [...liveEvents.value, ...olderEvents.value]);

const decoratedEvents = computed<DecoratedEvent[]>(() =>
  events.value
    .map((event) => {
      const template = getEventTemplate(event);
      const category = categorizeProjectEvent(event);
      return {
        event,
        category,
        title: template.title,
        description: template.description,
        icon: iconPath(template.icon),
      };
    })
    .filter((entry) => {
      if (filterType.value === "all") return true;
      return entry.category === filterType.value;
    }),
);

const displayedEvents = computed(() =>
  isLogExpanded.value
    ? decoratedEvents.value
    : decoratedEvents.value.slice(0, previewLimit),
);

const showLoadMoreButton = computed(() => {
  if (loading.value) return false;
  return !isLogExpanded.value && decoratedEvents.value.length >= previewLimit;
});

const loadMoreLabel = computed(() => {
  if (!isLogExpanded.value) return "さらに読み込む";
  return loadingMore.value ? "読み込み中..." : "さらに読み込む";
});

function toMidnight(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateKeyLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseCreatedAt(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string")
    return new Date(value);
  return null;
}

const todayKey = computed(() => formatDateKeyLocal(toMidnight(new Date())));

const weekKeys = computed(() => {
  const today = toMidnight(new Date());
  const keys: { key: string; label: string; date: Date }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = formatDateKeyLocal(d);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    keys.push({ key, label, date: d });
  }
  return keys;
});

const weeklySeries = computed(() => {
  const base = weekKeys.value.reduce<
    Record<string, { key: string; label: string; total: number }>
  >((acc, item) => {
    acc[item.key] = { key: item.key, label: item.label, total: 0 };
    return acc;
  }, {});
  events.value.forEach((event) => {
    const created = parseCreatedAt(event.createdAt);
    if (!created) return;
    const key = formatDateKeyLocal(toMidnight(created));
    if (base[key]) {
      base[key].total += 1;
    }
  });
  return weekKeys.value.map(
    (k) => base[k.key] ?? { key: k.key, label: k.label, total: 0 },
  );
});

const weeklyTotals = computed(() => {
  let week = 0;
  let today = 0;
  weeklySeries.value.forEach((entry) => {
    week += entry.total;
    if (entry.key === todayKey.value) today = entry.total;
  });
  const categoryTotals: { task: number; member: number; assignment: number } = {
    task: 0,
    member: 0,
    assignment: 0,
  };
  events.value.forEach((event) => {
    const created = parseCreatedAt(event.createdAt);
    if (!created) return;
    const diff =
      toMidnight(new Date()).getTime() - toMidnight(created).getTime();
    if (diff < 0 || diff > 6 * 24 * 60 * 60 * 1000) return;
    if (event.type.startsWith("task.")) {
      categoryTotals.task += 1;
    } else if (event.type.startsWith("member.")) {
      categoryTotals.member += 1;
    } else {
      categoryTotals.assignment += 1;
    }
  });
  return { week, today, categoryTotals };
});

function iconForEvent(event: ProjectEvent): IconDef {
  const category = categorizeProjectEvent(event);
  if (category === "task") return iconMap.task ?? iconMap.note;
  if (category === "member") return iconMap.user;
  if (category === "decision") return iconMap.check;
  if (category === "bot") return iconMap.bot;
  return iconMap.note;
}

function iconStyles(event: ProjectEvent) {
  const icon = iconForEvent(event);
  return {
    background: icon.bg,
    color: icon.color,
  };
}

function iconPathForEvent(event: ProjectEvent) {
  return iconForEvent(event).path;
}

function startListen() {
  stopEvents?.();
  olderEvents.value = [];
  pagingCursor.value = null;
  if (!projectId.value) return;

  stopEvents = listenProjectEvents(
    projectId.value,
    (list) => {
      liveEvents.value = list;
      loading.value = false;
      if (!pagingCursor.value) {
        hasMore.value = true;
      }
    },
    {
      limitSize: 50,
      onCursor: (cursor) => {
        liveCursor.value = cursor;
        if (!pagingCursor.value) {
          pagingCursor.value = cursor;
        }
      },
    },
  );
}

function effectiveCursor() {
  return pagingCursor.value || liveCursor.value;
}

async function loadMore() {
  if (loadingMore.value || !projectId.value) return;
  const cursor = effectiveCursor();
  if (!cursor) {
    hasMore.value = false;
    return;
  }
  loadingMore.value = true;
  try {
    const { events: page, nextCursor } = await fetchProjectEventsPage(
      projectId.value,
      cursor,
      50,
    );
    olderEvents.value = [...olderEvents.value, ...page];
    pagingCursor.value = nextCursor;
    hasMore.value = Boolean(nextCursor);
  } finally {
    loadingMore.value = false;
  }
}

function handleLoadMoreAction() {
  if (!isLogExpanded.value) {
    isLogExpanded.value = true;
    return;
  }
  loadMore();
}

function formatTimestamp(value: any) {
  if (!value) return "--:--";
  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  if (value.seconds) {
    return new Date(value.seconds * 1000).toLocaleString();
  }
  return new Date(value).toLocaleString();
}

onMounted(() => {
  startListen();
});

watch(
  () => route.params.projectId,
  (newId) => {
    if (!newId) return;
    projectId.value = String(newId);
    loading.value = true;
    isLogExpanded.value = false;
    startListen();
  },
);

onBeforeUnmount(() => {
  stopEvents?.();
});
</script>

<template>
  <ProjectAppShell
    :project-id="projectId"
    :nav-items="navItems"
    :sidebar-projects="sidebarProjects"
    :profile-info="profileInfo"
    brand-subtitle="ログ"
  >
    <template #headerTitle>
      <p class="project-app-shell__breadcrumb">プロジェクト &gt; ログ</p>
      <div class="log-header__row">
        <h1 class="project-app-shell__heading">活動ログ</h1>
        <span class="log-header__count">{{ decoratedEvents.length }}件</span>
      </div>
    </template>

    <div class="log-layout">
      <div class="log-content">
        <section class="log-toolbar">
          <label class="log-filter">
            <span class="log-filter__label">種類</span>
            <select v-model="filterType" class="log-filter__select">
              <option value="all">すべて</option>
              <option value="task">タスク</option>
              <option value="decision">決定</option>
              <option value="member">メンバー</option>
              <option value="bot">Bot</option>
            </select>
          </label>
        </section>

        <section class="log-list">
          <div v-if="loading" class="log-state">読み込み中です…</div>
          <div v-else-if="!decoratedEvents.length" class="log-state">
            該当するイベントがありません。
          </div>
          <ul
            v-else
            class="log-rows"
            :class="{ 'is-scrollable': isLogExpanded }"
          >
            <li
              v-for="item in displayedEvents"
              :key="item.event.id"
              class="log-row"
            >
              <div class="log-icon" :style="iconStyles(item.event)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    :d="iconPathForEvent(item.event)"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <div class="log-main">
                <p class="log-title">{{ item.title }}</p>
                <p class="log-desc">{{ item.description }}</p>
                <p class="log-meta">
                  <span>{{ item.event.actorName }}</span>
                  <span class="dot">•</span>
                  <span>{{ item.event.origin }}</span>
                </p>
              </div>
              <span class="log-time">{{
                formatTimestamp(item.event.createdAt)
              }}</span>
            </li>
          </ul>

          <div v-if="showLoadMoreButton" class="log-load-more">
            <button
              type="button"
              class="log-load-more__btn log-more-btn"
              :disabled="loadingMore"
              @click="handleLoadMoreAction"
            >
              {{ loadMoreLabel }}
            </button>
          </div>
        </section>
      </div>

      <aside class="log-aside">
        <div class="log-aside__card">
          <div class="log-aside__header">
            <h3>今週のイベント</h3>
            <span class="log-aside__sub">直近7日・件</span>
          </div>
          <p class="log-aside__subtitle">
            直近7日の日別イベント数
            <span class="log-aside__total">合計 {{ weeklyTotals.week }}件</span>
          </p>
          <WeeklyEventSparkline :series="weeklySeries" :today-key="todayKey" />
          <div class="log-aside__summary">
            <div class="log-aside__stat">
              <p class="log-aside__label">今日</p>
              <p class="log-aside__value">{{ weeklyTotals.today }}</p>
              <span class="log-aside__unit">件</span>
            </div>
            <div class="log-aside__stat">
              <p class="log-aside__label">今週</p>
              <p class="log-aside__value">{{ weeklyTotals.week }}</p>
              <span class="log-aside__unit">件</span>
            </div>
          </div>
        </div>
        <div class="log-aside__card">
          <div class="log-aside__header">
            <h3>種別別（今週）</h3>
          </div>
          <ul class="log-aside__list">
            <li>
              <span>タスク</span>
              <strong>{{ weeklyTotals.categoryTotals.task }}</strong>
            </li>
            <li>
              <span>アサイン/その他</span>
              <strong>{{ weeklyTotals.categoryTotals.assignment }}</strong>
            </li>
            <li>
              <span>メンバー</span>
              <strong>{{ weeklyTotals.categoryTotals.member }}</strong>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </ProjectAppShell>
</template>

<style scoped>
.log-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--ui-space-5);
  align-items: start;
  padding: var(--ui-space-6);
}

.log-content {
  max-width: 960px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.log-header__row {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.log-header__count {
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-brand-900, #0b2e33);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
}

.log-toolbar {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-3, 0.75rem) 0;
  border-bottom: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

.log-filter {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
  flex-wrap: wrap;
}

.log-filter__label {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.log-filter__select {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-sm, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  background: var(--ui-surface, #ffffff);
  min-width: 160px;
  font-size: var(--ui-text-sm, 0.875rem);
  transition: var(--ui-transition-colors);
}

.log-filter__select:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.log-list {
  background: transparent;
}

.log-rows {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  overflow: hidden;
  background: var(--ui-surface, #ffffff);
}

.log-rows.is-scrollable {
  max-height: 60vh;
  overflow-x: hidden;
  overflow-y: auto;
}

.log-row {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  align-items: center;
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  transition: var(--ui-transition-colors);
}

.log-row:last-of-type {
  border-bottom: none;
}

.log-row:hover {
  background: var(--ui-surface-muted, #f1f5f9);
}

.log-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--ui-radius-md, 0.75rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.log-icon svg {
  width: 18px;
  height: 18px;
}

.log-main {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.log-title {
  margin: 0;
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.log-desc {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-normal, 1.5);
  font-size: var(--ui-text-sm, 0.875rem);
}

.log-meta {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  display: flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  font-size: var(--ui-text-sm, 0.875rem);
}

.log-time {
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
  white-space: nowrap;
}

.log-state {
  padding: var(--ui-space-4, 1rem);
  color: var(--ui-text-muted, #64748b);
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  text-align: center;
}

.log-load-more {
  display: flex;
  justify-content: center;
  padding-top: var(--ui-space-3, 0.75rem);
}

.log-load-more__btn {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  background: var(--ui-surface, #ffffff);
  font-weight: var(--ui-font-semibold, 600);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.log-load-more__btn:hover:not(:disabled) {
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
}

.log-load-more__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.log-aside {
  position: sticky;
  top: var(--ui-space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.log-aside__card {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  padding: var(--ui-space-4, 1rem);
}

.log-aside__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--ui-space-2, 0.5rem);
}

.log-aside__header h3 {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.log-aside__sub {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.log-aside__subtitle {
  margin: var(--ui-space-1, 0.25rem) 0 var(--ui-space-2, 0.5rem);
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
}

.log-aside__total {
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-brand-900, #0b2e33);
}

.log-aside__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-3, 0.75rem);
  margin-top: var(--ui-space-2, 0.5rem);
}

.log-aside__stat {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.log-aside__label {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.log-aside__value {
  margin: 0;
  font-weight: var(--ui-font-bold, 700);
  font-size: var(--ui-text-lg, 1.125rem);
  color: var(--ui-text-strong, #0f172a);
}

.log-aside__unit {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.log-aside__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.log-aside__list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--ui-space-2, 0.5rem) 0;
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.log-aside__list li:last-of-type {
  border-bottom: none;
}

.log-aside__list strong {
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.dot {
  color: var(--ui-text-muted, #64748b);
}

@media (max-width: 768px) {
  .log-layout {
    grid-template-columns: 1fr;
  }

  .log-aside {
    position: static;
  }

  .log-row {
    grid-template-columns: 40px 1fr;
    grid-template-areas:
      "icon main"
      "time time";
    row-gap: var(--ui-space-2, 0.5rem);
  }

  .log-icon {
    grid-area: icon;
  }

  .log-main {
    grid-area: main;
  }

  .log-time {
    grid-area: time;
  }
}
</style>
