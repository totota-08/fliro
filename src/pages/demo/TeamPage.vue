<script setup lang="ts">
import { useSidebarState } from "@/composables/useSidebarState";
import { computed, ref } from "vue";
import DashboardSidebar from "@/components/demo/DashboardSidebar.vue";
import DemoExplainerBanner from "@/components/demo/DemoExplainerBanner.vue";
import { appName } from "@/constants/appMeta";

type TeamMember = {
  id: number;
  familyName: string;
  givenName: string;
  email: string;
  role: "オーナー" | "管理者" | "メンバー";
  avatar?: string;
  initials: string;
  tasksCount: number;
  completedTasks: number;
  status: "オンライン" | "オフライン" | "離席中";
};

const { isSidebarOpen, toggleSidebar, closeSidebar } = useSidebarState();

const teamMembers = ref<TeamMember[]>([
  {
    id: 1,
    familyName: "田中",
    givenName: "太郎",
    email: "tanaka@example.com",
    role: "オーナー",
    avatar: "",
    initials: "田中",
    tasksCount: 8,
    completedTasks: 5,
    status: "オンライン",
  },
  {
    id: 2,
    familyName: "佐藤",
    givenName: "花子",
    email: "sato@example.com",
    role: "管理者",
    avatar: "",
    initials: "佐藤",
    tasksCount: 12,
    completedTasks: 9,
    status: "オンライン",
  },
  {
    id: 3,
    familyName: "鈴木",
    givenName: "一郎",
    email: "suzuki@example.com",
    role: "メンバー",
    avatar: "",
    initials: "鈴木",
    tasksCount: 6,
    completedTasks: 4,
    status: "オフライン",
  },
  {
    id: 4,
    familyName: "高橋",
    givenName: "美咲",
    email: "takahashi@example.com",
    role: "メンバー",
    avatar: "",
    initials: "高橋",
    tasksCount: 10,
    completedTasks: 7,
    status: "オンライン",
  },
  {
    id: 5,
    familyName: "伊藤",
    givenName: "健太",
    email: "ito@example.com",
    role: "メンバー",
    avatar: "",
    initials: "伊藤",
    tasksCount: 5,
    completedTasks: 3,
    status: "離席中",
  },
  {
    id: 6,
    familyName: "渡辺",
    givenName: "さくら",
    email: "watanabe@example.com",
    role: "メンバー",
    avatar: "",
    initials: "渡辺",
    tasksCount: 9,
    completedTasks: 6,
    status: "オンライン",
  },
]);

const stats = computed(() => ({
  members: teamMembers.value.length,
  online: teamMembers.value.filter((member) => member.status === "オンライン")
    .length,
  inProgress: teamMembers.value.reduce(
    (sum, member) => sum + (member.tasksCount - member.completedTasks),
    0,
  ),
}));

const roleClass = (role: TeamMember["role"]) => {
  switch (role) {
    case "オーナー":
      return "badge role-owner";
    case "管理者":
      return "badge role-admin";
    default:
      return "badge role-member";
  }
};

const statusClass = (status: TeamMember["status"]) => {
  switch (status) {
    case "オンライン":
      return "status-indicator status-online";
    case "離席中":
      return "status-indicator status-away";
    default:
      return "status-indicator status-offline";
  }
};

const getCompletionPercent = (member: TeamMember) =>
  member.tasksCount === 0
    ? 0
    : Math.round((member.completedTasks / member.tasksCount) * 100);

const getCompletionWidth = (member: TeamMember) =>
  member.tasksCount === 0
    ? "0%"
    : `${((member.completedTasks / member.tasksCount) * 100).toFixed(1)}%`;

