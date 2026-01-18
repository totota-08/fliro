<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import DashboardSidebar from "@/components/demo/DashboardSidebar.vue";

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

const isSidebarOpen = ref(true);

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

const closeSidebar = () => {
  isSidebarOpen.value = false;
};

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

onMounted(() => {
  if (window.matchMedia("(max-width: 1200px)").matches) {
    isSidebarOpen.value = false;
  }
});

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
        <div class="demo__toolbar">
          <button type="button">共有</button>
          <button type="button" class="is-primary">エクスポート</button>
        </div>
      </header>

      <div class="demo__content demo__content--condensed">
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
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import "@/pages/demo/styles/demo-shell.css";

.demo__content--condensed {
  padding: var(--ui-space-8, 2rem);
}

.team-page {
  display: grid;
  gap: var(--ui-space-8, 2rem);
}

.team-page__header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
}

.team-page__header h2 {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, var(--ui-text-4xl, 2rem));
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.team-page__header p {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-text-muted, #64748b);
}

.team-page__invite {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-5, 1.25rem);
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-brand-400, rgba(79, 124, 130, 0.35));
  background: var(--ui-brand-600, #4f7c82);
  color: var(--ui-text-inverse, #f5fcff);
  font-weight: var(--ui-font-semibold, 600);
  cursor: pointer;
  transition: var(--ui-transition-all, all 180ms ease);
}

.team-page__invite:hover {
  background: var(--ui-brand-900, #0b2e33);
  transform: translateY(-1px);
  box-shadow: var(--ui-shadow-xl, 0 16px 28px rgba(11, 46, 51, 0.2));
}

.team-page__invite svg {
  width: 1.1rem;
  height: 1.1rem;
}

.team-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--ui-space-4, 1rem);
}

.team-stats__card {
  padding: var(--ui-space-5, 1.25rem) var(--ui-space-6, 1.5rem);
  border-radius: var(--ui-radius-xl, 1.25rem);
  background: var(--ui-brand-50, rgba(245, 252, 255, 0.9));
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.1));
  box-shadow: var(--ui-shadow-lg, 0 16px 28px rgba(11, 46, 51, 0.12));
}

.team-stats__card p {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.team-stats__card strong {
  display: block;
  margin-top: var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-4xl, 2rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.team-stats__card strong.tone-online {
  color: var(--ui-success-dark, #1c8d72);
}

.team-page__search {
  width: 100%;
}

.team-page__search-input {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.12));
  background: var(--ui-surface-glass, rgba(255, 255, 255, 0.8));
  box-shadow: var(--ui-shadow-md, 0 12px 22px rgba(11, 46, 51, 0.1));
}

.team-page__search-input svg {
  width: 1.1rem;
  height: 1.1rem;
  color: var(--ui-text-muted, #64748b);
}

.team-page__search-input input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: var(--ui-text-base, 1rem);
  color: var(--ui-text, #0b2e33);
}

.team-page__search-input input:focus {
  outline: none;
  box-shadow: var(--ui-ring-focus, 0 0 0 3px rgba(79, 124, 130, 0.2));
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--ui-space-5, 1.25rem);
}

.team-card {
  display: grid;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-6, 1.5rem);
  border-radius: var(--ui-radius-xl, 1.25rem);
  background: var(--ui-brand-50, rgba(245, 252, 255, 0.95));
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-xl, 0 18px 32px rgba(11, 46, 51, 0.14));
  transition: var(--ui-transition-all, all 180ms ease);
}

.team-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ui-shadow-2xl, 0 22px 40px rgba(11, 46, 51, 0.18));
  border-color: var(--ui-brand-400, rgba(79, 124, 130, 0.35));
}

.team-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
}

.team-card__identity {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
}

