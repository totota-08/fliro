<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppTextarea from "@/components/ui/AppTextarea.vue";
import AppAlert from "@/components/ui/AppAlert.vue";
import { appName } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import { buildFilteredProjectNavItems } from "@/constants/projectNav";
import { ProjectPermission } from "@/constants/permissions";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
import { useProjectAccess } from "@/composables/useProjectAccess";
import ProjectAppShell from "@/layouts/ProjectAppShell.vue";
import { db } from "@/lib/firebase";
import {
  deleteProject,
  fetchProject,
  updateProjectMetadata,
} from "@/firebase/projectService";
import { updateProjectSettings } from "@/services/projectSettings";
import { listenTasks, type TaskDoc } from "@/services/taskService";
import {
  getDashboardSettings,
  saveDashboardSettings,
  type DashboardCardConfig,
} from "@/services/dashboardSettingsService";
import { useAuthStore } from "@/store/auth";
import type { ProjectDoc } from "@/types/project";
import { getLogger } from "@logtape/logtape";
import { collection, getDocs } from "firebase/firestore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

const logger = getLogger("app.pages.projects.ProjectSettings");

const router = useRouter();
const { user, profile } = useAuthStore();
const { projectId } = useProjectIdRoute();
const project = ref<ProjectDoc | null>(null);
const projectList = ref<{ id: string; name: string }[]>([]);
const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const deleteError = ref("");
const deleteConfirmInput = ref("");

// useProjectAccess で権限管理を統一
const { can } = useProjectAccess(projectId);

const canManage = computed(() => can(ProjectPermission.MANAGE_SETTINGS));
const canManageCategories = computed(() =>
  can(ProjectPermission.MANAGE_CATEGORIES),
);
const canManageNotifications = computed(() =>
  can(ProjectPermission.MANAGE_NOTIFICATIONS),
);

const aiEnabled = ref(false);
const aiKey = ref("");
const aiPrompt = ref("");
const aiResponse = ref("");
const aiLoading = ref(false);
const tasks = ref<TaskDoc[]>([]);
let stopTasks: (() => void) | null = null;

// Dashboard card configuration
const cardConfig = ref<DashboardCardConfig[]>([]);
const cardConfigSaving = ref(false);

// カードラベルのマッピング
const CARD_LABELS: Record<string, string> = {
  overdue: "期限切れ",
  "due-soon": "直近の期限",
  active: "進行中",
  done: "完了",
  "weekly-score": "週次スコア",
};

const form = ref({
  name: "",
  description: "",
  isPublic: false,
  allowGuestView: false,
});

const navItems = computed(() =>
  buildFilteredProjectNavItems(projectId.value, can),
);

const sidebarProjects = computed(() =>
  projectList.value.map((entry, index) => ({
    key: entry.id,
    label: entry.name,
    to: { name: ROUTE_NAMES.projectDashboard, params: { projectId: entry.id } },
    accent: ["primary", "secondary", "accent"][index % 3] as
      | "primary"
      | "secondary"
      | "accent",
  })),
);

const profileInfo = computed(() => ({
  name: profile.value?.nickname || profile.value?.fullName || `${appName} User`,
  email: profile.value?.email || "",
}));

const confirmEmail = computed(() => user.value?.email ?? "");
const canDeleteProject = computed(
  () =>
    Boolean(confirmEmail.value) &&
    deleteConfirmInput.value.trim() === confirmEmail.value,
);

const canEdit = computed(() => canManage.value);

const summaryInfo = computed(() => {
  const created = project.value?.createdAt;
  const createdLabel =
    created && typeof created === "object" && "seconds" in created
      ? new Date(
          (created as { seconds: number }).seconds * 1000,
        ).toLocaleDateString()
      : created
        ? new Date(created as string | number | Date).toLocaleDateString()
        : "-";
  return {
    created: createdLabel,
    ownerId: project.value?.ownerUserId ?? "-",
    members: project.value?.stats?.totalMembers ?? "-",
  };
});

function goToCategories() {
  void router.push({
    name: ROUTE_NAMES.projectCategories,
    params: { projectId: projectId.value },
  });
}

function goToNotifications() {
  void router.push({
    name: ROUTE_NAMES.projectNotifications,
    params: { projectId: projectId.value },
  });
}

