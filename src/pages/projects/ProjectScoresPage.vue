<script setup lang="ts">
import PageHeader from "@/components/ui/PageHeader.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
import { useProjectShellData } from "@/composables/useProjectShellData";
import ProjectAppShell from "@/layouts/ProjectAppShell.vue";
import { db } from "@/lib/firebase";
import {
  computeWeeklyScores,
  type WeeklyScoreResult,
} from "@/services/statsService";
import { getLogger } from "@logtape/logtape";
import { doc, onSnapshot } from "firebase/firestore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { ProjectDoc } from "@/types/project";

const logger = getLogger("app.pages.projects.ProjectScores");

const { projectId } = useProjectIdRoute();
const { navItems, sidebarProjects, profileInfo } =
  useProjectShellData(projectId);

const project = ref<ProjectDoc | null>(null);
const weeklyScores = ref<WeeklyScoreResult | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const selectedWeek = ref(0);

let stopProject: (() => void) | null = null;

const weekOptions = computed(() => [
  { value: 0, label: "今週" },
  { value: 1, label: "先週" },
  { value: 2, label: "2週前" },
  { value: 3, label: "3週前" },
]);

const formattedWeekRange = computed(() => {
  if (!weeklyScores.value) return "";
  const start = weeklyScores.value.weekStart;
  const end = weeklyScores.value.weekEnd;
  const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${formatDate(start)} - ${formatDate(end)}`;
});

const summaryStats = computed(() => {
  if (!weeklyScores.value) return { total: 0, completed: 0, avgRate: 0 };
  const scores = weeklyScores.value.memberScores;
  const total = scores.reduce((acc, s) => acc + s.totalTasks, 0);
  const completed = scores.reduce((acc, s) => acc + s.completedTasks, 0);
  const avgRate = total > 0 ? (completed / total) * 100 : 0;
  return { total, completed, avgRate };
});

async function loadScores() {
  loading.value = true;
  error.value = null;
  try {
    weeklyScores.value = await computeWeeklyScores(
      projectId.value,
      selectedWeek.value,
    );
  } catch (e) {
    logger.error`Failed to load weekly scores: ${e}`;
    error.value = "週次スコアの取得に失敗しました。";
  } finally {
    loading.value = false;
  }
}

function watchProject() {
  stopProject = onSnapshot(doc(db, "projects", projectId.value), (snapshot) => {
    if (snapshot.exists()) {
      project.value = snapshot.data() as ProjectDoc;
    }
  });
}

function getCompletionClass(rate: number): string {
  if (rate >= 80) return "score-excellent";
  if (rate >= 50) return "score-good";
  if (rate > 0) return "score-warning";
  return "score-none";
}

function getInitials(name: string): string {
  if (!name) return "??";
  const trimmed = name.trim();
  return trimmed.length <= 2 ? trimmed : trimmed.slice(0, 2);
}

onMounted(() => {
  watchProject();
  loadScores();
});

watch(projectId, () => {
  stopProject?.();
  watchProject();
  loadScores();
});

watch(selectedWeek, () => {
  loadScores();
});

onBeforeUnmount(() => {
  stopProject?.();
});
</script>

<template>
  <ProjectAppShell
    :project-id="projectId"
    :nav-items="navItems"
    :sidebar-projects="sidebarProjects"
    :profile-info="profileInfo"
    brand-subtitle="プロジェクト"
  >
    <template #headerTitle>
      <PageHeader
        :title="project?.name || 'スコア'"
        subtitle="メンバーのパフォーマンスを確認"
        :breadcrumbs="[
          {
            label: 'ダッシュボード',
            to: { name: ROUTE_NAMES.projectDashboard, params: { projectId } },
          },
          { label: 'スコア' },
        ]"
      />
    </template>

    <div class="scores-content">
      <section class="scores-page">
        <header class="scores-page__header">
          <div>
            <h2>週次タスク完了率</h2>
            <p>メンバーごとのタスク完了状況を確認できます。</p>
          </div>
          <div class="scores-page__week-select">
            <label for="week-select" class="sr-only">週を選択</label>
            <select
              id="week-select"
              v-model="selectedWeek"
              class="scores-page__select"
            >
              <option
                v-for="opt in weekOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
        </header>

        <div v-if="loading" class="scores-page__loading">
          <p>読み込み中...</p>
        </div>

        <div v-else-if="error" class="scores-page__error">
          <p>{{ error }}</p>
          <button type="button" class="scores-page__retry" @click="loadScores">
            再試行
          </button>
        </div>

        <template v-else>
          <div class="scores-page__summary">
            <article>
              <p>対象期間</p>
              <strong>{{ formattedWeekRange }}</strong>
            </article>
            <article>
              <p>総タスク数</p>
              <strong>{{ summaryStats.total }}</strong>
            </article>
            <article>
              <p>完了タスク</p>
              <strong>{{ summaryStats.completed }}</strong>
            </article>
            <article>
              <p>平均完了率</p>
              <strong>{{ summaryStats.avgRate.toFixed(1) }}%</strong>
            </article>
          </div>

          <div class="scores-page__table-wrapper">
            <table class="scores-page__table">
              <thead>
                <tr>
                  <th>メンバー</th>
                  <th>タスク数</th>
                  <th>完了数</th>
                  <th>完了率</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="score in weeklyScores?.memberScores"
                  :key="score.memberId"
                >
                  <td>
                    <div class="scores-page__member">
                      <div class="avatar" aria-hidden="true">
                        <span>{{ getInitials(score.memberName) }}</span>
                      </div>
                      <span class="scores-page__member-name">
                        {{ score.memberName }}
                      </span>
                    </div>
                  </td>
                  <td class="scores-page__number">{{ score.totalTasks }}</td>
                  <td class="scores-page__number">
                    {{ score.completedTasks }}
                  </td>
                  <td>
                    <div class="scores-page__rate">
                      <div class="scores-page__rate-bar">
                        <div
                          class="scores-page__rate-fill"
                          :class="getCompletionClass(score.completionRate)"
                          :style="{ width: `${score.completionRate}%` }"
                        ></div>
                      </div>
                      <span
                        class="scores-page__rate-text"
                        :class="getCompletionClass(score.completionRate)"
                      >
                        {{ score.completionRate.toFixed(1) }}%
                      </span>
                    </div>
                  </td>
                </tr>
                <tr
                  v-if="!weeklyScores?.memberScores.length"
                  class="scores-page__empty"
                >
                  <td colspan="4">この期間のデータがありません。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>
    </div>
  </ProjectAppShell>
</template>

<style scoped>
.scores-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-8);
  padding: var(--ui-space-8);
  height: calc(100vh - var(--ui-topbar-height));
  min-height: 0;
  box-sizing: border-box;
}

@supports (height: 100dvh) {
  .scores-content {
    height: calc(100dvh - var(--ui-topbar-height));
  }
}

.scores-page {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
  flex: 1;
  min-height: 0;
}

.scores-page__header {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
  align-items: center;
}

.scores-page__header h2 {
  margin: 0;
}

.scores-page__header p {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-text-muted, #64748b);
}

.scores-page__week-select {
  min-width: 120px;
}

.scores-page__select {
  width: 100%;
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  font-size: var(--ui-text-sm, 0.875rem);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.scores-page__select:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.scores-page__loading,
.scores-page__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-8, 2rem);
  color: var(--ui-text-muted, #64748b);
}

.scores-page__retry {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.scores-page__retry:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
}

.scores-page__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--ui-space-4, 1rem);
}

.scores-page__summary article {
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-surface, #ffffff);
}

.scores-page__summary p {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.scores-page__summary strong {
  font-size: var(--ui-text-2xl, 1.5rem);
  color: var(--ui-brand-900, #0b2e33);
}

.scores-page__table-wrapper {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-xl, 1.25rem);
  background: var(--ui-surface, #ffffff);
}

.scores-page__table {
  width: 100%;
  border-collapse: collapse;
}

.scores-page__table th,
.scores-page__table td {
  padding: var(--ui-space-4, 1rem);
  text-align: left;
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.scores-page__table th {
  background: var(--ui-surface-muted, #f1f5f9);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
  position: sticky;
  top: 0;
}

.scores-page__table tbody tr:last-child td {
  border-bottom: none;
}

.scores-page__table tbody tr:hover {
  background: var(--ui-surface-elevated, #f8fafc);
}

.scores-page__member {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--ui-radius-full, 9999px);
  background: rgba(79, 124, 130, 0.15);
  color: var(--ui-brand-900, #0b2e33);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--ui-font-bold, 700);
  font-size: var(--ui-text-sm, 0.875rem);
  flex-shrink: 0;
}

.scores-page__member-name {
  font-weight: var(--ui-font-semibold, 600);
}

.scores-page__number {
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.scores-page__rate {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.scores-page__rate-bar {
  flex: 1;
  height: 8px;
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-full, 9999px);
  overflow: hidden;
}

.scores-page__rate-fill {
  height: 100%;
  border-radius: var(--ui-radius-full, 9999px);
  transition: width 0.3s ease;
}

.scores-page__rate-fill.score-excellent {
  background: var(--ui-success, #16a34a);
}

.scores-page__rate-fill.score-good {
  background: #4f7c82;
}

.scores-page__rate-fill.score-warning {
  background: #f59e0b;
}

.scores-page__rate-fill.score-none {
  background: var(--ui-surface-muted, #f1f5f9);
}

.scores-page__rate-text {
  min-width: 60px;
  text-align: right;
  font-weight: var(--ui-font-semibold, 600);
  font-variant-numeric: tabular-nums;
}

.scores-page__rate-text.score-excellent {
  color: var(--ui-success, #16a34a);
}

.scores-page__rate-text.score-good {
  color: #4f7c82;
}

.scores-page__rate-text.score-warning {
  color: #f59e0b;
}

.scores-page__rate-text.score-none {
  color: var(--ui-text-muted, #64748b);
}

.scores-page__empty td {
  text-align: center;
  color: var(--ui-text-muted, #64748b);
  padding: var(--ui-space-8, 2rem);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 768px) {
  .scores-page__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .scores-page__week-select {
    width: 100%;
  }

  .scores-page__table th,
  .scores-page__table td {
    padding: var(--ui-space-3, 0.75rem);
  }

  .scores-page__rate {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-1, 0.25rem);
  }

  .scores-page__rate-bar {
    width: 100%;
  }
}
</style>
