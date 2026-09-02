<script setup lang="ts">
import ZeldaPuzzleEffect from "@/components/effects/ZeldaPuzzleEffect.vue";
import ConfirmGuestAccessModal from "@/components/modals/ConfirmGuestAccessModal.vue";
import MFAVerificationModal from "@/components/modals/MFAVerificationModal.vue";
import DangerZoneCard from "@/components/settings/DangerZoneCard.vue";
import SettingsLinkList from "@/components/settings/SettingsLinkList.vue";
import SettingsSectionCard from "@/components/settings/SettingsSectionCard.vue";
import SettingsToggleRow from "@/components/settings/SettingsToggleRow.vue";
import AppAlert from "@/components/ui/AppAlert.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppTextarea from "@/components/ui/AppTextarea.vue";
import { usePageTitle } from "@/composables/usePageTitle";
import { useProjectAccess } from "@/composables/useProjectAccess";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
// AI機能はグレーアウトのため未使用
// import { appName } from "@/constants/appMeta";
import {
  DEFAULT_GUEST_ALLOWED_PAGES,
  GUEST_CONFIGURABLE_PAGES,
} from "@/constants/guestPages";
import { ProjectPermission } from "@/constants/permissions";
import { ROUTE_NAMES } from "@/constants/routes";
import type { GuestAllowedPage } from "@/types/project";
import {
  getMFAEnrollmentStatus,
  reauthenticateWithPassword,
  completeMFAReauthentication,
} from "@/firebase/authService";
import {
  deleteProject,
  fetchProject,
  updateProjectMetadata,
} from "@/firebase/projectService";
import type { MultiFactorResolver } from "firebase/auth";
import { db } from "@/lib/firebase";
import {
  getDashboardSettings,
  getDefaultInsightCards,
  saveDashboardSettings,
  saveInsightCardSettings,
  type DashboardCardConfig,
  type InsightCardConfig,
} from "@/services/dashboardSettingsService";
import { updateProjectSettings } from "@/services/projectSettings";
import { listenTasks, type TaskDoc } from "@/services/taskService";
import { useAuthStore } from "@/store/auth";
import type { ProjectDoc } from "@/types/project";
import { getLogger } from "@logtape/logtape";
import { collection, getDocs } from "firebase/firestore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

const logger = getLogger("app.pages.projects.ProjectSettings");

const router = useRouter();
const { user } = useAuthStore();
const { projectId } = useProjectIdRoute();
const project = ref<ProjectDoc | null>(null);

// ページタイトル設定
const { setTitle } = usePageTitle("設定", "プロジェクトの設定を管理します");
watch(
  project,
  (p) => {
    if (p?.name) setTitle(p.name);
  },
  { immediate: true },
);
const projectList = ref<{ id: string; name: string }[]>([]);
const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const deleteError = ref("");
const deleteConfirmInput = ref("");

// MFA state for project deletion
const showDeleteMFAModal = ref(false);
const deleteMFAError = ref("");
const deleteMFAResolver = ref<MultiFactorResolver | null>(null);
const mfaEnrolled = ref(false);
const showPasswordModal = ref(false);
const deletePassword = ref("");

// useProjectAccess で権限管理を統一
const { can } = useProjectAccess(projectId);

const canManage = computed(() => can(ProjectPermission.MANAGE_SETTINGS));
const canManageCategories = computed(() =>
  can(ProjectPermission.MANAGE_CATEGORIES),
);
const canManageNotifications = computed(() =>
  can(ProjectPermission.MANAGE_NOTIFICATIONS),
);

// AI設定（現在グレーアウトのため最小限の変数のみ保持）
const aiEnabled = ref(false);
const aiKey = ref("");
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const tasks = ref<TaskDoc[]>([]);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let stopTasks: (() => void) | null = null;

// ユーモラスコマンド設定
const humorousEnabled = ref(false);
const initialHumorousEnabled = ref(false);
const humorousSaving = ref(false);
const showZeldaEffect = ref(false);

// Dashboard card configuration
const cardConfig = ref<DashboardCardConfig[]>([]);
const cardConfigSaving = ref(false);
const initialCardConfig = ref<string>("");

// Insight card configuration
const insightCardConfig = ref<InsightCardConfig[]>([]);
const insightCardConfigSaving = ref(false);
const initialInsightCardConfig = ref<string>("");

