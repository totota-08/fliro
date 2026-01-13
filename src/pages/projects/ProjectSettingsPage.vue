<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppTextarea from "@/components/ui/AppTextarea.vue";
import AppAlert from "@/components/ui/AppAlert.vue";
import { usePageTitle } from "@/composables/usePageTitle";
import SettingsSectionCard from "@/components/settings/SettingsSectionCard.vue";
import SettingsToggleRow from "@/components/settings/SettingsToggleRow.vue";
import SettingsLinkList from "@/components/settings/SettingsLinkList.vue";
import DangerZoneCard from "@/components/settings/DangerZoneCard.vue";
import ZeldaPuzzleEffect from "@/components/effects/ZeldaPuzzleEffect.vue";
import { appName } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import {
  ProjectPermission,
  type ProjectPermissionKey,
} from "@/constants/permissions";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
import { useProjectAccess } from "@/composables/useProjectAccess";
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
  saveInsightCardSettings,
  getDefaultInsightCards,
  type DashboardCardConfig,
  type InsightCardConfig,
} from "@/services/dashboardSettingsService";
import {
  listenProjectRoles,
  updateRolePermissions,
  addRole,
  removeRole,
  updateRole,
  type ProjectRole,
} from "@/services/rolesService";
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

// useProjectAccess で権限管理を統一
const { can } = useProjectAccess(projectId);

const canManage = computed(() => can(ProjectPermission.MANAGE_SETTINGS));
const canManageCategories = computed(() =>
  can(ProjectPermission.MANAGE_CATEGORIES),
);
const canManageNotifications = computed(() =>
  can(ProjectPermission.MANAGE_NOTIFICATIONS),
);

// AI設定
const aiEnabled = ref(false);
const aiKey = ref("");
const aiPrompt = ref("");
const aiResponse = ref("");
const aiLoading = ref(false);
const aiSaving = ref(false);
const tasks = ref<TaskDoc[]>([]);
let stopTasks: (() => void) | null = null;

// ユーモラスコマンド設定
const humorousEnabled = ref(false);
const initialHumorousEnabled = ref(false);
const humorousSaving = ref(false);
const showZeldaEffect = ref(false);

// ロール管理
const roles = ref<ProjectRole[]>([]);
let stopRoles: (() => void) | null = null;
const canManageRoles = computed(() => can(ProjectPermission.MANAGE_ROLES));
const isPermissionModalOpen = ref(false);
const editingPermissionRole = ref<ProjectRole | null>(null);
const editingPermissions = ref<Set<ProjectPermissionKey>>(new Set());
const isSavingPermissions = ref(false);

// ロール追加モーダル
const isCreateRoleModalOpen = ref(false);
const newRole = ref({ name: "", color: "#64748b" });
const isCreatingRole = ref(false);

// ロール編集モーダル（権限設定も含む）
const isEditRoleModalOpen = ref(false);
const editingRole = ref<ProjectRole | null>(null);
const editRoleForm = ref({ name: "", color: "" });
const editRolePermissions = ref<Set<ProjectPermissionKey>>(new Set());
const isUpdatingRole = ref(false);

// ロール削除モーダル
const isDeleteRoleModalOpen = ref(false);
const deletingRole = ref<ProjectRole | null>(null);
const isDeletingRole = ref(false);
const deleteRoleError = ref("");