.team-card__avatar {
  position: relative;
  width: 3rem;
  height: 3rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-200, rgba(184, 227, 233, 0.9));
  color: var(--ui-brand-900, #0b2e33);
  font-weight: var(--ui-font-bold, 700);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.status-indicator {
  position: absolute;
  bottom: -0.1rem;
  right: -0.1rem;
  width: 0.85rem;
  height: 0.85rem;
  border-radius: var(--ui-radius-full, 9999px);
  border: 2px solid var(--ui-brand-50, rgba(245, 252, 255, 0.95));
}

.status-online {
  background: var(--ui-success, #2a9d8f);
}

.status-away {
  background: var(--ui-warning, #f4a261);
}

.status-offline {
  background: var(--ui-neutral, rgba(11, 46, 51, 0.3));
}

.team-card__contact {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  margin-top: var(--ui-space-1, 0.25rem);
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.team-card__contact svg {
  width: 0.9rem;
  height: 0.9rem;
}

.team-card__menu {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.14));
  background: transparent;
  color: var(--ui-brand-900, #0b2e33);
  cursor: pointer;
  transition: var(--ui-transition-all, all 180ms ease);
}

.team-card__menu:hover {
  background: var(--ui-brand-100, rgba(184, 227, 233, 0.15));
  border-color: var(--ui-border-strong, rgba(11, 46, 51, 0.22));
  box-shadow: var(--ui-shadow-md, 0 10px 18px rgba(11, 46, 51, 0.12));
}

.team-card__menu svg {
  width: 1.1rem;
  height: 1.1rem;
}

.team-card__badges {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
}

.badge-muted {
  background: var(--ui-neutral-bg, rgba(11, 46, 51, 0.08));
  color: var(--ui-text-muted, #64748b);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.15));
}

.role-owner {
  background: var(--ui-brand-100, rgba(79, 124, 130, 0.2));
  color: var(--ui-brand-900, #0b2e33);
  border: 1px solid var(--ui-brand-400, rgba(79, 124, 130, 0.35));
}

.role-admin {
  background: var(--ui-info-bg, rgba(86, 108, 141, 0.25));
  color: var(--ui-info-dark, #2f4b66);
  border: 1px solid var(--ui-info-border, rgba(86, 108, 141, 0.35));
}

.role-member {
  background: var(--ui-neutral-bg, rgba(11, 46, 51, 0.08));
  color: var(--ui-text-muted, #64748b);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.15));
}

.team-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-4, 1rem);
  padding-top: var(--ui-space-3, 0.75rem);
  border-top: 1px dashed var(--ui-border, rgba(11, 46, 51, 0.14));
}

.team-card__stats p {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-xs, 0.75rem);
}

.team-card__stats strong {
  display: block;
  margin-top: var(--ui-space-1, 0.25rem);
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.team-card__stats strong.tone-online {
  color: var(--ui-success-dark, #1c8d72);
}

.team-card__progress {
  display: grid;
  gap: var(--ui-space-2, 0.5rem);
}

.team-card__progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.team-card__progress-bar {
  width: 100%;
  height: 0.4rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-100, rgba(11, 46, 51, 0.1));
  overflow: hidden;
}

.team-card__progress-fill {
  height: 100%;
  border-radius: var(--ui-radius-full, 9999px);
  background: linear-gradient(
    90deg,
    var(--ui-brand-600, #4f7c82),
    var(--ui-brand-900, rgba(11, 46, 51, 0.9))
  );
  transition: width 300ms var(--ui-ease-standard, ease);
}

.team-table {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-6, 1.5rem);
  background: var(--ui-surface-elevated, #fff);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.team-table h3 {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
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
  padding: var(--ui-space-2, 0.5rem);
  text-align: left;
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.team-table th {
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-brand-900, #0b2e33);
  background: var(--ui-surface-muted, rgba(11, 46, 51, 0.04));
}

.team-table td {
  color: var(--ui-text, #0b2e33);
}

@media (prefers-reduced-motion: reduce) {
  .team-page__invite,
  .team-card,
  .team-card__menu,
  .team-card__progress-fill {
    transition: none;
  }
}

@media (max-width: 1200px) {
  .demo__content--condensed {
    padding: var(--ui-space-7, 1.75rem);
  }
}

@media (max-width: 768px) {
  .team-page__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .team-page__invite {
    width: 100%;
    justify-content: center;
  }
}
</style>