// カードラベルのマッピング
const CARD_LABELS: Record<string, string> = {
  overdue: "期限切れ",
  "due-soon": "直近の期限",
  active: "進行中",
  done: "完了",
  "weekly-score": "週次スコア",
};

// インサイトカードラベルのマッピング
const INSIGHT_CARD_LABELS: Record<string, string> = {
  progress: "全体の進捗",
  status: "ステータス別タスク数",
  health: "ヘルススコア",
};

// 基本設定フォーム
const form = ref({
  name: "",
  description: "",
});
const initialForm = ref({ name: "", description: "" });

// 公開設定フォーム
const publicSettings = ref<{
  isPublic: boolean;
  guestAllowedPages: GuestAllowedPage[];
}>({
  isPublic: false,
  guestAllowedPages: [...DEFAULT_GUEST_ALLOWED_PAGES],
});
const initialPublicSettings = ref({
  isPublic: false,
  guestAllowedPages: [...DEFAULT_GUEST_ALLOWED_PAGES],
});
const publicSaving = ref(false);

// 公開設定確認モーダル
const isPublicConfirmModalOpen = ref(false);

// AI設定の初期値
const initialAiSettings = ref({ enabled: false, key: "" });

const confirmEmail = computed(() => user.value?.email ?? "");
const canDeleteProject = computed(
  () =>
    Boolean(confirmEmail.value) &&
    deleteConfirmInput.value.trim() === confirmEmail.value,
);

const canEdit = computed(() => canManage.value);

// dirty flags
const isBasicDirty = computed(
  () =>
    form.value.name !== initialForm.value.name ||
    form.value.description !== initialForm.value.description,
);

const isPublicDirty = computed(
  () =>
    publicSettings.value.isPublic !== initialPublicSettings.value.isPublic ||
    JSON.stringify(publicSettings.value.guestAllowedPages.sort()) !==
      JSON.stringify(initialPublicSettings.value.guestAllowedPages.sort()),
);

const isCardConfigDirty = computed(
  () => JSON.stringify(cardConfig.value) !== initialCardConfig.value,
);

const isInsightCardConfigDirty = computed(
  () =>
    JSON.stringify(insightCardConfig.value) !== initialInsightCardConfig.value,
);

const isHumorousDirty = computed(
  () => humorousEnabled.value !== initialHumorousEnabled.value,
);

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