// ダッシュボードカード設定の読み込み
async function loadCardConfig() {
  if (!user.value) return;
  try {
    const settings = await getDashboardSettings(
      user.value.uid,
      projectId.value,
    );
    cardConfig.value = settings.cards;
  } catch (error) {
    logger.error`Failed to load card config: ${error}`;
    // デフォルト設定を使用
    cardConfig.value = [
      { id: "overdue", type: "overdue", position: 0, visible: true },
      { id: "due-soon", type: "due-soon", position: 1, visible: true },
      { id: "active", type: "active", position: 2, visible: true },
      { id: "done", type: "done", position: 3, visible: true },
    ];
  }
}

// カードの並び順でソート
const sortedCardConfig = computed(() =>
  [...cardConfig.value].sort((a, b) => a.position - b.position),
);

// カードの表示/非表示を切り替え
function toggleCardVisible(cardId: string) {
  const card = cardConfig.value.find((c) => c.id === cardId);
  if (card) {
    card.visible = !card.visible;
  }
}

// カードを上に移動
function moveCardUp(cardId: string) {
  const sorted = [...cardConfig.value].sort((a, b) => a.position - b.position);
  const index = sorted.findIndex((c) => c.id === cardId);
  if (index <= 0) return;
  const current = sorted[index];
  const prev = sorted[index - 1];
  if (!current || !prev) return;
  const temp = current.position;
  current.position = prev.position;
  prev.position = temp;
  cardConfig.value = sorted;
}

// カードを下に移動
function moveCardDown(cardId: string) {
  const sorted = [...cardConfig.value].sort((a, b) => a.position - b.position);
  const index = sorted.findIndex((c) => c.id === cardId);
  if (index < 0 || index >= sorted.length - 1) return;
  const current = sorted[index];
  const next = sorted[index + 1];
  if (!current || !next) return;
  const temp = current.position;
  current.position = next.position;
  next.position = temp;
  cardConfig.value = sorted;
}

// カード設定を保存
async function saveCardConfig() {
  if (!user.value) return;
  cardConfigSaving.value = true;
  try {
    await saveDashboardSettings(
      user.value.uid,
      projectId.value,
      cardConfig.value,
    );
  } catch (error) {
    logger.error`Failed to save card config: ${error}`;
  } finally {
    cardConfigSaving.value = false;
  }
}

// カードのラベルを取得
function getCardLabel(cardId: string): string {
  return CARD_LABELS[cardId] || cardId;
}

async function loadProjectList() {
  if (!user.value) return;
  const snap = await getDocs(
    collection(db, "userProjects", user.value.uid, "projects"),
  );
  projectList.value = snap.docs.map((docSnap, index) => ({
    id: docSnap.id,
    name: (docSnap.data().projectName as string) || `Project ${index + 1}`,
  }));
}

async function loadProject() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const fetched = await fetchProject(projectId.value);
    if (!fetched) {
      errorMessage.value = "プロジェクトが見つかりません。";
      project.value = null;
      return;
    }
    project.value = fetched;
    form.value = {
      name: fetched.name,
      description: fetched.description ?? "",
      isPublic: Boolean(fetched.settings?.isPublic),
      allowGuestView: Boolean(fetched.settings?.allowGuestView),
    };
    aiEnabled.value = Boolean(fetched.settings?.aiChatEnabled);
    aiKey.value = fetched.settings?.aiApiKey ?? "";
  } catch (error) {
    logger.error`Failed to load project settings: ${error}`;
    errorMessage.value = "設定情報の取得に失敗しました。";
  } finally {
    loading.value = false;
  }
}

function watchTasks() {
  stopTasks = listenTasks(projectId.value, (list) => {
    tasks.value = list;
  });
}

async function saveAiSettings() {
  if (!canEdit.value) return;
  try {
    await updateProjectSettings(projectId.value, {
      aiChatEnabled: aiEnabled.value,
      aiApiKey: aiKey.value,
    });
    successMessage.value = "AI設定を保存しました。";
    setTimeout(() => {
      successMessage.value = "";
    }, 3000);
  } catch (error) {
    logger.error`Failed to save AI settings: ${error}`;
    errorMessage.value = "AI設定の保存に失敗しました。";
  }
}

