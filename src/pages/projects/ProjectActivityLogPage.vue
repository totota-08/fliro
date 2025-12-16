<script setup lang="ts">
import ProjectSidebar from "@/components/projectDashboard/ProjectSidebar.vue";
import WeeklyEventSparkline from "@/components/projectActivity/WeeklyEventSparkline.vue";
import {
  fetchProjectEventsPage,
  listenProjectEvents,
  type ProjectEventCursor,
} from "@/services/projectActivityLogService";
import type { ProjectEvent, ProjectEventCategory } from "@/types/projectEvent";
import { useAuthStore } from "@/store/auth";
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

const iconMap: Record<string, IconDef> = {
  task: {
    path: iconPath("task"),
    bg: "var(--surface-muted, #eef2f7)",
    color: "#0b2e33",
  },
  check: {
    path: iconPath("check"),
    bg: "var(--surface-muted, #eef7f1)",
    color: "#0f5132",
  },
  clock: {
    path: iconPath("clock"),
    bg: "var(--surface-muted, #f5f2ff)",
    color: "#3f2e8c",
  },
  user: {
    path: iconPath("user"),
    bg: "var(--surface-muted, #eef2f7)",
    color: "#0b2e33",
  },
  bot: {
    path: iconPath("bot"),
    bg: "var(--surface-muted, #f2f4f8)",
    color: "#1f2937",
  },
  alert: {
    path: iconPath("alert"),
    bg: "var(--surface-muted, #fff3f3)",
    color: "#b91c1c",
  },
  note: {
    path: iconPath("note"),
    bg: "var(--surface-muted, #eef2f7)",
    color: "#0b2e33",
  },
};

const route = useRoute();
const { user } = useAuthStore();

const projectId = ref(String(route.params.projectId || ""));
const filterType = ref<ProjectEventCategory | "all">("all");
const loading = ref(true);
const loadingMore = ref(false);
const hasMore = ref(true);
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
    startListen();
  },
);

onBeforeUnmount(() => {
  stopEvents?.();
});
</script>

<template>
  <div class="activity-shell">
    <ProjectSidebar
      :open="true"
      :project-id="projectId"
      brand-subtitle="ログ"
    />
    <main class="activity-shell__main">
      <header class="log-header">
        <div class="log-header__titles">
          <p class="log-header__breadcrumb">プロジェクト &gt; ログ</p>
          <div class="log-header__row">
            <h1 class="log-header__title">活動ログ</h1>
            <span class="log-header__count"
              >{{ decoratedEvents.length }}件</span
            >
          </div>
        </div>
      </header>

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
            <ul v-else class="log-rows">
              <li
                v-for="item in decoratedEvents"
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

            <div v-if="hasMore && !loading" class="log-load-more">
              <button
                type="button"
                class="log-load-more__btn"
                :disabled="loadingMore"
                @click="loadMore"
              >
                {{ loadingMore ? "読み込み中..." : "さらに読み込む" }}
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
              <span class="log-aside__total"
                >合計 {{ weeklyTotals.week }}件</span
              >
            </p>
            <WeeklyEventSparkline
              :series="weeklySeries"
              :today-key="todayKey"
            />
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
    </main>
  </div>
</template>

<style scoped>
@import "@/pages/demo/styles/demo-shell.css";

.activity-shell {
  display: flex;
  min-height: 100vh;
  background: #f6f8fa;
}

.activity-shell__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1.5rem 2rem;
}

.log-content {
  max-width: 960px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.log-header {
  margin-bottom: 0.75rem;
}

.log-header__breadcrumb {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.log-header__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.log-header__title {
  margin: 0.1rem 0 0;
  font-size: 1.6rem;
  font-weight: 800;
}

.log-header__count {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: #e8eef5;
  color: #0b2e33;
  font-size: 0.9rem;
}

.log-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 1.25rem;
  align-items: start;
}

.log-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid rgba(11, 46, 51, 0.12);
}

.log-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #0f172a;
  flex-wrap: wrap;
}

.log-filter__label {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.log-filter__select {
  border: 1px solid #d8e0ea;
  border-radius: 0.4rem;
  padding: 0.45rem 0.65rem;
  background: #fff;
  min-width: 160px;
  font-size: 0.95rem;
}

.log-filter__select:focus {
  outline: 2px solid #cbd5e1;
  outline-offset: 1px;
}

.log-list {
  background: transparent;
}

.log-rows {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 0.75rem;
  overflow: hidden;
  background: #fff;
}

.log-row {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  align-items: center;
  border-bottom: 1px solid rgba(11, 46, 51, 0.08);
  transition: background-color 0.15s ease;
}

.log-row:last-of-type {
  border-bottom: none;
}

.log-row:hover {
  background: #f7f9fb;
}

.log-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
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
  gap: 0.25rem;
}

.log-title {
  margin: 0;
  font-weight: 700;
  color: #0f172a;
}

.log-desc {
  margin: 0;
  color: #475467;
  line-height: 1.4;
}

.log-meta {
  margin: 0;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.9rem;
}

.log-time {
  color: var(--text-muted);
  font-size: 0.9rem;
  white-space: nowrap;
}

.log-state {
  padding: 0.9rem 1rem;
  color: #475467;
  background: #fff;
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 0.75rem;
}

.log-load-more {
  display: flex;
  justify-content: center;
  padding-top: 0.75rem;
}

.log-load-more__btn {
  border: 1px solid #d8e0ea;
  border-radius: 0.6rem;
  padding: 0.55rem 1rem;
  background: #fff;
  cursor: pointer;
}

.log-load-more__btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.log-aside {
  position: sticky;
  top: 24px;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.log-aside__card {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 0.75rem;
  background: #fff;
  padding: 0.85rem 1rem;
}

.log-aside__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.log-aside__header h3 {
  margin: 0;
  font-size: 1rem;
}

.log-aside__sub {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.log-aside__subtitle {
  margin: 0.15rem 0 0.35rem;
  color: #475467;
  font-size: 0.92rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.log-aside__total {
  font-weight: 700;
  color: #0b2e33;
}

.log-aside__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.35rem;
}

.log-aside__stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.log-aside__label {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.log-aside__value {
  margin: 0;
  font-weight: 700;
  font-size: 1.1rem;
  color: #0f172a;
}

.log-aside__unit {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.log-aside__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.log-aside__list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0;
  border-bottom: 1px solid rgba(11, 46, 51, 0.06);
}

.log-aside__list li:last-of-type {
  border-bottom: none;
}

.log-aside__list strong {
  font-size: 1.05rem;
  color: #0f172a;
}

.dot {
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .activity-shell__main {
    padding: 1rem;
  }

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
    row-gap: 0.4rem;
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