// 関連設定リンク
const relatedLinks = computed(() => {
  const links = [];
  if (canManageCategories.value) {
    links.push({
      title: "カテゴリ管理",
      description: "タスクのカテゴリを管理",
      onClick: goToCategories,
    });
  }
  if (canManageNotifications.value) {
    links.push({
      title: "通知設定",
      description: "通知の設定を管理",
      onClick: goToNotifications,
    });
  }
  return links;
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
    initialCardConfig.value = JSON.stringify(settings.cards);
    // インサイトカード設定も読み込み
    insightCardConfig.value = settings.insightCards ?? getDefaultInsightCards();
    initialInsightCardConfig.value = JSON.stringify(insightCardConfig.value);
  } catch (error) {
    logger.error`Failed to load card config: ${error}`;
    const defaultConfig = [
      { id: "overdue", type: "overdue", position: 0, visible: true },
      { id: "due-soon", type: "due-soon", position: 1, visible: true },
      { id: "active", type: "active", position: 2, visible: true },
      { id: "done", type: "done", position: 3, visible: true },
    ];
    cardConfig.value = defaultConfig;
    initialCardConfig.value = JSON.stringify(defaultConfig);
    // インサイトカードのデフォルト
    insightCardConfig.value = getDefaultInsightCards();
    initialInsightCardConfig.value = JSON.stringify(insightCardConfig.value);
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
  if (!user.value || !isCardConfigDirty.value) return;
  cardConfigSaving.value = true;
  try {
    await saveDashboardSettings(
      user.value.uid,
      projectId.value,
      cardConfig.value,
      insightCardConfig.value,
    );
    initialCardConfig.value = JSON.stringify(cardConfig.value);
  } catch (error) {
    logger.error`Failed to save card config: ${error}`;
  } finally {
    cardConfigSaving.value = false;
  }
}

// インサイトカードの並び順でソート
const sortedInsightCardConfig = computed(() =>
  [...insightCardConfig.value].sort((a, b) => a.position - b.position),
);

// インサイトカードの表示/非表示を切り替え
function toggleInsightCardVisible(cardId: string) {
  const card = insightCardConfig.value.find((c) => c.id === cardId);
  if (card) {
    card.visible = !card.visible;
  }
}

// インサイトカードを上に移動
function moveInsightCardUp(cardId: string) {
  const sorted = [...insightCardConfig.value].sort(
    (a, b) => a.position - b.position,
  );
  const index = sorted.findIndex((c) => c.id === cardId);
  if (index <= 0) return;
  const current = sorted[index];
  const prev = sorted[index - 1];
  if (!current || !prev) return;
  const temp = current.position;
  current.position = prev.position;
  prev.position = temp;
  insightCardConfig.value = sorted;
}

// インサイトカードを下に移動
function moveInsightCardDown(cardId: string) {
  const sorted = [...insightCardConfig.value].sort(
    (a, b) => a.position - b.position,
  );
  const index = sorted.findIndex((c) => c.id === cardId);
  if (index < 0 || index >= sorted.length - 1) return;
  const current = sorted[index];
  const next = sorted[index + 1];
  if (!current || !next) return;
  const temp = current.position;
  current.position = next.position;
  next.position = temp;
  insightCardConfig.value = sorted;
}

// インサイトカード設定を保存
async function saveInsightCardConfig() {
  if (!user.value || !isInsightCardConfigDirty.value) return;
  insightCardConfigSaving.value = true;
  try {
    await saveInsightCardSettings(
      user.value.uid,
      projectId.value,
      insightCardConfig.value,
    );
    initialInsightCardConfig.value = JSON.stringify(insightCardConfig.value);
  } catch (error) {
    logger.error`Failed to save insight card config: ${error}`;
  } finally {
    insightCardConfigSaving.value = false;
  }
}

// インサイトカードのラベルを取得
function getInsightCardLabel(cardId: string): string {
  return INSIGHT_CARD_LABELS[cardId] || cardId;
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
    };
    initialForm.value = { ...form.value };
    publicSettings.value = {
      isPublic: Boolean(fetched.settings?.isPublic),
      guestAllowedPages: fetched.settings?.guestAllowedPages ?? [
        ...DEFAULT_GUEST_ALLOWED_PAGES,
      ],
    };
    initialPublicSettings.value = {
      ...publicSettings.value,
      guestAllowedPages: [...publicSettings.value.guestAllowedPages],
    };
    aiEnabled.value = Boolean(fetched.settings?.aiChatEnabled);
    aiKey.value = fetched.settings?.aiApiKey ?? "";
    initialAiSettings.value = { enabled: aiEnabled.value, key: aiKey.value };
    humorousEnabled.value = Boolean(fetched.settings?.humorousCommandsEnabled);
    initialHumorousEnabled.value = humorousEnabled.value;
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

// 基本設定を保存
async function handleSaveBasic() {
  if (!canEdit.value || !project.value || !isBasicDirty.value) return;
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
    });
    initialForm.value = { ...form.value };
    successMessage.value = "設定を保存しました。";
    setTimeout(() => {
      successMessage.value = "";
    }, 3000);
  } catch (error) {
    logger.error`Failed to save project settings: ${error}`;
    errorMessage.value = "設定の保存に失敗しました。";
  } finally {
    saving.value = false;
  }
}

// 公開プロジェクトトグルのハンドラ（ONにする場合は確認モーダルを表示）
function handlePublicToggle(value: boolean) {
  if (value) {
    // ONにする場合は確認モーダルを表示
    isPublicConfirmModalOpen.value = true;
  } else {
    // OFFにする場合は直接更新
    publicSettings.value.isPublic = false;
  }
}

// 公開設定確認後の処理
function confirmEnablePublic() {
  publicSettings.value.isPublic = true;
  isPublicConfirmModalOpen.value = false;
}

// 公開設定を保存
async function handleSavePublic() {
  if (!canEdit.value || !project.value || !isPublicDirty.value) return;
  publicSaving.value = true;
  errorMessage.value = "";
  try {
    await updateProjectMetadata(projectId.value, {
      isPublic: publicSettings.value.isPublic,
      guestAllowedPages: publicSettings.value.guestAllowedPages,
    });
    initialPublicSettings.value = {
      ...publicSettings.value,
      guestAllowedPages: [...publicSettings.value.guestAllowedPages],
    };
  } catch (error) {
    logger.error`Failed to save public settings: ${error}`;
    errorMessage.value = "公開設定の保存に失敗しました。";
  } finally {
    publicSaving.value = false;
  }
}