// プリセットカラー
const presetColors = [
  { value: "#4f7c82", label: "Teal" },
  { value: "#0b2e33", label: "Deep Green" },
  { value: "#16a34a", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#64748b", label: "Slate" },
];

// ページ/機能ごとの権限定義
const pagePermissions: {
  page: string;
  description: string;
  permissions: { key: ProjectPermissionKey; label: string }[];
}[] = [
  {
    page: "ダッシュボード",
    description: "プロジェクトの概要を表示するページ",
    permissions: [{ key: ProjectPermission.VIEW_DASHBOARD, label: "閲覧" }],
  },
  {
    page: "タスク",
    description: "タスクの一覧・詳細ページ",
    permissions: [
      { key: ProjectPermission.VIEW_TASKS, label: "閲覧" },
      { key: ProjectPermission.MANAGE_TASKS, label: "作成・編集" },
      { key: ProjectPermission.DELETE_TASKS, label: "削除" },
      {
        key: ProjectPermission.UPDATE_OWN_PROGRESS,
        label: "自分の進捗のみ更新",
      },
    ],
  },
  {
    page: "スレッド",
    description: "チームのコミュニケーションページ",
    permissions: [
      { key: ProjectPermission.VIEW_THREADS, label: "閲覧" },
      { key: ProjectPermission.POST_THREADS, label: "投稿" },
    ],
  },
  {
    page: "メンバー",
    description: "プロジェクトメンバーの一覧ページ",
    permissions: [
      { key: ProjectPermission.VIEW_MEMBERS, label: "閲覧" },
      { key: ProjectPermission.INVITE_MEMBERS, label: "招待" },
      { key: ProjectPermission.MANAGE_MEMBERS, label: "管理（キック等）" },
    ],
  },
  {
    page: "カテゴリ",
    description: "タスクカテゴリの管理ページ",
    permissions: [
      { key: ProjectPermission.VIEW_CATEGORIES, label: "閲覧" },
      { key: ProjectPermission.MANAGE_CATEGORIES, label: "管理" },
    ],
  },
  {
    page: "招待リンク",
    description: "招待リンクの管理ページ",
    permissions: [
      { key: ProjectPermission.VIEW_INVITES, label: "閲覧" },
      { key: ProjectPermission.MANAGE_INVITES, label: "管理" },
    ],
  },
  {
    page: "プロジェクト設定",
    description: "プロジェクトの設定ページ",
    permissions: [
      { key: ProjectPermission.VIEW_SETTINGS, label: "閲覧" },
      { key: ProjectPermission.MANAGE_SETTINGS, label: "変更" },
    ],
  },
  {
    page: "ロール管理",
    description: "ロールと権限の管理ページ",
    permissions: [
      { key: ProjectPermission.VIEW_ROLES, label: "閲覧" },
      { key: ProjectPermission.MANAGE_ROLES, label: "管理" },
    ],
  },
  {
    page: "アクティビティ",
    description: "プロジェクトの活動履歴ページ",
    permissions: [{ key: ProjectPermission.VIEW_ACTIVITY, label: "閲覧" }],
  },
  {
    page: "通知",
    description: "通知設定ページ",
    permissions: [
      { key: ProjectPermission.VIEW_NOTIFICATIONS, label: "閲覧" },
      { key: ProjectPermission.MANAGE_NOTIFICATIONS, label: "変更" },
    ],
  },
  {
    page: "週次スコア",
    description: "チームの週次パフォーマンスページ",
    permissions: [{ key: ProjectPermission.VIEW_SCORES, label: "閲覧" }],
  },
];

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
const publicSettings = ref({
  isPublic: false,
  allowGuestView: false,
});
const initialPublicSettings = ref({ isPublic: false, allowGuestView: false });
const publicSaving = ref(false);

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
    publicSettings.value.allowGuestView !==
      initialPublicSettings.value.allowGuestView,
);

const isCardConfigDirty = computed(
  () => JSON.stringify(cardConfig.value) !== initialCardConfig.value,
);

const isInsightCardConfigDirty = computed(
  () =>
    JSON.stringify(insightCardConfig.value) !== initialInsightCardConfig.value,
);

const isAiDirty = computed(
  () =>
    aiEnabled.value !== initialAiSettings.value.enabled ||
    aiKey.value !== initialAiSettings.value.key,
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
      allowGuestView: Boolean(fetched.settings?.allowGuestView),
    };
    initialPublicSettings.value = { ...publicSettings.value };
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

// 公開設定を保存
async function handleSavePublic() {
  if (!canEdit.value || !project.value || !isPublicDirty.value) return;
  publicSaving.value = true;
  errorMessage.value = "";
  try {
    await updateProjectMetadata(projectId.value, {
      isPublic: publicSettings.value.isPublic,
      allowGuestView: publicSettings.value.allowGuestView,
    });
    initialPublicSettings.value = { ...publicSettings.value };
  } catch (error) {
    logger.error`Failed to save public settings: ${error}`;
    errorMessage.value = "公開設定の保存に失敗しました。";
  } finally {
    publicSaving.value = false;
  }
}