async function askAi() {
  if (!aiEnabled.value) {
    aiResponse.value = "AI チャットは無効化されています。";
    return;
  }
  if (!aiKey.value) {
    aiResponse.value = "先に API キーを設定してください。";
    return;
  }
  if (!aiPrompt.value.trim()) return;
  aiLoading.value = true;
  aiResponse.value = "";
  try {
    const summary = tasks.value
      .slice(0, 10)
      .map((task) => `- ${task.title} [${task.status}]`)
      .join("\n");
    const body = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a task assistant for the ${appName} project.`,
        },
        {
          role: "user",
          content: `Tasks:\n${summary}\nUser question: ${aiPrompt.value}`,
        },
      ],
    };
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiKey.value}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("AI API エラー");
    const data = await response.json();
    aiResponse.value =
      data.choices?.[0]?.message?.content || "回答を取得できませんでした。";
  } catch (error: any) {
    aiResponse.value = error?.message || "AI 応答に失敗しました。";
  } finally {
    aiLoading.value = false;
  }
}

async function handleSave() {
  if (!canEdit.value || !project.value) return;
  if (!form.value.name.trim()) {
    errorMessage.value = "プロジェクト名は必須です。";
    return;
  }
  saving.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await updateProjectMetadata(projectId.value, {
      name: form.value.name,
      description: form.value.description,
      isPublic: form.value.isPublic,
      allowGuestView: form.value.allowGuestView,
    });
    successMessage.value = "設定を保存しました。";
  } catch (error) {
    logger.error`Failed to save project settings: ${error}`;
    errorMessage.value = "設定の保存に失敗しました。";
  } finally {
    saving.value = false;
  }
}

async function handleDelete() {
  deleteError.value = "";
  if (!canEdit.value || !project.value) {
    deleteError.value = "設定を変更する権限がありません。";
    return;
  }
  if (!canDeleteProject.value) {
    deleteError.value =
      "本人確認のため、メールアドレスを正しく入力してください。";
    return;
  }
  if (!confirm("このプロジェクトを完全に削除します。よろしいですか？")) {
    return;
  }
  deleting.value = true;
  try {
    await deleteProject(projectId.value);
    await router.push({ name: ROUTE_NAMES.myPage });
  } catch (error) {
    logger.error`Failed to delete project: ${error}`;
    deleteError.value = "プロジェクトの削除に失敗しました。";
  } finally {
    deleting.value = false;
  }
}

onMounted(async () => {
  await loadProjectList();
  await loadProject();
  await loadCardConfig();
  watchTasks();
});

onBeforeUnmount(() => {
  stopTasks?.();
});

watch(projectId, async (newId, oldId) => {
  if (!newId || newId === oldId) return;
  stopTasks?.();
  await loadProject();
  await loadCardConfig();
  watchTasks();
});
</script>

<template>
  <ProjectAppShell
    :project-id="projectId"
    :nav-items="navItems"
    :sidebar-projects="sidebarProjects"
    :profile-info="profileInfo"
    brand-subtitle="プロジェクト設定"
  >
    <template #headerTitle>
      <p class="project-app-shell__breadcrumb">プロジェクト &gt; 設定</p>
      <h1 class="project-app-shell__heading">{{ project?.name || "設定" }}</h1>
    </template>

    <AppAlert v-if="!canEdit" variant="warning" class="settings-alert">
      <template #title>管理者限定</template>
      このページは管理者のみが利用できます。権限をご確認ください。
    </AppAlert>
    <div v-else class="settings-container">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>読み込み中...</p>
      </div>

      <div v-else-if="errorMessage" class="error-state">
        <p>{{ errorMessage }}</p>
      </div>

      <template v-else>
        <div class="settings-grid">
          <!-- Main Settings Column -->
          <div class="settings-main">
            <section class="card" :class="{ 'is-disabled': !canEdit }">
              <header class="card-header">
                <div class="card-header__icon">
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2>基本設定</h2>
                  <p>プロジェクトの基本情報を管理します</p>
                </div>
              </header>

              <form @submit.prevent="handleSave" class="form-stack">
                <AppInput
                  id="projectName"
                  v-model="form.name"
                  label="プロジェクト名"
                  :disabled="!canEdit"
                  required
                  placeholder="プロジェクト名を入力"
                />

                <AppTextarea
                  id="projectDesc"
                  v-model="form.description"
                  label="説明"
                  :rows="4"
                  :disabled="!canEdit"
                  placeholder="プロジェクトの目的や概要を入力してください"
                />

                <div class="form-toggles">
                  <label class="toggle-switch">
                    <input
                      type="checkbox"
                      v-model="form.isPublic"
                      :disabled="!canEdit"
                    />
                    <span class="toggle-slider"></span>
                    <span class="toggle-label">
                      <span class="toggle-title">公開プロジェクト</span>
                      <span class="toggle-desc"
                        >誰でもこのプロジェクトを閲覧できるようになります</span
                      >
                    </span>
                  </label>

                  <label class="toggle-switch">
                    <input
                      type="checkbox"
                      v-model="form.allowGuestView"
                      :disabled="!canEdit"
                    />
                    <span class="toggle-slider"></span>
                    <span class="toggle-label">
                      <span class="toggle-title">ゲスト閲覧を許可</span>
                      <span class="toggle-desc"
                        >アカウントを持たないユーザーも閲覧可能にします</span
                      >
                    </span>
                  </label>
                </div>

                <div class="form-actions">
                  <AppButton
                    type="submit"
                    :loading="saving"
                    :disabled="!canEdit"
                    variant="primary"
                  >
                    変更を保存
                  </AppButton>
                  <transition name="fade">
                    <span v-if="successMessage" class="success-badge">
                      <svg
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        width="16"
                        height="16"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {{ successMessage }}
                    </span>
                  </transition>
                </div>
              </form>
            </section>

            <!-- ダッシュボードカード設定セクション -->
            <section class="card">
              <header class="card-header">
                <div class="card-header__icon">
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                </div>
                <div>
                  <h2>ダッシュボードカード設定</h2>
                  <p>サマリーカードの表示・並び順を管理します</p>
                </div>
              </header>

              <div class="form-stack">
                <div class="card-config-list">
                  <div
                    v-for="(config, index) in sortedCardConfig"
                    :key="config.id"
                    class="card-config-item"
                  >
                    <label class="card-config-checkbox">
                      <input
                        type="checkbox"
                        :checked="config.visible"
                        @change="toggleCardVisible(config.id)"
                      />
                      <span class="card-config-label">{{
                        getCardLabel(config.id)
                      }}</span>
                    </label>
                    <div class="card-config-actions">
                      <button
                        type="button"
                        class="card-config-btn"
                        :disabled="index === 0"
                        @click="moveCardUp(config.id)"
                        aria-label="上に移動"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="card-config-btn"
                        :disabled="index === sortedCardConfig.length - 1"
                        @click="moveCardDown(config.id)"
                        aria-label="下に移動"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="form-actions">
                  <AppButton
                    type="button"
                    :loading="cardConfigSaving"
                    variant="primary"
                    @click="saveCardConfig"
                  >
                    設定を保存
                  </AppButton>
                </div>
              </div>
            </section>

            <section class="card" :class="{ 'is-disabled': !canEdit }">
              <header class="card-header">
                <div class="card-header__icon">
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div>
                  <h2>AI アシスタント</h2>
                  <p>OpenAI API を使用してタスクのサポートを行います</p>
                </div>
              </header>

              <div class="form-stack">
                <div class="form-toggles">
                  <label class="toggle-switch">
                    <input
                      type="checkbox"
                      v-model="aiEnabled"
                      :disabled="!canEdit"
                    />
                    <span class="toggle-slider"></span>
                    <span class="toggle-label">
                      <span class="toggle-title">AI アシスタントを有効化</span>
                      <span class="toggle-desc"
                        >タスクの内容に基づいてAIが回答します</span
                      >
                    </span>
                  </label>
                </div>

                <AppInput
                  id="aiKey"
                  v-model="aiKey"
                  type="password"
                  label="OpenAI API Key"
                  :disabled="!canEdit"
                  placeholder="sk-..."
                />

                <div class="form-actions">
                  <AppButton
                    type="button"
                    :disabled="!canEdit"
                    variant="primary"
                    @click="saveAiSettings"
                  >
                    設定を保存
                  </AppButton>
                </div>

                <div v-if="aiEnabled" class="ai-playground">
                  <h3>テストチャット</h3>
                  <AppTextarea
                    v-model="aiPrompt"
                    placeholder="タスクについて質問してください"
                  />
                  <div class="form-actions">
                    <AppButton
                      type="button"
                      :disabled="aiLoading || !aiKey"
                      @click="askAi"
                    >
                      {{ aiLoading ? "応答中..." : "AIに聞く" }}
                    </AppButton>
                  </div>
                  <div v-if="aiResponse" class="ai-response">
                    <p>{{ aiResponse }}</p>
                  </div>
                </div>
              </div>
            </section>

            <section class="card card--danger">
              <header class="card-header">
                <div class="card-header__icon danger-icon">
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </div>
                <div>
                  <h2>プロジェクトの削除</h2>
                  <p>
                    この操作は取り消すことができません。慎重に操作してください。
                  </p>
                </div>
              </header>

              <div class="danger-content">
                <div class="danger-warning">
                  <p>
                    プロジェクトを削除すると、関連するすべてのタスク、チャット、ファイルが完全に削除されます。
                  </p>
                </div>

                <AppInput
                  id="deleteConfirm"
                  v-model="deleteConfirmInput"
                  type="email"
                  label="確認のため、メールアドレスを入力してください"
                  :error="Boolean(deleteError)"
                  :placeholder="confirmEmail"
                />

                <div class="danger-actions">
                  <AppButton
                    variant="danger"
                    :disabled="!canDeleteProject || deleting"
                    :loading="deleting"
                    @click="handleDelete"
                  >
                    プロジェクトを削除
                  </AppButton>
                </div>
              </div>
            </section>
          </div>

          <!-- Sidebar Info Column -->
          <aside class="settings-sidebar">
            <div class="info-card">
              <h3>プロジェクト情報</h3>
              <dl class="info-list">
                <div class="info-item">
                  <dt>作成日</dt>
                  <dd>{{ summaryInfo.created }}</dd>
                </div>
                <div class="info-item">
                  <dt>オーナー</dt>
                  <dd class="truncate" :title="summaryInfo.ownerId">
                    {{ summaryInfo.ownerId }}
                  </dd>
                </div>
                <div class="info-item">
                  <dt>メンバー数</dt>
                  <dd>{{ summaryInfo.members }}名</dd>
                </div>
              </dl>
            </div>

            <div class="info-card">
              <h3>関連設定</h3>
              <div class="related-links">
                <button
                  v-if="canManageCategories"
                  type="button"
                  class="related-link"
                  @click="goToCategories"
                >
                  <span class="related-link__icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                  </span>
                  <span class="related-link__text">
                    <span class="related-link__title">カテゴリ管理</span>
                    <span class="related-link__desc"
                      >タスクのカテゴリを管理</span
                    >
                  </span>
                  <span class="related-link__arrow">→</span>
                </button>
                <button
                  v-if="canManageNotifications"
                  type="button"
                  class="related-link"
                  @click="goToNotifications"
                >
                  <span class="related-link__icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                  </span>
                  <span class="related-link__text">
                    <span class="related-link__title">通知設定</span>
                    <span class="related-link__desc">通知の設定を管理</span>
                  </span>
                  <span class="related-link__arrow">→</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </template>
    </div>
  </ProjectAppShell>
</template>

<style scoped>
/* Layout & Container */
.settings-alert {
  max-width: 760px;
  margin: 0 auto var(--ui-space-4, 1rem);
}

.settings-container {
  max-width: 760px;
  margin: 0 auto;
  padding: var(--ui-space-6, 1.5rem);
  animation: fadeIn var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-6, 1.5rem);
  align-items: start;
}

/* Cards */
.card {
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-xl, 1.25rem);
  box-shadow: var(--ui-shadow-md);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  overflow: hidden;
  margin-bottom: var(--ui-space-8, 2rem);
}

.card-header {
  padding: var(--ui-space-6, 1.5rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-4, 1rem);
}

.card-header__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-600, #4f7c82);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-header__icon svg {
  width: 24px;
  height: 24px;
}

.card-header h2 {
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
  margin: 0 0 var(--ui-space-1, 0.25rem) 0;
}

.card-header p {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  margin: 0;
}

/* Forms */
.form-stack {
  padding: var(--ui-space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
}

/* Toggles */
.form-toggles {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.toggle-switch {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-3, 0.75rem);
  cursor: pointer;
}

.toggle-switch input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background-color: var(--ui-border-strong, rgba(11, 46, 51, 0.2));
  border-radius: var(--ui-radius-full, 9999px);
  transition: var(--ui-transition-colors);
  flex-shrink: 0;
  margin-top: 2px;
}

.toggle-slider:before {
  content: "";
  position: absolute;
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: var(--ui-radius-full, 9999px);
  transition: var(--ui-transition-transform);
  box-shadow: var(--ui-shadow-sm);
}

.toggle-switch input:checked + .toggle-slider {
  background-color: var(--ui-brand-600, #4f7c82);
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.toggle-label {
  display: flex;
  flex-direction: column;
}

.toggle-title {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
}

.toggle-desc {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

/* Actions */
.form-actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
  margin-top: var(--ui-space-2, 0.5rem);
}

.success-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  background: var(--ui-success-bg, #ecfdf5);
  color: var(--ui-success, #16a34a);
  border-radius: var(--ui-radius-full, 9999px);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
}

/* Danger Zone */
.card--danger {
  border-color: var(--ui-danger-bg, #fee2e2);
}

.card--danger .card-header {
  background: var(--ui-danger-bg, #fee2e2);
  border-bottom-color: var(--ui-danger-bg, #fee2e2);
}

.card--danger .card-header__icon {
  background: rgba(214, 69, 69, 0.1);
  color: var(--ui-danger, #d64545);
}

.danger-content {
  padding: var(--ui-space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
}

.danger-warning {
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-danger-bg, #fee2e2);
  border-radius: var(--ui-radius-sm, 0.5rem);
  color: #991b1b;
  font-size: var(--ui-text-sm, 0.875rem);
  border-left: 4px solid var(--ui-danger, #d64545);
}

.danger-actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
  flex-wrap: wrap;
}

/* Sidebar Info */
.info-card {
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-6, 1.5rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-sm);
}

.info-card h3 {
  font-size: var(--ui-text-xs, 0.75rem);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ui-text-muted, #64748b);
  margin: 0 0 var(--ui-space-4, 1rem) 0;
  font-weight: var(--ui-font-semibold, 600);
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  margin: 0;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--ui-text-sm, 0.875rem);
}

.info-item dt {
  color: var(--ui-text-muted, #64748b);
}

.info-item dd {
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-strong, #0f172a);
  max-width: 150px;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Related Links */
.related-links {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.related-link {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  cursor: pointer;
  text-align: left;
  transition: var(--ui-transition-all);
  width: 100%;
}

.related-link:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-brand-100, #e5f6f8);
}

.related-link:focus {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.related-link__icon {
  width: 32px;
  height: 32px;
  border-radius: var(--ui-radius-sm, 0.5rem);
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-600, #4f7c82);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.related-link__icon svg {
  width: 18px;
  height: 18px;
}

.related-link__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.related-link__title {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.related-link__desc {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.related-link__arrow {
  color: var(--ui-text-muted, #64748b);
  font-weight: var(--ui-font-semibold, 600);
}

/* Loading & Animations */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-16, 4rem);
  color: var(--ui-text-muted, #64748b);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-top-color: var(--ui-brand-600, #4f7c82);
  border-radius: var(--ui-radius-full, 9999px);
  animation: spin 1s linear infinite;
  margin-bottom: var(--ui-space-4, 1rem);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.ai-playground {
  margin-top: var(--ui-space-6, 1.5rem);
  padding-top: var(--ui-space-6, 1.5rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.ai-playground h3 {
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
  margin: 0 0 var(--ui-space-4, 1rem) 0;
}

.ai-response {
  margin-top: var(--ui-space-4, 1rem);
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-brand-100, #e5f6f8);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-brand-200, #b8e3e9);
  color: var(--ui-brand-900, #0b2e33);
  font-size: var(--ui-text-sm, 0.875rem);
  white-space: pre-wrap;
}

.error-state {
  padding: var(--ui-space-8, 2rem);
  text-align: center;
  color: var(--ui-danger, #d64545);
}

/* Card Config (Dashboard Card Settings) */
.card-config-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.card-config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-surface-muted, #f8fafa);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.card-config-checkbox {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  cursor: pointer;
}

.card-config-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--ui-brand-600, #4f7c82);
  cursor: pointer;
}

.card-config-label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
}

.card-config-actions {
  display: flex;
  gap: var(--ui-space-1, 0.25rem);
}

.card-config-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.15));
  border-radius: var(--ui-radius-sm, 0.5rem);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.card-config-btn:hover:not(:disabled) {
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-brand-100, #e5f6f8);
}

.card-config-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
</style>