// ゲスト閲覧許可ページの切り替え
function toggleGuestPage(pageKey: GuestAllowedPage) {
  const pages = publicSettings.value.guestAllowedPages;
  const index = pages.indexOf(pageKey);
  if (index === -1) {
    pages.push(pageKey);
  } else {
    // 最低1つは許可ページが必要
    if (pages.length > 1) {
      pages.splice(index, 1);
    }
  }
}

// ユーモラスコマンド設定を保存
async function saveHumorousSettings() {
  if (!canEdit.value || !isHumorousDirty.value) return;
  humorousSaving.value = true;

  const wasDisabled = !initialHumorousEnabled.value;
  const isNowEnabled = humorousEnabled.value;

  try {
    await updateProjectSettings(projectId.value, {
      humorousCommandsEnabled: humorousEnabled.value,
    });

    // offからonに変更した場合、演出を表示
    if (wasDisabled && isNowEnabled) {
      showZeldaEffect.value = true;
    }

    initialHumorousEnabled.value = humorousEnabled.value;
  } catch (error) {
    logger.error`Failed to save humorous settings: ${error}`;
    errorMessage.value = "ユーモラスコマンド設定の保存に失敗しました。";
  } finally {
    humorousSaving.value = false;
  }
}

function handleZeldaEffectComplete() {
  showZeldaEffect.value = false;
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

  // MFAが有効かチェック
  try {
    const mfaStatus = await getMFAEnrollmentStatus();
    mfaEnrolled.value = mfaStatus.enrolled;

    if (mfaStatus.enrolled) {
      // MFAが有効な場合、パスワード入力モーダルを表示
      showPasswordModal.value = true;
      return;
    }
  } catch (error) {
    logger.error`Failed to check MFA status: ${error}`;
    // MFAステータスの確認に失敗しても削除は続行可能
  }

  // MFAが無効な場合、従来のフロー
  await executeProjectDeletion();
}

async function handleDeletePasswordConfirm() {
  if (!deletePassword.value.trim()) {
    deleteError.value = "パスワードを入力してください。";
    return;
  }

  deleting.value = true;
  deleteError.value = "";

  try {
    // パスワードで再認証
    const result = await reauthenticateWithPassword(deletePassword.value);

    if (result.requiresMFA && result.resolver) {
      // MFA検証が必要
      deleteMFAResolver.value = result.resolver;
      showPasswordModal.value = false;
      showDeleteMFAModal.value = true;
      deleting.value = false;
      return;
    }

    // MFA不要の場合、削除を実行
    showPasswordModal.value = false;
    await executeProjectDeletion();
  } catch (error) {
    logger.error`Password reauthentication failed: ${error}`;
    const firebaseError = error as { code?: string };
    if (
      firebaseError?.code === "auth/wrong-password" ||
      firebaseError?.code === "auth/invalid-credential"
    ) {
      deleteError.value = "パスワードが正しくありません。";
    } else {
      deleteError.value = "認証に失敗しました。再度お試しください。";
    }
    deleting.value = false;
  }
}

async function handleDeleteMFAVerification(mfaCode: string) {
  if (!deleteMFAResolver.value) return;

  deleting.value = true;
  deleteMFAError.value = "";

  try {
    // MFA検証を完了
    await completeMFAReauthentication(deleteMFAResolver.value, mfaCode);

    // 削除を実行
    showDeleteMFAModal.value = false;
    await executeProjectDeletion();
  } catch (error) {
    logger.error`MFA verification for project deletion failed: ${error}`;
    const firebaseError = error as { code?: string; message?: string };
    if (
      firebaseError?.code === "auth/invalid-verification-code" ||
      firebaseError?.message?.includes("invalid")
    ) {
      deleteMFAError.value = "認証コードが正しくありません。";
    } else {
      deleteMFAError.value = "認証に失敗しました。再度お試しください。";
    }
    deleting.value = false;
  }
}

function closePasswordModal() {
  showPasswordModal.value = false;
  deletePassword.value = "";
  deleteError.value = "";
}

