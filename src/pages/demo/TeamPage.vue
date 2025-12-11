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
    <div v-if="isSidebarOpen" class="demo__overlay" @click="closeSidebar" />

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
  padding: 2rem;
}

.team-page {
  display: grid;
  gap: 2rem;
}

.team-page__header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
}

.team-page__header h2 {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2rem);
  font-weight: 700;
  color: var(--text-strong);
}

.team-page__header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.team-page__invite {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 1.4rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(79, 124, 130, 0.35);
  background: var(--primary);
  color: var(--surface-elevated, #f5fcff);
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.team-page__invite:hover {
  background: var(--primary-strong);
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgba(11, 46, 51, 0.2);
}

.team-page__invite svg {
  width: 1.1rem;
  height: 1.1rem;
}

.team-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.team-stats__card {
  padding: 1.25rem 1.5rem;
  border-radius: 1.25rem;
  background: rgba(245, 252, 255, 0.9);
  border: 1px solid rgba(11, 46, 51, 0.1);
  box-shadow: 0 16px 28px rgba(11, 46, 51, 0.12);
}

.team-stats__card p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.team-stats__card strong {
  display: block;
  margin-top: 0.45rem;
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-strong);
}

.team-stats__card strong.tone-online {
  color: #1c8d72;
}

.team-page__search {
  width: 100%;
}

.team-page__search-input {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(11, 46, 51, 0.12);
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 12px 22px rgba(11, 46, 51, 0.1);
}

.team-page__search-input svg {
  width: 1.1rem;
  height: 1.1rem;
  color: var(--text-muted);
}

.team-page__search-input input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: var(--text);
}

.team-page__search-input input:focus {
  outline: none;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
}

.team-card {
  display: grid;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 1.25rem;
  background: rgba(245, 252, 255, 0.95);
  border: 1px solid rgba(11, 46, 51, 0.12);
  box-shadow: 0 18px 32px rgba(11, 46, 51, 0.14);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.team-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 40px rgba(11, 46, 51, 0.18);
  border-color: rgba(79, 124, 130, 0.35);
}

.team-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.team-card__identity {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.team-card__avatar {
  position: relative;
  width: 3rem;
  height: 3rem;
  border-radius: 999px;
  background: rgba(184, 227, 233, 0.9);
  color: #0b2e33;
  font-weight: 700;
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
  border-radius: 999px;
  border: 2px solid rgba(245, 252, 255, 0.95);
}

.status-online {
  background: #2a9d8f;
}

.status-away {
  background: #f4a261;
}

.status-offline {
  background: rgba(11, 46, 51, 0.3);
}

.team-card__contact {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.25rem;
  color: var(--text-muted);
  font-size: 0.85rem;
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
  border-radius: 0.75rem;
  border: 1px solid rgba(11, 46, 51, 0.14);
  background: transparent;
  color: var(--primary-strong);
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.team-card__menu:hover {
  background: rgba(184, 227, 233, 0.15);
  border-color: rgba(11, 46, 51, 0.22);
  box-shadow: 0 10px 18px rgba(11, 46, 51, 0.12);
}

.team-card__menu svg {
  width: 1.1rem;
  height: 1.1rem;
}

.team-card__badges {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-muted {
  background: rgba(11, 46, 51, 0.08);
  color: var(--text-muted);
  border: 1px solid rgba(11, 46, 51, 0.15);
}

.role-owner {
  background: rgba(79, 124, 130, 0.2);
  color: #0b2e33;
  border: 1px solid rgba(79, 124, 130, 0.35);
}

.role-admin {
  background: rgba(86, 108, 141, 0.25);
  color: #2f4b66;
  border: 1px solid rgba(86, 108, 141, 0.35);
}

.role-member {
  background: rgba(11, 46, 51, 0.08);
  color: var(--text-muted);
  border: 1px solid rgba(11, 46, 51, 0.15);
}

.team-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px dashed rgba(11, 46, 51, 0.14);
}

.team-card__stats p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.team-card__stats strong {
  display: block;
  margin-top: 0.3rem;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-strong);
}

.team-card__stats strong.tone-online {
  color: #1c8d72;
}

.team-card__progress {
  display: grid;
  gap: 0.5rem;
}

.team-card__progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.team-card__progress-bar {
  width: 100%;
  height: 0.4rem;
  border-radius: 999px;
  background: rgba(11, 46, 51, 0.1);
  overflow: hidden;
}

.team-card__progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #4f7c82, rgba(11, 46, 51, 0.9));
  transition: width 0.3s ease;
}

.team-table {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1.25rem;
  padding: 1.5rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.team-table__description {
  margin: 0;
  color: var(--text-muted);
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
  padding: 0.65rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid rgba(11, 46, 51, 0.08);
}

.team-table th {
  font-weight: 600;
  color: #0b2e33;
  background: rgba(11, 46, 51, 0.04);
}

@media (max-width: 1200px) {
  .demo__content--condensed {
    padding: 1.75rem;
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