const formatFullName = (member: TeamMember) =>
  `${member.familyName} ${member.givenName}`;
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
            <p class="demo__breadcrumb">デモ体験 &gt; チーム</p>
            <h1 class="demo__heading">Webサイトリニューアル</h1>
          </div>
        </div>
      </header>

      <div class="demo__content demo__content--condensed">
        <DemoExplainerBanner page="team" />

        <section class="team-page">
          <header class="team-page__header">
            <div>
              <h2>チーム</h2>
              <p>チームメンバーの管理と招待</p>
            </div>
            <button type="button" class="team-page__invite">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M12 5v14M5 12h14"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              メンバーを招待
            </button>
          </header>

          <section class="team-stats">
            <article class="team-stats__card">
              <p>総メンバー数</p>
              <strong>{{ stats.members }}</strong>
            </article>
            <article class="team-stats__card">
              <p>オンライン</p>
              <strong class="tone-online">{{ stats.online }}</strong>
            </article>
            <article class="team-stats__card">
              <p>進行中のタスク</p>
              <strong>{{ stats.inProgress }}</strong>
            </article>
          </section>

          <div class="team-page__search">
            <div class="team-page__search-input">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="6" stroke-width="1.7" />
                <path
                  d="m20 20-3.5-3.5"
                  stroke-width="1.7"
                  stroke-linecap="round"
                />
              </svg>
              <input type="search" placeholder="メンバーを検索…" />
            </div>
          </div>

          <section class="team-grid">
            <article
              v-for="member in teamMembers"
              :key="member.id"
              class="team-card"
            >
              <header class="team-card__header">
                <div class="team-card__identity">
                  <div class="team-card__avatar">
                    <span>{{ member.initials }}</span>
                    <span
                      :class="statusClass(member.status)"
                      aria-hidden="true"
                    ></span>
                  </div>
                  <div>
                    <h3>{{ formatFullName(member) }}</h3>
                    <div class="team-card__contact">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M4 4h16v16H4z"
                          stroke-width="1.4"
                          stroke-linejoin="round"
                        />
                        <path
                          d="m4 7 8 6 8-6"
                          stroke-width="1.4"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                      <span>{{ member.email }}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  class="team-card__menu"
                  aria-label="メンバーアクション"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
              </header>

              <div class="team-card__badges">
                <span :class="roleClass(member.role)">{{ member.role }}</span>
                <span class="badge badge-muted">{{ member.status }}</span>
              </div>

              <div class="team-card__stats">
                <div>
                  <p>担当タスク</p>
                  <strong>{{ member.tasksCount }}</strong>
                </div>
                <div>
                  <p>完了タスク</p>
                  <strong class="tone-online">{{
                    member.completedTasks
                  }}</strong>
                </div>
              </div>

              <footer class="team-card__progress">
                <div class="team-card__progress-header">
                  <span>進捗率</span>
                  <span>{{ getCompletionPercent(member) }}%</span>
                </div>
                <div class="team-card__progress-bar">
                  <div
                    class="team-card__progress-fill"
                    :style="{ width: getCompletionWidth(member) }"
                  />
                </div>
              </footer>
            </article>
          </section>

          <section class="team-table">
            <h3>メンバー名簿</h3>
            <p class="team-table__description">
              テーブルに登録されている苗字・名前を分割して表示しています。
            </p>
            <div class="team-table__scroll">
              <table>
                <thead>
                  <tr>
                    <th>苗字</th>
                    <th>名前</th>
                    <th>メールアドレス</th>
                    <th>ロール</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="member in teamMembers" :key="`row-${member.id}`">
                    <td>{{ member.familyName }}</td>
                    <td>{{ member.givenName }}</td>
                    <td>{{ member.email }}</td>
                    <td>{{ member.role }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- デモ注意書き -->
          <div class="demo-notice">
            <p>
              これはデモ画面です。実際の{{
                appName
              }}では、メンバーの招待・ロール変更・権限管理が可能です。
            </p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import "@/pages/demo/styles/demo-shell.css";

/* ==========================================================================
   Team Page - Design System Token Variables
   ========================================================================== */

.demo__content--condensed {
  padding: var(--ui-space-8, 32px);
}

/* ==========================================================================
   Team Page Layout
   ========================================================================== */

.team-page {
  display: grid;
  gap: var(--ui-space-8, 32px);
}

.team-page__header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--ui-space-4, 16px);
}

.team-page__header h2 {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2rem);
  font-weight: 700;
  color: var(--ui-text-strong, #0f172a);
}