function closeDeleteMFAModal() {
  showDeleteMFAModal.value = false;
  deleteMFAError.value = "";
  deleteMFAResolver.value = null;
}

async function executeProjectDeletion() {
  if (!confirm("このプロジェクトを完全に削除します。よろしいですか？")) {
    deleting.value = false;
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
  <div class="project-settings-page">
    <AppAlert v-if="!canEdit" variant="warning" class="settings-alert">
      <template #title>管理者限定</template>
      このページは管理者のみが利用できます。権限をご確認ください。
    </AppAlert>
    <div v-else class="settings-container">
      <div v-if="loading" class="loading-state">
        <div class="spinner" />
        <p>読み込み中...</p>
      </div>

      <div v-else-if="errorMessage && !project" class="error-state">
        <p>{{ errorMessage }}</p>
      </div>

      <template v-else>
        <!-- Success/Error Messages -->
        <transition name="fade">
          <div
            v-if="successMessage"
            class="message-toast message-toast--success"
          >
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              width="18"
              height="18"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            {{ successMessage }}
          </div>
        </transition>
        <transition name="fade">
          <div
            v-if="errorMessage && project"
            class="message-toast message-toast--error"
          >
            {{ errorMessage }}
          </div>
        </transition>

        <div class="settings-layout">
          <!-- Primary Column (Left) -->
          <div class="settings-primary">
            <!-- 1. 基本設定 -->
            <SettingsSectionCard
              title="基本設定"
              description="プロジェクトの基本情報を管理します"
              :dirty="isBasicDirty"
              :saving="saving"
              :save-disabled="!canEdit"
              @save="handleSaveBasic"
            >
              <template #icon>
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
              </template>
              <div class="form-fields">
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
                  :rows="3"
                  :disabled="!canEdit"
                  placeholder="プロジェクトの目的や概要を入力してください"
                />
              </div>
            </SettingsSectionCard>

            <!-- 2. 公開・閲覧設定 -->
            <SettingsSectionCard
              title="公開・閲覧設定"
              description="プロジェクトの公開範囲を管理します"
              :dirty="isPublicDirty"
              :saving="publicSaving"
              :save-disabled="!canEdit"
              @save="handleSavePublic"
            >
              <template #icon>
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </template>
              <div class="toggle-list">
                <SettingsToggleRow
                  :model-value="publicSettings.isPublic"
                  label="公開プロジェクト"
                  description="リンクを知っている人なら誰でも閲覧可能になります（ログイン不要）"
                  :disabled="!canEdit"
                  @update:model-value="handlePublicToggle"
                />
              </div>

              <!-- 公開ページ設定 -->
              <Transition name="fade">
                <div v-if="publicSettings.isPublic" class="guest-pages-config">
                  <h4 class="guest-pages-title">閲覧可能なページ</h4>
                  <p class="guest-pages-description">
                    ゲストがアクセスできるページを選択してください
                  </p>
                  <div class="guest-pages-list">
                    <label
                      v-for="page in GUEST_CONFIGURABLE_PAGES"
                      :key="page.key"
                      class="guest-page-item"
                      :class="{
                        'guest-page-item--checked':
                          publicSettings.guestAllowedPages.includes(page.key),
                        'guest-page-item--disabled': !canEdit,
                      }"
                    >
                      <input
                        type="checkbox"
                        :checked="
                          publicSettings.guestAllowedPages.includes(page.key)
                        "
                        :disabled="
                          !canEdit ||
                          (publicSettings.guestAllowedPages.length === 1 &&
                            publicSettings.guestAllowedPages.includes(page.key))
                        "
                        class="guest-page-checkbox"
                        @change="toggleGuestPage(page.key)"
                      />
                      <div class="guest-page-content">
                        <span class="guest-page-label">{{ page.label }}</span>
                        <span class="guest-page-desc">{{
                          page.description
                        }}</span>
                      </div>
                    </label>
                  </div>
                </div>
              </Transition>
            </SettingsSectionCard>

            <!-- 3. ダッシュボードカード設定 -->
            <SettingsSectionCard
              title="ダッシュボードカード設定"
              description="サマリーカードの表示・並び順を管理します"
              :dirty="isCardConfigDirty"
              :saving="cardConfigSaving"
              @save="saveCardConfig"
            >
              <template #icon>
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
              </template>
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
                      aria-label="上に移動"
                      @click="moveCardUp(config.id)"
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
                      aria-label="下に移動"
                      @click="moveCardDown(config.id)"
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
            </SettingsSectionCard>

            <!-- 4. インサイトカード設定 -->
            <SettingsSectionCard
              title="インサイトカード設定"
              description="インサイトセクションのカード表示・並び順を管理します"
              :dirty="isInsightCardConfigDirty"
              :saving="insightCardConfigSaving"
              @save="saveInsightCardConfig"
            >
              <template #icon>
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </template>
              <div class="card-config-list">
                <div
                  v-for="(config, index) in sortedInsightCardConfig"
                  :key="config.id"
                  class="card-config-item"
                >
                  <label class="card-config-checkbox">
                    <input
                      type="checkbox"
                      :checked="config.visible"
                      @change="toggleInsightCardVisible(config.id)"
                    />
                    <span class="card-config-label">{{
                      getInsightCardLabel(config.id)
                    }}</span>
                  </label>
                  <div class="card-config-actions">
                    <button
                      type="button"
                      class="card-config-btn"
                      :disabled="index === 0"
                      aria-label="上に移動"
                      @click="moveInsightCardUp(config.id)"
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
                      :disabled="index === sortedInsightCardConfig.length - 1"
                      aria-label="下に移動"
                      @click="moveInsightCardDown(config.id)"
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
            </SettingsSectionCard>

            <!-- 5. ロール管理 -->
            <SettingsSectionCard
              title="ロール管理"
              description="ロールと権限の作成・編集・削除は専用ページで行います"
            >
              <template #icon>
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </template>
              <div class="role-link">
                <p>
                  カスタムロールの追加や権限の変更は「ロール管理」ページに
                  集約されています。
                </p>
                <AppButton
                  variant="outline"
                  :to="{
                    name: ROUTE_NAMES.projectRoles,
                    params: { projectId },
                  }"
                >
                  ロール管理ページを開く
                </AppButton>
              </div>
            </SettingsSectionCard>

            <!-- 5. ユーモラスコマンド設定 -->
            <SettingsSectionCard
              title="ユーモラスコマンド"
              description="チャットでFlilo Botのユーモラスな返答を有効にします"
              :dirty="isHumorousDirty"
              :saving="humorousSaving"
              :save-disabled="!canEdit"
              @save="saveHumorousSettings"
            >
              <template #icon>
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </template>
              <div class="toggle-list">
                <SettingsToggleRow
                  v-model="humorousEnabled"
                  label="ユーモラスコマンドを有効化"
                  description="/explain や /coffee などのFlilo Botによる遊び心のある返答を有効にします"
                  :disabled="!canEdit"
                />
              </div>
            </SettingsSectionCard>

            <!-- 5. Danger Zone（折りたたみ） -->
            <DangerZoneCard title="プロジェクトの削除">
              <div class="danger-content">
                <div class="danger-warning">
                  <p>
                    プロジェクトを削除すると、関連するすべてのタスク、チャット、ファイルが完全に削除されます。この操作は取り消すことができません。
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
                <p v-if="deleteError" class="danger-error">{{ deleteError }}</p>
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
            </DangerZoneCard>
          </div>

          <!-- Secondary Column (Right) -->
          <aside class="settings-secondary">
            <!-- 1. プロジェクト情報 -->
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

            <!-- 2. 関連設定リンク -->
            <div v-if="relatedLinks.length > 0" class="info-card">
              <h3>関連設定</h3>
              <SettingsLinkList :items="relatedLinks">
                <template #icon-0>
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
                </template>
                <template #icon-1>
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
                </template>
              </SettingsLinkList>
            </div>

            <!-- 3. AIアシスタント（現在のバージョンでは無効） -->
            <div
              class="ai-section-disabled"
              title="この機能は現在のバージョンでは使用できません"
            >
              <SettingsSectionCard
                title="AI アシスタント"
                description="OpenAI API を使用してタスクのサポートを行います"
                :dirty="false"
                :saving="false"
                :save-disabled="true"
              >
                <template #icon>
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
                </template>
                <div class="ai-settings">
                  <p class="ai-unavailable-notice">
                    この機能は現在のバージョンでは使用できません
                  </p>
                  <SettingsToggleRow
                    v-model="aiEnabled"
                    label="AI アシスタントを有効化"
                    description="タスクの内容に基づいてAIが回答します"
                    :disabled="true"
                  />
                  <AppInput
                    id="aiKey"
                    v-model="aiKey"
                    type="password"
                    label="OpenAI API Key"
                    :disabled="true"
                    placeholder="sk-..."
                  />
                </div>
              </SettingsSectionCard>
            </div>
          </aside>
        </div>
      </template>
    </div>

    <!-- Zelda演出 -->
    <ZeldaPuzzleEffect
      :show="showZeldaEffect"
      @complete="handleZeldaEffectComplete"
    />

    <!-- 公開プロジェクト確認モーダル -->
    <ConfirmGuestAccessModal
      :open="isPublicConfirmModalOpen"
      :loading="publicSaving"
      @close="isPublicConfirmModalOpen = false"
      @confirm="confirmEnablePublic"
    />

    <!-- プロジェクト削除用パスワード確認モーダル -->
    <Teleport to="body">
      <div
        v-if="showPasswordModal"
        class="modal-overlay"
        @click.self="closePasswordModal"
      >
        <div
          class="modal modal--sm"
          role="dialog"
          aria-labelledby="password-modal-title"
        >
          <header class="modal__header">
            <h3 id="password-modal-title">パスワードの確認</h3>
            <button
              type="button"
              class="modal__close"
              aria-label="閉じる"
              @click="closePasswordModal"
            >
              &times;
            </button>
          </header>
          <div class="modal__body">
            <p class="modal__description">
              プロジェクトを削除するには、パスワードを入力してください。
            </p>
            <div class="form-field">
              <label for="delete-password">パスワード</label>
              <input
                id="delete-password"
                v-model="deletePassword"
                type="password"
                placeholder="パスワードを入力"
                autocomplete="current-password"
                @keydown.enter="handleDeletePasswordConfirm"
              />
            </div>
            <p v-if="deleteError" class="error-message">{{ deleteError }}</p>
          </div>
          <footer class="modal__footer">
            <button
              type="button"
              class="btn btn--ghost"
              :disabled="deleting"
              @click="closePasswordModal"
            >
              キャンセル
            </button>
            <button
              type="button"
              class="btn btn--danger"
              :disabled="!deletePassword.trim() || deleting"
              @click="handleDeletePasswordConfirm"
            >
              {{ deleting ? "確認中..." : "続行" }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- プロジェクト削除用MFA検証モーダル -->
    <MFAVerificationModal
      :open="showDeleteMFAModal"
      title="2段階認証（プロジェクト削除）"
      description="プロジェクトを削除するには、認証アプリに表示されている6桁のコードを入力してください。"
      confirm-label="続行"
      :loading="deleting"
      :error="deleteMFAError"
      @close="closeDeleteMFAModal"
      @verified="handleDeleteMFAVerification"
    />
  </div>
</template>

<style scoped>
/* Layout */
.project-settings-page {
  padding: var(--ui-space-6, 1.5rem);
}

.settings-alert {
  max-width: var(--ui-container-sm, 800px);
  margin: 0 auto var(--ui-space-4, 1rem);
}

.settings-container {
  max-width: var(--ui-container-lg, 1100px);
  margin: 0 auto;
  padding: var(--ui-space-5, 1.25rem);
}

.settings-layout {
  display: grid;
  grid-template-columns: 1fr var(--ui-sidebar-width, 340px);
  gap: var(--ui-space-6, 1.5rem);
  align-items: start;
}

.settings-primary {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
}

.settings-secondary {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  position: sticky;
  top: calc(var(--ui-topbar-height, 64px) + var(--ui-space-5, 1.25rem));
}

@media (max-width: 960px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }

  .settings-secondary {
    position: static;
  }
}