// AI設定を保存
async function saveAiSettings() {
  if (!canEdit.value || !isAiDirty.value) return;
  aiSaving.value = true;
  try {
    await updateProjectSettings(projectId.value, {
      aiChatEnabled: aiEnabled.value,
      aiApiKey: aiKey.value,
    });
    initialAiSettings.value = { enabled: aiEnabled.value, key: aiKey.value };
  } catch (error) {
    logger.error`Failed to save AI settings: ${error}`;
    errorMessage.value = "AI設定の保存に失敗しました。";
  } finally {
    aiSaving.value = false;
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

// ロール管理関数
function watchRoles() {
  stopRoles = listenProjectRoles(projectId.value, (list) => {
    roles.value = list;
  });
}

function closePermissionModal() {
  isPermissionModalOpen.value = false;
  editingPermissionRole.value = null;
  editingPermissions.value = new Set();
}

function togglePermission(key: ProjectPermissionKey) {
  if (editingPermissions.value.has(key)) {
    editingPermissions.value.delete(key);
  } else {
    editingPermissions.value.add(key);
  }
  editingPermissions.value = new Set(editingPermissions.value);
}

async function savePermissions() {
  if (!canManageRoles.value || !editingPermissionRole.value) return;
  if (isSavingPermissions.value) return;

  isSavingPermissions.value = true;
  try {
    await updateRolePermissions(
      projectId.value,
      editingPermissionRole.value.id,
      Array.from(editingPermissions.value),
    );
    closePermissionModal();
  } catch (error) {
    logger.error`Failed to update permissions: ${error}`;
    errorMessage.value = "権限の更新に失敗しました。";
  } finally {
    isSavingPermissions.value = false;
  }
}

// ロール追加
function openCreateRoleModal() {
  if (!canManageRoles.value) return;
  newRole.value = { name: "", color: "#64748b" };
  isCreateRoleModalOpen.value = true;
}

function closeCreateRoleModal() {
  isCreateRoleModalOpen.value = false;
  newRole.value = { name: "", color: "#64748b" };
}

async function createRole() {
  if (!canManageRoles.value || !newRole.value.name.trim()) return;
  if (isCreatingRole.value) return;

  isCreatingRole.value = true;
  try {
    await addRole(projectId.value, newRole.value.name, {
      name: newRole.value.name.trim(),
      color: newRole.value.color,
    });
    closeCreateRoleModal();
  } catch (error) {
    logger.error`Failed to create role: ${error}`;
    errorMessage.value =
      error instanceof Error ? error.message : "ロールの作成に失敗しました";
  } finally {
    isCreatingRole.value = false;
  }
}

// ロール編集（権限も含む）
function openEditRoleModal(role: ProjectRole) {
  if (!canManageRoles.value) return;
  editingRole.value = role;
  editRoleForm.value = { name: role.name, color: role.color };
  editRolePermissions.value = new Set(role.permissions);
  isEditRoleModalOpen.value = true;
}

function closeEditRoleModal() {
  isEditRoleModalOpen.value = false;
  editingRole.value = null;
  editRoleForm.value = { name: "", color: "" };
  editRolePermissions.value = new Set();
}

function toggleEditPermission(key: ProjectPermissionKey) {
  if (editRolePermissions.value.has(key)) {
    editRolePermissions.value.delete(key);
  } else {
    editRolePermissions.value.add(key);
  }
  editRolePermissions.value = new Set(editRolePermissions.value);
}

async function saveRoleEdit() {
  if (!canManageRoles.value || !editingRole.value) return;
  if (!editRoleForm.value.name.trim()) return;
  if (isUpdatingRole.value) return;

  isUpdatingRole.value = true;
  try {
    // ロール名・カラーを更新
    await updateRole(projectId.value, editingRole.value.id, {
      name: editRoleForm.value.name.trim(),
      color: editRoleForm.value.color,
    });
    // 権限を更新
    await updateRolePermissions(
      projectId.value,
      editingRole.value.id,
      Array.from(editRolePermissions.value),
    );
    closeEditRoleModal();
  } catch (error) {
    logger.error`Failed to update role: ${error}`;
    errorMessage.value =
      error instanceof Error ? error.message : "ロールの更新に失敗しました";
  } finally {
    isUpdatingRole.value = false;
  }
}

// ロール削除
function openDeleteRoleModal(role: ProjectRole) {
  if (!canManageRoles.value) return;
  deletingRole.value = role;
  deleteRoleError.value = "";
  isDeleteRoleModalOpen.value = true;
}

function closeDeleteRoleModal() {
  isDeleteRoleModalOpen.value = false;
  deletingRole.value = null;
  deleteRoleError.value = "";
}

async function confirmDeleteRole() {
  if (!canManageRoles.value || !deletingRole.value) return;
  if (isDeletingRole.value) return;

  isDeletingRole.value = true;
  deleteRoleError.value = "";

  try {
    const result = await removeRole(projectId.value, deletingRole.value.id);
    if (!result.success) {
      deleteRoleError.value = result.error || "ロールの削除に失敗しました";
      return;
    }
    closeDeleteRoleModal();
  } catch (error) {
    logger.error`Failed to delete role: ${error}`;
    deleteRoleError.value =
      error instanceof Error ? error.message : "ロールの削除に失敗しました";
  } finally {
    isDeletingRole.value = false;
  }
}

// カラーピッカー
function selectPresetColor(color: string, target: "new" | "edit") {
  if (target === "new") {
    newRole.value.color = color;
  } else {
    editRoleForm.value.color = color;
  }
}

function handleCustomColorChange(event: Event, target: "new" | "edit") {
  const input = event.target as HTMLInputElement;
  if (target === "new") {
    newRole.value.color = input.value;
  } else {
    editRoleForm.value.color = input.value;
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
  } catch (error: unknown) {
    aiResponse.value = (error as Error)?.message || "AI 応答に失敗しました。";
  } finally {
    aiLoading.value = false;
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
  watchRoles();
});

onBeforeUnmount(() => {
  stopTasks?.();
  stopRoles?.();
});

watch(projectId, async (newId, oldId) => {
  if (!newId || newId === oldId) return;
  stopTasks?.();
  stopRoles?.();
  await loadProject();
  await loadCardConfig();
  watchTasks();
  watchRoles();
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
                  v-model="publicSettings.isPublic"
                  label="公開プロジェクト"
                  description="誰でもこのプロジェクトを閲覧できるようになります"
                  :disabled="!canEdit"
                />
                <SettingsToggleRow
                  v-model="publicSettings.allowGuestView"
                  label="ゲスト閲覧を許可"
                  description="アカウントを持たないユーザーも閲覧可能にします"
                  :disabled="!canEdit"
                />
              </div>
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
              description="プロジェクトのロールと権限を管理します"
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
              <div class="role-section">
                <!-- デフォルトロールの説明 -->
                <div class="role-section__intro-box">
                  <h4 class="role-section__subtitle">デフォルトロール</h4>
                  <p class="role-section__intro">
                    オーナーは全権限を持つ固定ロールです。管理者とメンバーの権限は編集可能です。
                  </p>
                </div>

                <!-- ロール一覧 -->
                <ul class="role-list">
                  <!-- オーナー（特別扱い） -->
                  <li class="role-list__item role-list__item--owner">
                    <div class="role-list__header">
                      <span class="role-list__color role-list__color--owner" />
                      <span class="role-list__name">オーナー</span>
                      <span class="role-list__badge">固定</span>
                    </div>
                    <p class="role-list__description">
                      プロジェクトの作成者です。全ての権限を持ち、プロジェクトの削除が可能です。
                    </p>
                  </li>

                  <!-- Firestoreから取得したロール -->
                  <li
                    v-for="role in roles"
                    :key="role.id"
                    class="role-list__item"
                  >
                    <div class="role-list__header">
                      <span
                        class="role-list__color"
                        :style="{ backgroundColor: role.color }"
                      />
                      <span class="role-list__name">{{ role.name }}</span>
                      <span v-if="role.isDefault" class="role-list__badge">
                        デフォルト
                      </span>
                      <span class="role-list__perm-count">
                        {{ role.permissions.length }}個の権限
                      </span>
                    </div>
                    <div v-if="canManageRoles" class="role-list__actions">
                      <button
                        type="button"
                        class="role-list__action-btn"
                        @click="openEditRoleModal(role)"
                      >
                        編集
                      </button>
                      <button
                        v-if="!role.isDefault"
                        type="button"
                        class="role-list__action-btn role-list__action-btn--danger"
                        @click="openDeleteRoleModal(role)"
                      >
                        削除
                      </button>
                    </div>
                  </li>
                </ul>

                <!-- ロール追加ボタン -->
                <div v-if="canManageRoles" class="role-section__add">
                  <button
                    type="button"
                    class="role-add-btn"
                    @click="openCreateRoleModal"
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    カスタムロールを追加
                  </button>
                </div>
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

            <!-- 3. AIアシスタント -->
            <SettingsSectionCard
              title="AI アシスタント"
              description="OpenAI API を使用してタスクのサポートを行います"
              :dirty="isAiDirty"
              :saving="aiSaving"
              :save-disabled="!canEdit"
              @save="saveAiSettings"
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
                <SettingsToggleRow
                  v-model="aiEnabled"
                  label="AI アシスタントを有効化"
                  description="タスクの内容に基づいてAIが回答します"
                  :disabled="!canEdit"
                />
                <AppInput
                  id="aiKey"
                  v-model="aiKey"
                  type="password"
                  label="OpenAI API Key"
                  :disabled="!canEdit"
                  placeholder="sk-..."
                />
                <div v-if="aiEnabled" class="ai-playground">
                  <h4>テストチャット</h4>
                  <AppTextarea
                    v-model="aiPrompt"
                    placeholder="タスクについて質問してください"
                    :rows="2"
                  />
                  <AppButton
                    type="button"
                    size="sm"
                    :disabled="aiLoading || !aiKey"
                    @click="askAi"
                  >
                    {{ aiLoading ? "応答中..." : "AIに聞く" }}
                  </AppButton>
                  <div v-if="aiResponse" class="ai-response">
                    <p>{{ aiResponse }}</p>
                  </div>
                </div>
              </div>
            </SettingsSectionCard>
          </aside>
        </div>
      </template>
    </div>

    <!-- Zelda演出 -->
    <ZeldaPuzzleEffect
      :show="showZeldaEffect"
      @complete="handleZeldaEffectComplete"
    />

    <!-- 権限編集モーダル -->
    <Teleport to="body">
      <div
        v-if="isPermissionModalOpen"
        class="modal-overlay"
        @click.self="closePermissionModal"
      >
        <div
          class="modal modal--lg"
          role="dialog"
          aria-labelledby="permission-modal-title"
        >
          <header class="modal__header">
            <h3 id="permission-modal-title">
              権限を編集 - {{ editingPermissionRole?.name }}
            </h3>
            <button
              type="button"
              class="modal__close"
              aria-label="閉じる"
              @click="closePermissionModal"
            >
              &times;
            </button>
          </header>

          <div class="modal__body permission-modal-body">
            <p class="permission-modal-intro">
              各ページ・機能へのアクセス権限を設定します。
            </p>
            <div
              v-for="pagePerm in pagePermissions"
              :key="pagePerm.page"
              class="permission-page-group"
            >
              <div class="permission-page-group__header">
                <h4 class="permission-page-group__title">
                  {{ pagePerm.page }}
                </h4>
                <p class="permission-page-group__desc">
                  {{ pagePerm.description }}
                </p>
              </div>
              <div class="permission-page-group__items">
                <label
                  v-for="perm in pagePerm.permissions"
                  :key="perm.key"
                  class="permission-checkbox"
                >
                  <input
                    type="checkbox"
                    :checked="editingPermissions.has(perm.key)"
                    @change="togglePermission(perm.key)"
                  />
                  <span class="permission-checkbox__label">{{
                    perm.label
                  }}</span>
                </label>
              </div>
            </div>
          </div>

          <footer class="modal__footer">
            <button
              type="button"
              class="btn btn--ghost"
              @click="closePermissionModal"
            >
              キャンセル
            </button>
            <button
              type="button"
              class="btn btn--primary"
              :disabled="isSavingPermissions"
              @click="savePermissions"
            >
              {{ isSavingPermissions ? "保存中..." : "保存" }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- ロール追加モーダル -->
    <Teleport to="body">
      <div
        v-if="isCreateRoleModalOpen"
        class="modal-overlay"
        @click.self="closeCreateRoleModal"
      >
        <div
          class="modal"
          role="dialog"
          aria-labelledby="create-role-modal-title"
        >
          <header class="modal__header">
            <h3 id="create-role-modal-title">新しいロールを作成</h3>
            <button
              type="button"
              class="modal__close"
              aria-label="閉じる"
              @click="closeCreateRoleModal"
            >
              &times;
            </button>
          </header>

          <form class="modal__body" @submit.prevent="createRole">
            <div class="form-field">
              <label class="form-label">
                ロール名 <span class="required">*</span>
              </label>
              <input
                v-model="newRole.name"
                type="text"
                class="form-input"
                placeholder="例: レビュアー"
                maxlength="30"
                required
              />
            </div>

            <div class="form-field">
              <label class="form-label">カラー</label>
              <div class="color-picker">
                <div class="color-picker__presets">
                  <button
                    v-for="preset in presetColors"
                    :key="preset.value"
                    type="button"
                    class="color-preset"
                    :class="{ 'is-selected': newRole.color === preset.value }"
                    :style="{ backgroundColor: preset.value }"
                    :title="preset.label"
                    @click="selectPresetColor(preset.value, 'new')"
                  />
                </div>
                <div class="color-picker__custom">
                  <label class="color-custom-label">
                    その他:
                    <input
                      type="color"
                      class="color-custom-input"
                      :value="newRole.color"
                      @input="handleCustomColorChange($event, 'new')"
                    />
                  </label>
                </div>
              </div>
            </div>

            <footer class="modal__footer">
              <button
                type="button"
                class="btn btn--ghost"
                @click="closeCreateRoleModal"
              >
                キャンセル
              </button>
              <button
                type="submit"
                class="btn btn--primary"
                :disabled="!newRole.name.trim() || isCreatingRole"
              >
                {{ isCreatingRole ? "作成中..." : "作成" }}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- ロール編集モーダル（権限設定含む） -->
    <Teleport to="body">
      <div
        v-if="isEditRoleModalOpen"
        class="modal-overlay"
        @click.self="closeEditRoleModal"
      >
        <div
          class="modal modal--lg"
          role="dialog"
          aria-labelledby="edit-role-modal-title"
        >
          <header class="modal__header">
            <h3 id="edit-role-modal-title">ロールを編集</h3>
            <button
              type="button"
              class="modal__close"
              aria-label="閉じる"
              @click="closeEditRoleModal"
            >
              &times;
            </button>
          </header>

          <form
            class="modal__body edit-role-modal-body"
            @submit.prevent="saveRoleEdit"
          >
            <!-- 基本設定 -->
            <div class="edit-role-section">
              <h4 class="edit-role-section__title">基本設定</h4>
              <div class="edit-role-section__content">
                <div class="form-field">
                  <label class="form-label">
                    ロール名 <span class="required">*</span>
                  </label>
                  <input
                    v-model="editRoleForm.name"
                    type="text"
                    class="form-input"
                    maxlength="30"
                    required
                  />
                </div>

                <div class="form-field">
                  <label class="form-label">カラー</label>
                  <div class="color-picker">
                    <div class="color-picker__presets">
                      <button
                        v-for="preset in presetColors"
                        :key="preset.value"
                        type="button"
                        class="color-preset"
                        :class="{
                          'is-selected': editRoleForm.color === preset.value,
                        }"
                        :style="{ backgroundColor: preset.value }"
                        :title="preset.label"
                        @click="selectPresetColor(preset.value, 'edit')"
                      />
                    </div>
                    <div class="color-picker__custom">
                      <label class="color-custom-label">
                        その他:
                        <input
                          type="color"
                          class="color-custom-input"
                          :value="editRoleForm.color || '#64748b'"
                          @input="handleCustomColorChange($event, 'edit')"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 権限設定 -->
            <div class="edit-role-section">
              <h4 class="edit-role-section__title">権限設定</h4>
              <p class="edit-role-section__desc">
                各ページ・機能へのアクセス権限を設定します。
              </p>
              <div class="edit-role-permissions">
                <div
                  v-for="pagePerm in pagePermissions"
                  :key="pagePerm.page"
                  class="permission-page-group"
                >
                  <div class="permission-page-group__header">
                    <h5 class="permission-page-group__title">
                      {{ pagePerm.page }}
                    </h5>
                    <p class="permission-page-group__desc">
                      {{ pagePerm.description }}
                    </p>
                  </div>
                  <div class="permission-page-group__items">
                    <label
                      v-for="perm in pagePerm.permissions"
                      :key="perm.key"
                      class="permission-checkbox"
                    >
                      <input
                        type="checkbox"
                        :checked="editRolePermissions.has(perm.key)"
                        @change="toggleEditPermission(perm.key)"
                      />
                      <span class="permission-checkbox__label">{{
                        perm.label
                      }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <footer class="modal__footer">
              <button
                type="button"
                class="btn btn--ghost"
                @click="closeEditRoleModal"
              >
                キャンセル
              </button>
              <button
                type="submit"
                class="btn btn--primary"
                :disabled="!editRoleForm.name.trim() || isUpdatingRole"
              >
                {{ isUpdatingRole ? "保存中..." : "保存" }}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- ロール削除確認モーダル -->
    <Teleport to="body">
      <div
        v-if="isDeleteRoleModalOpen"
        class="modal-overlay"
        @click.self="closeDeleteRoleModal"
      >
        <div
          class="modal modal--sm"
          role="alertdialog"
          aria-labelledby="delete-role-modal-title"
        >
          <header class="modal__header">
            <h3 id="delete-role-modal-title">ロールを削除</h3>
            <button
              type="button"
              class="modal__close"
              aria-label="閉じる"
              @click="closeDeleteRoleModal"
            >
              &times;
            </button>
          </header>

          <div class="modal__body">
            <p>
              「<strong>{{ deletingRole?.name }}</strong
              >」を削除しますか？
            </p>
            <p class="modal__warning">この操作は取り消せません。</p>

            <div v-if="deleteRoleError" class="error-alert">
              <p>{{ deleteRoleError }}</p>
            </div>
          </div>

          <footer class="modal__footer">
            <button
              type="button"
              class="btn btn--ghost"
              @click="closeDeleteRoleModal"
            >
              キャンセル
            </button>
            <button
              type="button"
              class="btn btn--danger"
              :disabled="isDeletingRole"
              @click="confirmDeleteRole"
            >
              {{ isDeletingRole ? "削除中..." : "削除する" }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Layout */
.project-settings-page {
  padding: var(--ui-space-6, 1.5rem);
}

.settings-alert {
  max-width: 800px;
  margin: 0 auto var(--ui-space-4, 1rem);
}

.settings-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--ui-space-5, 1.25rem);
}

.settings-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
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
  letter-spacing: 0.1em;
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
  max-width: 160px;
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
  border-left: 3px solid var(--ui-danger, #d64545);
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

/* AI Settings */
.ai-settings {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.ai-playground {
  margin-top: var(--ui-space-4, 1rem);
  padding-top: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.ai-playground h4 {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
  margin: 0;
}

.ai-response {
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-brand-100, #e5f6f8);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-brand-300, #b8e3e9);
  color: var(--ui-brand-900, #0b2e33);
  font-size: var(--ui-text-sm, 0.875rem);
  white-space: pre-wrap;
}

.ai-response p {
  margin: 0;
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

/* Role Management */
.role-section__intro {
  margin: 0 0 var(--ui-space-4, 1rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.role-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.role-list__item {
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.role-list__header {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  margin-bottom: var(--ui-space-2, 0.5rem);
}

.role-list__color {
  width: 16px;
  height: 16px;
  border-radius: var(--ui-radius-sm, 0.5rem);
  flex-shrink: 0;
}

.role-list__color--owner {
  background-color: var(--ui-brand-900, #0b2e33);
}

.role-list__name {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.role-list__badge {
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-medium, 500);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text-muted, #64748b);
  padding: 2px 8px;
  border-radius: var(--ui-radius-full, 9999px);
}

.role-list__description {
  margin: 0 0 var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: 1.5;
}

.role-list__edit-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-brand-300, #b8e3e9);
  border-radius: var(--ui-radius-md, 0.75rem);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.role-list__edit-btn:hover {
  background: var(--ui-brand-100, #e5f6f8);
  border-color: var(--ui-brand-400, #7ab5be);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-4, 1rem);
  z-index: 100;
}

.modal {
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-xl, 1.25rem);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--ui-shadow-lg);
}

.modal--lg {
  max-width: 640px;
}

.modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.modal__header h3 {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-brand-900, #0b2e33);
}

.modal__close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal__close:hover {
  color: var(--ui-text-strong, #0f172a);
}

.modal__body {
  padding: var(--ui-space-5, 1.25rem);
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

/* Permission Modal */
.permission-modal-body {
  max-height: 60vh;
  overflow-y: auto;
}

.permission-modal-intro {
  margin: 0 0 var(--ui-space-4, 1rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.permission-page-group {
  margin-bottom: var(--ui-space-4, 1rem);
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-md, 0.75rem);
}

.permission-page-group:last-child {
  margin-bottom: 0;
}

.permission-page-group__header {
  margin-bottom: var(--ui-space-2, 0.5rem);
}

.permission-page-group__title {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-brand-900, #0b2e33);
}

.permission-page-group__desc {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.permission-page-group__items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2, 0.5rem);
}

.permission-checkbox {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  cursor: pointer;
  padding: var(--ui-space-2, 0.5rem);
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-sm, 0.5rem);
  transition: background-color 0.15s ease;
}

.permission-checkbox:hover {
  background: var(--ui-brand-100, #e5f6f8);
}

.permission-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--ui-brand-600, #4f7c82);
  cursor: pointer;
}

.permission-checkbox__label {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.btn--primary {
  background: var(--ui-brand-600, #4f7c82);
  color: white;
}

.btn--primary:hover:not(:disabled) {
  background: var(--ui-brand-700, #3a5c61);
}

.btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--ghost {
  background: transparent;
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  color: var(--ui-text-strong, #0f172a);
}

.btn--ghost:hover {
  background: var(--ui-surface-muted, #f1f5f9);
}

.btn--danger {
  background: var(--ui-danger, #d64545);
  color: white;
}

.btn--danger:hover:not(:disabled) {
  background: var(--ui-danger-hover, #c03a3a);
}

.btn--danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Role Section Additional Styles */
.role-section__intro-box {
  margin-bottom: var(--ui-space-4, 1rem);
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-brand-100, #e5f6f8);
  border-radius: var(--ui-radius-md, 0.75rem);
  border-left: 3px solid var(--ui-brand-600, #4f7c82);
}

.role-section__subtitle {
  margin: 0 0 var(--ui-space-1, 0.25rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-brand-900, #0b2e33);
}

.role-list__item--owner {
  background: var(--ui-brand-100, #e5f6f8);
  border-color: var(--ui-brand-300, #b8e3e9);
}

.role-list__perm-count {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  margin-left: auto;
}

.role-list__actions {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  margin-top: var(--ui-space-2, 0.5rem);
}

.role-list__action-btn {
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-sm, 0.5rem);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.role-list__action-btn:hover {
  background: var(--ui-brand-100, #e5f6f8);
  border-color: var(--ui-brand-300, #b8e3e9);
}

.role-list__action-btn--danger {
  color: var(--ui-danger, #d64545);
}

.role-list__action-btn--danger:hover {
  background: var(--ui-danger-light, #fee2e2);
  border-color: var(--ui-danger, #d64545);
}

.role-section__add {
  margin-top: var(--ui-space-4, 1rem);
  padding-top: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.role-add-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-surface, #ffffff);
  border: 1px dashed var(--ui-brand-400, #7ab5be);
  border-radius: var(--ui-radius-md, 0.75rem);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.role-add-btn:hover {
  background: var(--ui-brand-100, #e5f6f8);
  border-style: solid;
}

/* Form Field */
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
  margin-bottom: var(--ui-space-4, 1rem);
}

.form-label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.required {
  color: var(--ui-danger, #d64545);
}

.form-input {
  width: 100%;
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  background: var(--ui-surface, #ffffff);
  transition: border-color 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
}

/* Color Picker */
.color-picker {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.color-picker__presets {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  flex-wrap: wrap;
}

.color-preset {
  width: 32px;
  height: 32px;
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 2px solid transparent;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease;
}

.color-preset:hover {
  transform: scale(1.1);
}

.color-preset.is-selected {
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow:
    0 0 0 2px var(--ui-surface, #ffffff),
    0 0 0 4px var(--ui-brand-600, #4f7c82);
}

.color-picker__custom {
  display: flex;
  align-items: center;
}

.color-custom-label {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.color-custom-input {
  width: 40px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--ui-radius-sm, 0.5rem);
  cursor: pointer;
}

/* Modal Small */
.modal--sm {
  max-width: 400px;
}

.modal__warning {
  margin-top: var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

/* Error Alert */
.error-alert {
  margin-top: var(--ui-space-4, 1rem);
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-danger-light, #fee2e2);
  border: 1px solid var(--ui-danger, #d64545);
  border-radius: var(--ui-radius-md, 0.75rem);
  color: var(--ui-danger, #d64545);
}

.error-alert p {
  margin: 0;
}
</style>