.team-page__header p {
  margin: var(--ui-space-1, 4px) 0 0;
  color: var(--ui-text-muted, #64748b);
}

/* ==========================================================================
   Invite Button
   ========================================================================== */

.team-page__invite {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 8px);
  padding: var(--ui-space-2, 8px) var(--ui-space-5, 20px);
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-brand-600, #4f7c82);
  background: var(--ui-brand-600, #4f7c82);
  color: var(--ui-surface, #fff);
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 180ms ease,
    transform 180ms ease,
    box-shadow 180ms ease;
}

.team-page__invite:hover {
  background: var(--ui-brand-900, #0b2e33);
  transform: translateY(-1px);
  box-shadow: var(--ui-shadow-xl, 0 16px 28px rgba(11, 46, 51, 0.2));
}

.team-page__invite:focus-visible {
  outline: 2px solid var(--ui-brand-600, #4f7c82);
  outline-offset: 2px;
}

.team-page__invite svg {
  width: 1.1rem;
  height: 1.1rem;
}

/* ==========================================================================
   Team Stats Cards
   ========================================================================== */

.team-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--ui-space-4, 16px);
}

.team-stats__card {
  padding: var(--ui-space-5, 20px) var(--ui-space-6, 24px);
  border-radius: var(--ui-radius-xl, 1.25rem);
  background: var(--ui-brand-50, #f5fcff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-lg, 0 16px 28px rgba(11, 46, 51, 0.12));
}

.team-stats__card p {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: 0.875rem;
}

.team-stats__card strong {
  display: block;
  margin-top: var(--ui-space-2, 8px);
  font-size: 2rem;
  font-weight: 700;
  color: var(--ui-text-strong, #0f172a);
}

.team-stats__card strong.tone-online {
  color: var(--ui-success, #16a34a);
}

/* ==========================================================================
   Search Input
   ========================================================================== */

.team-page__search {
  width: 100%;
}

.team-page__search-input {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 8px);
  padding: var(--ui-space-3, 12px) var(--ui-space-4, 16px);
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: var(--ui-surface, #fff);
  box-shadow: var(--ui-shadow-md, 0 12px 22px rgba(11, 46, 51, 0.1));
}

.team-page__search-input svg {
  width: 1.1rem;
  height: 1.1rem;
  color: var(--ui-text-muted, #64748b);
  flex-shrink: 0;
}

.team-page__search-input input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 1rem;
  color: var(--ui-text, #0b2e33);
}

.team-page__search-input input::placeholder {
  color: var(--ui-text-muted, #64748b);
}

.team-page__search-input input:focus {
  outline: none;
}

.team-page__search-input:focus-within {
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow:
    var(--ui-shadow-md, 0 12px 22px rgba(11, 46, 51, 0.1)),
    0 0 0 3px rgba(79, 124, 130, 0.2);
}

/* ==========================================================================
   Team Grid & Cards
   ========================================================================== */

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--ui-space-5, 20px);
}

.team-card {
  display: grid;
  gap: var(--ui-space-4, 16px);
  padding: var(--ui-space-6, 24px);
  border-radius: var(--ui-radius-xl, 1.25rem);
  background: var(--ui-surface, #fff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-lg, 0 16px 28px rgba(11, 46, 51, 0.12));
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease;
}

.team-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ui-shadow-xl, 0 20px 36px rgba(11, 46, 51, 0.16));
  border-color: var(--ui-brand-600, #4f7c82);
}

.team-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-4, 16px);
}

.team-card__identity {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4, 16px);
}

.team-card__avatar {
  position: relative;
  width: 3rem;
  height: 3rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-100, #e0f2f1);
  color: var(--ui-brand-900, #0b2e33);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ==========================================================================
   Status Indicators
   ========================================================================== */

.status-indicator {
  position: absolute;
  bottom: -0.1rem;
  right: -0.1rem;
  width: 0.85rem;
  height: 0.85rem;
  border-radius: var(--ui-radius-full, 9999px);
  border: 2px solid var(--ui-surface, #fff);
}

.status-online {
  background: var(--ui-success, #16a34a);
}

.status-away {
  background: var(--ui-warning, #f59e0b);
}

.status-offline {
  background: var(--ui-text-muted, #64748b);
}

/* ==========================================================================
   Card Contact & Menu
   ========================================================================== */

.team-card__contact {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1, 4px);
  margin-top: var(--ui-space-1, 4px);
  color: var(--ui-text-muted, #64748b);
  font-size: 0.875rem;
}

.team-card__contact svg {
  width: 0.9rem;
  height: 0.9rem;
  flex-shrink: 0;
}

.team-card__menu {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: transparent;
  color: var(--ui-brand-900, #0b2e33);
  cursor: pointer;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.team-card__menu:hover {
  background: var(--ui-surface-muted, #f1f5f9);
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-sm, 0 4px 8px rgba(11, 46, 51, 0.08));
}

.team-card__menu:focus-visible {
  outline: 2px solid var(--ui-brand-600, #4f7c82);
  outline-offset: 2px;
}

.team-card__menu svg {
  width: 1.1rem;
  height: 1.1rem;
}

/* ==========================================================================
   Badges
   ========================================================================== */

.team-card__badges {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 8px);
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-1, 4px) var(--ui-space-3, 12px);
  border-radius: var(--ui-radius-full, 9999px);
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-muted {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

/* Role: Owner - Brand colors */
.role-owner {
  background: var(--ui-brand-100, #e0f2f1);
  color: var(--ui-brand-900, #0b2e33);
  border: 1px solid var(--ui-brand-600, #4f7c82);
}

/* Role: Admin - Info/Blue tones */
.role-admin {
  background: rgba(59, 130, 246, 0.1);
  color: #1e40af;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

/* Role: Member - Neutral tones */
.role-member {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

/* ==========================================================================
   Card Stats
   ========================================================================== */

.team-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-4, 16px);
  padding-top: var(--ui-space-3, 12px);
  border-top: 1px dashed var(--ui-border, rgba(11, 46, 51, 0.12));
}

.team-card__stats p {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: 0.75rem;
}

.team-card__stats strong {
  display: block;
  margin-top: var(--ui-space-1, 4px);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ui-text-strong, #0f172a);
}

.team-card__stats strong.tone-online {
  color: var(--ui-success, #16a34a);
}

/* ==========================================================================
   Progress Bar
   ========================================================================== */

.team-card__progress {
  display: grid;
  gap: var(--ui-space-2, 8px);
}

.team-card__progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--ui-text-muted, #64748b);
}

.team-card__progress-bar {
  width: 100%;
  height: 0.4rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-surface-muted, #f1f5f9);
  overflow: hidden;
}

.team-card__progress-fill {
  height: 100%;
  border-radius: var(--ui-radius-full, 9999px);
  background: linear-gradient(
    90deg,
    var(--ui-brand-600, #4f7c82) 0%,
    var(--ui-brand-900, #0b2e33) 100%
  );
  transition: width 300ms ease;
}

/* ==========================================================================
   Team Table
   ========================================================================== */

.team-table {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-6, 24px);
  background: var(--ui-surface, #fff);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 12px);
}

.team-table h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ui-text-strong, #0f172a);
}

.team-table__description {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
}

.team-table__scroll {
  overflow-x: auto;
}

.team-table table {
  width: 100%;
  border-collapse: collapse;
}

.team-table th,
.team-table td {
  padding: var(--ui-space-2, 8px);
  text-align: left;
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.team-table th {
  font-weight: 600;
  color: var(--ui-brand-900, #0b2e33);
  background: var(--ui-surface-muted, #f1f5f9);
}

.team-table td {
  color: var(--ui-text, #0b2e33);
}

.team-table tbody tr:hover {
  background: var(--ui-bg, #f5fcff);
}

/* ==========================================================================
   Demo Notice
   ========================================================================== */

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

/* ==========================================================================
   Reduced Motion Support
   ========================================================================== */

@media (prefers-reduced-motion: reduce) {
  .team-page__invite,
  .team-card,
  .team-card__menu,
  .team-card__progress-fill,
  .team-page__search-input {
    transition: none;
  }

  .team-page__invite:hover,
  .team-card:hover {
    transform: none;
  }
}

/* ==========================================================================
   Responsive Breakpoints
   ========================================================================== */

@media (max-width: 1200px) {
  .demo__content--condensed {
    padding: var(--ui-space-6, 24px);
  }
}

@media (max-width: 768px) {
  .demo__content--condensed {
    padding: var(--ui-space-4, 16px);
  }

  .team-page__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .team-page__invite {
    width: 100%;
    justify-content: center;
  }

  .team-stats {
    grid-template-columns: 1fr;
  }

  .team-grid {
    grid-template-columns: 1fr;
  }
}
</style>