/* Form Fields */
.form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

/* Message Toasts */
.message-toast {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  margin-bottom: var(--ui-space-4, 1rem);
}

.message-toast--success {
  background: var(--ui-success-light, #dcfce7);
  color: var(--ui-success-text, #166534);
}

.message-toast--error {
  background: var(--ui-danger-light, #fee2e2);
  color: var(--ui-danger-text, #991b1b);
}

/* Info Card (Secondary) */
.info-card {
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-5, 1.25rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-sm);
}

.info-card h3 {
  font-size: var(--ui-text-xs, 0.75rem);
  text-transform: uppercase;
  letter-spacing: var(--ui-tracking-widest, 0.1em);
  color: var(--ui-text-muted, #64748b);
  margin: 0 0 var(--ui-space-4, 1rem) 0;
  font-weight: var(--ui-font-semibold, 600);
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
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
  max-width: var(--ui-space-40, 10rem);
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Card Config */
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
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.card-config-checkbox {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  cursor: pointer;
  flex: 1;
}

.card-config-checkbox input[type="checkbox"] {
  width: var(--ui-checkbox-size, 18px);
  height: var(--ui-checkbox-size, 18px);
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
  width: var(--ui-space-8, 2rem);
  height: var(--ui-space-8, 2rem);
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

.card-config-btn:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.card-config-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Danger Zone */
.danger-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.danger-warning {
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-danger-light, #fee2e2);
  border-radius: var(--ui-radius-sm, 0.5rem);
  color: var(--ui-danger-text, #991b1b);
  font-size: var(--ui-text-sm, 0.875rem);
  border-left: var(--ui-border-accent-width, 3px) solid
    var(--ui-danger, #d64545);
}

.danger-warning p {
  margin: 0;
}

.danger-error {
  color: var(--ui-danger, #d64545);
  font-size: var(--ui-text-sm, 0.875rem);
  margin: 0;
}

.danger-actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
}

/* AI Settings - Disabled State */
.ai-section-disabled {
  position: relative;
  opacity: 0.6;
  filter: grayscale(30%);
  cursor: not-allowed;
}

.ai-section-disabled :deep(*) {
  pointer-events: none;
}

.ai-section-disabled:hover::before {
  content: "この機能は現在のバージョンでは使用できません";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: var(--ui-text-strong, #0f172a);
  color: var(--ui-surface, #fff);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  border-radius: var(--ui-radius-md, 0.75rem);
  white-space: nowrap;
  box-shadow: var(--ui-shadow-lg);
}

.ai-unavailable-notice {
  margin: 0 0 var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-warning-bg, rgba(234, 179, 8, 0.1));
  border: 1px solid var(--ui-warning, #eab308);
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-warning-dark, #a16207);
  text-align: center;
}

/* AI Settings */
.ai-settings {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

/* Loading & Error */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-16, 4rem);
  color: var(--ui-text-muted, #64748b);
}

.spinner {
  width: var(--ui-space-10, 2.5rem);
  height: var(--ui-space-10, 2.5rem);
  border: var(--ui-border-accent-width, 3px) solid
    var(--ui-border-light, rgba(11, 46, 51, 0.08));
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

.error-state {
  padding: var(--ui-space-8, 2rem);
  text-align: center;
  color: var(--ui-danger, #d64545);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}

/* Form Field */
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
  margin-bottom: var(--ui-space-4, 1rem);
}

.required {
  color: var(--ui-danger, #d64545);
}

/* ゲスト閲覧ページ設定 */
.guest-pages-config {
  margin-top: var(--ui-space-4, 1rem);
  padding-top: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border, #e2e8f0);
}

.guest-pages-title {
  margin: 0 0 var(--ui-space-1, 0.25rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #1e293b);
}

.guest-pages-description {
  margin: 0 0 var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.guest-pages-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.guest-page-item {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, #e2e8f0);
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  cursor: pointer;
  transition: var(--ui-transition-colors, all 0.2s ease);
}

.guest-page-item:hover:not(.guest-page-item--disabled) {
  border-color: var(--ui-brand-300, #99d1d9);
  background: var(--ui-brand-50, #e5f6f8);
}

.guest-page-item--checked {
  border-color: var(--ui-brand-500, #4f7c82);
  background: var(--ui-brand-50, #e5f6f8);
}

.guest-page-item--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.guest-page-checkbox {
  width: var(--ui-checkbox-size, 18px);
  height: var(--ui-checkbox-size, 18px);
  margin: 0;
  margin-top: var(--ui-space-0-5, 0.125rem);
  accent-color: var(--ui-brand-600, #4f7c82);
  cursor: inherit;
}

.guest-page-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  flex: 1;
}

.guest-page-label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #1e293b);
}

.guest-page-desc {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

/* fade transition for guest pages config */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--ui-duration-base, 180ms)
    var(--ui-ease-standard, ease);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
