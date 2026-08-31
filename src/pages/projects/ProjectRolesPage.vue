<script setup lang="ts">
import { usePageTitle } from "@/composables/usePageTitle";
import SectionCard from "@/components/ui/SectionCard.vue";
import {
  ProjectPermission,
  type ProjectPermissionKey,
} from "@/constants/permissions";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
import { useProjectAccess } from "@/composables/useProjectAccess";
import {
  listenProjectMembers,
  updateProjectMemberRole,
  type ProjectMember,
} from "@/services/projectMembers";
import {
  listenProjectRoles,
  addRole,
  updateRolePermissions,
  updateRole,
  removeRole,
  type ProjectRole,
} from "@/services/rolesService";
import { useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const logger = getLogger("app.pages.projects.ProjectRolesPage");

const { user, profile } = useAuthStore();

type MemberRole = ProjectMember["role"];

const { projectId } = useProjectIdRoute();
const members = ref<ProjectMember[]>([]);
const roles = ref<ProjectRole[]>([]);

// ページタイトル設定
usePageTitle("ロール管理", "プロジェクトのロールと権限を管理します");
const updating = ref<string | null>(null);

let stopMembers: (() => void) | null = null;
let stopRoles: (() => void) | null = null;

// useProjectAccess で権限管理を統一
const { can } = useProjectAccess(projectId);
const canEdit = computed(() => can(ProjectPermission.MANAGE_ROLES));

// 新規ロール作成フォーム
const isCreateModalOpen = ref(false);
const newRole = ref({
  name: "",
  color: "#64748b",
});
const isCreating = ref(false);

// ロール編集モーダル（名前・色・権限を統合）
const isEditModalOpen = ref(false);
const editingRole = ref<ProjectRole | null>(null);
const editForm = ref({
  name: "",
  color: "",
  permissions: new Set<ProjectPermissionKey>(),
});
const isUpdating = ref(false);
const editActiveTab = ref<"basic" | "permissions">("basic");

// 権限編集モーダル
const isPermissionModalOpen = ref(false);
const editingPermissionRole = ref<ProjectRole | null>(null);
const editingPermissions = ref<Set<ProjectPermissionKey>>(new Set());
const isSavingPermissions = ref(false);

// 削除確認モーダル
const isDeleteModalOpen = ref(false);
const deletingRole = ref<ProjectRole | null>(null);
const deleteError = ref("");
const isDeleting = ref(false);

// プリセットカラー（Deep Greenパレットに合う色）
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

// デフォルトロールの説明
const defaultRoleDescriptions = [
  {
    id: "owner",
    name: "オーナー",
    description:
      "プロジェクトの作成者です。全ての権限を持ち、プロジェクトの削除が可能です。",
    color: "#0b2e33",
    isEditable: false,
  },
  {
    id: "admin",
    name: "管理者",
    description:
      "プロジェクトの管理権限を持ちます。メンバーの招待・管理、タスクの作成・編集・削除などが可能です。",
    color: "#4f7c82",
    isEditable: true,
  },
  {
    id: "member",
    name: "メンバー",
    description:
      "プロジェクトの基本機能を利用できます。タスクの閲覧、自分の担当タスクの進捗更新が可能です。",
    color: "#64748b",
    isEditable: true,
  },
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

// 権限定義（日本語ラベル付き）- 後方互換のため保持
const permissionDefinitions: {
  key: ProjectPermissionKey;
  label: string;
  category: string;
}[] = pagePermissions.flatMap((page) =>
  page.permissions.map((perm) => ({
    key: perm.key,
    label: `${page.page} - ${perm.label}`,
    category: page.page,
  })),
);

// カテゴリごとに権限をグループ化（将来使用予定）
const _permissionsByCategory = computed(() => {
  const groups: Record<string, { key: ProjectPermissionKey; label: string }[]> =
    {};
  for (const perm of permissionDefinitions) {
    if (!groups[perm.category]) {
      groups[perm.category] = [];
    }
    groups[perm.category]!.push({ key: perm.key, label: perm.label });
  }
  return groups;
});
void _permissionsByCategory;

// メンバーに割り当て可能なロール（デフォルト+カスタム）
const roleOptions = computed(() => {
  return roles.value.map((r) => r.id);
});

// メンバー表示用ヘルパー関数
function getMemberDisplayName(member: ProjectMember): string {
  return (
    member.displayName || member.nickname || member.fullName || "不明なユーザー"
  );
}

function getMemberInitials(member: ProjectMember): string {
  const name = getMemberDisplayName(member);
  return name.slice(0, 2);
}

function getMemberSecondaryInfo(member: ProjectMember): string {
  return member.email || "メールアドレス未設定";
}

function watchMembers() {
  stopMembers = listenProjectMembers(projectId.value, (list) => {
    members.value = list;
  });
}

function watchRoles() {
  stopRoles = listenProjectRoles(projectId.value, (list) => {
    roles.value = list;
  });
}

async function changeRole(member: ProjectMember, next: MemberRole) {
  if (!canEdit.value || member.role === "owner") return;
  updating.value = member.userId;
  try {
    const actorName =
      profile.value?.nickname ||
      profile.value?.fullName ||
      user.value?.uid ||
      "System";
    await updateProjectMemberRole(projectId.value, member.userId, next, {
      previousRole: member.role,
      memberName: member.displayName || member.userId,
      actor: {
        id: user.value?.uid ?? null,
        name: actorName,
        origin: "ui",
      },
    });
  } finally {
    updating.value = null;
  }
}

// ロール作成
function openCreateModal() {
  if (!canEdit.value) return;
  newRole.value = { name: "", color: "#64748b" };
  isCreateModalOpen.value = true;
}

function closeCreateModal() {
  isCreateModalOpen.value = false;
  newRole.value = { name: "", color: "#64748b" };
}

async function createRole() {
  if (!canEdit.value || !newRole.value.name.trim()) return;
  if (isCreating.value) return;

  isCreating.value = true;
  try {
    await addRole(projectId.value, newRole.value.name, {
      name: newRole.value.name.trim(),
      color: newRole.value.color,
    });
    closeCreateModal();
  } catch (error) {
    logger.error`Failed to create role: ${error}`;
    alert(
      error instanceof Error ? error.message : "ロールの作成に失敗しました",
    );
  } finally {
    isCreating.value = false;
  }
}

// ロール編集
function openEditModal(role: ProjectRole) {
  if (!canEdit.value) return;
  editingRole.value = role;
  editForm.value = {
    name: role.name,
    color: role.color,
    permissions: new Set(role.permissions),
  };
  editActiveTab.value = "basic";
  isEditModalOpen.value = true;
}

function closeEditModal() {
  isEditModalOpen.value = false;
  editingRole.value = null;
  editForm.value = { name: "", color: "", permissions: new Set() };
  editActiveTab.value = "basic";
}

function toggleEditPermission(key: ProjectPermissionKey) {
  if (editForm.value.permissions.has(key)) {
    editForm.value.permissions.delete(key);
  } else {
    editForm.value.permissions.add(key);
  }
  // 強制再描画のためにSetを再生成
  editForm.value.permissions = new Set(editForm.value.permissions);
}

async function saveRoleEdit() {
  if (!canEdit.value || !editingRole.value) return;
  if (!editForm.value.name.trim()) return;
  if (isUpdating.value) return;

  isUpdating.value = true;
  try {
    // 名前・色を更新
    await updateRole(projectId.value, editingRole.value.id, {
      name: editForm.value.name.trim(),
      color: editForm.value.color,
    });
    // 権限を更新
    await updateRolePermissions(
      projectId.value,
      editingRole.value.id,
      Array.from(editForm.value.permissions),
    );
    closeEditModal();
  } catch (error) {
    logger.error`Failed to update role: ${error}`;
    alert(
      error instanceof Error ? error.message : "ロールの更新に失敗しました",
    );
  } finally {
    isUpdating.value = false;
  }
}

// 権限編集
function openPermissionModal(role: ProjectRole) {
  if (!canEdit.value) return;
  editingPermissionRole.value = role;
  editingPermissions.value = new Set(role.permissions);
  isPermissionModalOpen.value = true;
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
  // 強制再描画のためにSetを再生成
  editingPermissions.value = new Set(editingPermissions.value);
}

async function savePermissions() {
  if (!canEdit.value || !editingPermissionRole.value) return;
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
    alert(error instanceof Error ? error.message : "権限の更新に失敗しました");
  } finally {
    isSavingPermissions.value = false;
  }
}

// ロール削除
function openDeleteModal(role: ProjectRole) {
  if (!canEdit.value) return;
  deletingRole.value = role;
  deleteError.value = "";
  isDeleteModalOpen.value = true;
}

function closeDeleteModal() {
  isDeleteModalOpen.value = false;
  deletingRole.value = null;
  deleteError.value = "";
}

async function confirmDelete() {
  if (!canEdit.value || !deletingRole.value) return;
  if (isDeleting.value) return;

  isDeleting.value = true;
  deleteError.value = "";

  try {
    const result = await removeRole(projectId.value, deletingRole.value.id);
    if (!result.success) {
      deleteError.value = result.error || "ロールの削除に失敗しました";
      return;
    }
    closeDeleteModal();
  } catch (error) {
    logger.error`Failed to delete role: ${error}`;
    deleteError.value =
      error instanceof Error ? error.message : "ロールの削除に失敗しました";
  } finally {
    isDeleting.value = false;
  }
}

// カラーピッカー関連
function selectPresetColor(color: string, target: "new" | "edit") {
  if (target === "new") {
    newRole.value.color = color;
  } else {
    editForm.value.color = color;
  }
}

function handleCustomColorChange(event: Event, target: "new" | "edit") {
  const input = event.target as HTMLInputElement;
  if (target === "new") {
    newRole.value.color = input.value;
  } else {
    editForm.value.color = input.value;
  }
}

// ロールの表示名（IDから名前へ）
function getRoleName(roleId: string): string {
  const role = roles.value.find((r) => r.id === roleId);
  return role?.name || roleId;
}

// ロールの色を取得
function getRoleColor(roleId: string): string {
  const role = roles.value.find((r) => r.id === roleId);
  return role?.color || "#64748b";
}

onMounted(() => {
  watchMembers();
  watchRoles();
});

watch(projectId, (newId, oldId) => {
  if (!newId || newId === oldId) return;
  stopMembers?.();
  stopRoles?.();
  watchMembers();
  watchRoles();
});

onBeforeUnmount(() => {
  stopMembers?.();
  stopRoles?.();
});
</script>

<template>
  <div class="project-roles-page">
    <div class="roles-content">
      <!-- 権限警告 -->
      <div v-if="!canEdit" class="permission-warning">
        <p class="permission-warning__title">管理者のみ編集できます</p>
        <p class="permission-warning__desc">
          閲覧はできますが、追加・編集・削除はできません。
        </p>
      </div>

      <!-- デフォルトロール説明セクション -->
      <SectionCard title="プロジェクトのロール">
        <p class="section-description">
          このプロジェクトには以下の3つのロールがあります。各ロールには異なる権限が設定されています。
        </p>
        <ul class="default-role-list">
          <li
            v-for="roleDesc in defaultRoleDescriptions"
            :key="roleDesc.id"
            class="default-role-item"
          >
            <div class="default-role-item__header">
              <span
                class="default-role-item__color"
                :style="{ backgroundColor: roleDesc.color }"
              />
              <h4 class="default-role-item__name">{{ roleDesc.name }}</h4>
              <span
                v-if="!roleDesc.isEditable"
                class="default-role-item__fixed"
              >
                固定
              </span>
            </div>
            <p class="default-role-item__description">
              {{ roleDesc.description }}
            </p>
            <div
              v-if="
                roleDesc.isEditable &&
                canEdit &&
                roles.find((r) => r.id === roleDesc.id)
              "
              class="default-role-item__actions"
            >
              <button
                type="button"
                class="btn btn--ghost btn--sm"
                @click="openEditModal(roles.find((r) => r.id === roleDesc.id)!)"
              >
                編集
              </button>
            </div>
          </li>
        </ul>
      </SectionCard>

      <!-- カスタムロール一覧セクション -->
      <SectionCard title="カスタムロール">
        <template #headerActions>
          <button
            v-if="canEdit"
            type="button"
            class="btn btn--primary btn--sm"
            @click="openCreateModal"
          >
            ロールを追加
          </button>
        </template>

        <ul v-if="roles.filter((r) => !r.isDefault).length" class="role-list">
          <li
            v-for="role in roles.filter((r) => !r.isDefault)"
            :key="role.id"
            class="role-item"
          >
            <div class="role-item__main">
              <span
                class="role-item__color"
                :style="{ backgroundColor: role.color }"
              />
              <div class="role-item__info">
                <p class="role-item__name">
                  {{ role.name }}
                </p>
                <p class="role-item__meta">
                  {{ role.permissions.length }}個の権限
                </p>
              </div>
            </div>
            <div v-if="canEdit" class="role-item__actions">
              <button
                type="button"
                class="btn btn--ghost btn--sm"
                @click="openPermissionModal(role)"
              >
                権限
              </button>
              <button
                type="button"
                class="btn btn--ghost btn--sm"
                @click="openEditModal(role)"
              >
                編集
              </button>
              <button
                type="button"
                class="btn btn--danger-outline btn--sm"
                @click="openDeleteModal(role)"
              >
                削除
              </button>
            </div>
          </li>
        </ul>
        <div v-else class="empty-state">
          <p>カスタムロールはまだありません。必要に応じて追加できます。</p>
        </div>
      </SectionCard>

      <!-- メンバーロール割り当てセクション -->
      <SectionCard title="メンバーごとのロール割り当て">
        <ul v-if="members.length" class="member-list">
          <li
            v-for="member in members"
            :key="member.userId"
            class="member-item"
          >
            <div class="member-item__persona">
              <div class="avatar" aria-hidden="true">
                {{ getMemberInitials(member) }}
              </div>
              <div>
                <p class="member-item__name">
                  {{ getMemberDisplayName(member) }}
                </p>
                <p class="member-item__meta">
                  {{ getMemberSecondaryInfo(member) }}
                </p>
              </div>
            </div>
            <div class="member-item__selector">
              <label class="sr-only" :for="`role-${member.userId}`"
                >ロール</label
              >
              <select
                :id="`role-${member.userId}`"
                :value="member.role"
                :disabled="
                  !canEdit ||
                  member.role === 'owner' ||
                  updating === member.userId
                "
                @change="
                  changeRole(
                    member,
                    ($event.target as HTMLSelectElement).value as MemberRole,
                  )
                "
              >
                <option v-if="member.role === 'owner'" value="owner">
                  owner
                </option>
                <option
                  v-for="roleId in roleOptions"
                  :key="roleId"
                  :value="roleId"
                >
                  {{ getRoleName(roleId) }}
                </option>
              </select>
            </div>
            <span
              class="role-badge"
              :style="{
                backgroundColor:
                  member.role === 'owner'
                    ? '#0b2e33'
                    : getRoleColor(member.role),
              }"
            >
              {{ member.role === "owner" ? "owner" : getRoleName(member.role) }}
            </span>
          </li>
          <li v-if="!members.length" class="member-item member-item--empty">
            メンバーがいません。
          </li>
        </ul>
        <p v-if="!canEdit" class="muted">管理者のみ変更できます。</p>
      </SectionCard>
    </div>

    <!-- ロール作成モーダル -->
    <Teleport to="body">
      <div
        v-if="isCreateModalOpen"
        class="modal-overlay"
        @click.self="closeCreateModal"
      >
        <div class="modal" role="dialog" aria-labelledby="create-modal-title">
          <header class="modal__header">
            <h3 id="create-modal-title">新しいロールを作成</h3>
            <button
              type="button"
              class="modal__close"
              aria-label="閉じる"
              @click="closeCreateModal"
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
                placeholder="例: moderator"
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
                @click="closeCreateModal"
              >
                キャンセル
              </button>
              <button
                type="submit"
                class="btn btn--primary"
                :disabled="!newRole.name.trim() || isCreating"
              >
                {{ isCreating ? "作成中..." : "作成" }}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- ロール編集モーダル -->
    <Teleport to="body">
      <div
        v-if="isEditModalOpen"
        class="modal-overlay"
        @click.self="closeEditModal"
      >
        <div
          class="modal modal--lg"
          role="dialog"
          aria-labelledby="edit-modal-title"
        >
          <header class="modal__header">
            <h3 id="edit-modal-title">
              ロールを編集 - {{ editingRole?.name }}
            </h3>
            <button
              type="button"
              class="modal__close"
              aria-label="閉じる"
              @click="closeEditModal"
            >
              &times;
            </button>
          </header>

          <!-- タブ切り替え -->
          <div class="modal-tabs">
            <button
              type="button"
              class="modal-tab"
              :class="{ 'modal-tab--active': editActiveTab === 'basic' }"
              @click="editActiveTab = 'basic'"
            >
              基本情報
            </button>
            <button
              type="button"
              class="modal-tab"
              :class="{ 'modal-tab--active': editActiveTab === 'permissions' }"
              @click="editActiveTab = 'permissions'"
            >
              権限
            </button>
          </div>

          <form class="modal__body" @submit.prevent="saveRoleEdit">
            <!-- 基本情報タブ -->
            <div v-if="editActiveTab === 'basic'">
              <div class="form-field">
                <label class="form-label">
                  ロール名 <span class="required">*</span>
                </label>
                <input
                  v-model="editForm.name"
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
                        'is-selected': editForm.color === preset.value,
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
                        :value="editForm.color || '#64748b'"
                        @input="handleCustomColorChange($event, 'edit')"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- 権限タブ -->
            <div
              v-if="editActiveTab === 'permissions'"
              class="permission-modal-body"
            >
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
                      :checked="editForm.permissions.has(perm.key)"
                      @change="toggleEditPermission(perm.key)"
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
                @click="closeEditModal"
              >
                キャンセル
              </button>
              <button
                type="submit"
                class="btn btn--primary"
                :disabled="!editForm.name.trim() || isUpdating"
              >
                {{ isUpdating ? "保存中..." : "保存" }}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </Teleport>

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

    <!-- ロール削除確認モーダル -->
    <Teleport to="body">
      <div
        v-if="isDeleteModalOpen"
        class="modal-overlay"
        @click.self="closeDeleteModal"
      >
        <div
          class="modal modal--sm"
          role="alertdialog"
          aria-labelledby="delete-modal-title"
        >
          <header class="modal__header">
            <h3 id="delete-modal-title">ロールを削除</h3>
            <button
              type="button"
              class="modal__close"
              aria-label="閉じる"
              @click="closeDeleteModal"
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

            <div v-if="deleteError" class="error-alert">
              <p>{{ deleteError }}</p>
            </div>
          </div>

          <footer class="modal__footer">
            <button
              type="button"
              class="btn btn--ghost"
              @click="closeDeleteModal"
            >
              キャンセル
            </button>
            <button
              type="button"
              class="btn btn--danger"
              :disabled="isDeleting"
              @click="confirmDelete"
            >
              {{ isDeleting ? "削除中..." : "削除する" }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.roles-content {
  padding: 0 var(--ui-space-6, 1.5rem) var(--ui-space-8, 2rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
  max-width: 900px;
}

/* 権限警告 */
.permission-warning {
  border: 1px solid var(--color-warning-border, #f59e0b44);
  background: var(--color-warning-bg, #fff7ed);
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
}

.permission-warning__title {
  margin: 0;
  font-weight: var(--ui-font-bold, 700);
  color: var(--color-warning-text, #b45309);
}

.permission-warning__desc {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--color-warning-text-muted, #92400e);
}

/* セクション説明 */
.section-description {
  margin: 0 0 var(--ui-space-4, 1rem);
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

/* デフォルトロール一覧 */
.default-role-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.default-role-item {
  padding: var(--ui-space-4, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  background: var(--ui-surface, #ffffff);
}

.default-role-item__header {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  margin-bottom: var(--ui-space-2, 0.5rem);
}

.default-role-item__color {
  width: 20px;
  height: 20px;
  border-radius: var(--ui-radius-sm, 0.5rem);
  flex-shrink: 0;
}

.default-role-item__name {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.default-role-item__fixed {
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-medium, 500);
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
  padding: var(--ui-space-px, 2px) var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-full, 9999px);
}

.default-role-item__description {
  margin: 0 0 var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: 1.5;
}

.default-role-item__actions {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
}

/* ロール一覧 */
.role-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.role-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  transition: var(--ui-transition-all);
}

.role-item:hover {
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-sm);
}

.role-item__main {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.role-item__color {
  width: 24px;
  height: 24px;
  border-radius: var(--ui-radius-sm, 0.5rem);
  flex-shrink: 0;
}

.role-item__info {
  min-width: 0;
}

.role-item__name {
  margin: 0;
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
}

.role-item__badge {
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-medium, 500);
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
  padding: var(--ui-space-px, 2px) var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-full, 9999px);
}

.role-item__meta {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.role-item__actions {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  flex-shrink: 0;
}

/* メンバー一覧 */
.member-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.member-item {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: var(--ui-surface, #ffffff);
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  gap: var(--ui-space-3, 0.75rem);
  align-items: center;
  transition: var(--ui-transition-all);
}

.member-item:hover {
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-sm);
}

.member-item--empty {
  justify-content: center;
  color: var(--ui-text-muted, #64748b);
}

.member-item__persona {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-brand-300, #b8e3e9);
  color: var(--ui-brand-900, #0b2e33);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--ui-font-bold, 700);
  font-size: var(--ui-text-sm, 0.875rem);
}

.member-item__name {
  margin: 0;
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text, #0b2e33);
}

.member-item__meta {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.member-item__selector select {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  background: var(--ui-surface-muted, #f1f5f9);
  font-size: var(--ui-text-sm, 0.875rem);
  transition: var(--ui-transition-colors);
}

.member-item__selector select:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.role-badge {
  border-radius: var(--ui-radius-full, 9999px);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  font-weight: var(--ui-font-bold, 700);
  font-size: var(--ui-text-xs, 0.75rem);
  color: white;
  text-transform: capitalize;
}

.muted {
  color: var(--ui-text-muted, #64748b);
  margin-top: var(--ui-space-3, 0.75rem);
}

/* 空状態 */
.empty-state {
  text-align: center;
  padding: var(--ui-space-8, 2rem);
  color: var(--ui-text-muted, #64748b);
}

/* ボタン */
/* モーダル */
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

.modal--sm {
  max-width: 400px;
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

/* モーダルタブ */
.modal-tabs {
  display: flex;
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  padding: 0 var(--ui-space-5, 1.25rem);
  gap: var(--ui-space-1, 0.25rem);
}

.modal-tab {
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border: none;
  background: transparent;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  position: relative;
  transition: color 0.15s ease;
}

.modal-tab:hover {
  color: var(--ui-text, #0b2e33);
}

.modal-tab--active {
  color: var(--ui-brand-600, #4f7c82);
  font-weight: var(--ui-font-semibold, 600);
}

.modal-tab--active::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--ui-brand-600, #4f7c82);
  border-radius: var(--ui-radius-full, 9999px) var(--ui-radius-full, 9999px) 0 0;
}

.modal__close {
  background: transparent;
  border: none;
  font-size: var(--ui-text-2xl, 1.5rem);
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

.modal__warning {
  margin-top: var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

/* フォーム */
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
  color: var(--color-danger, #ef4444);
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

/* カラーピッカー */
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

/* 権限モーダル */
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

.permission-group {
  margin-bottom: var(--ui-space-5, 1.25rem);
}

.permission-group:last-child {
  margin-bottom: 0;
}

.permission-group__title {
  margin: 0 0 var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-brand-900, #0b2e33);
  padding-bottom: var(--ui-space-2, 0.5rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.permission-group__items {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.permission-checkbox {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  cursor: pointer;
  padding: var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  transition: background-color 0.15s ease;
}

.permission-checkbox:hover {
  background: var(--ui-surface-muted, #f1f5f9);
}

.permission-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--ui-brand-600, #4f7c82);
  cursor: pointer;
}

.permission-checkbox__label {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
}

/* エラーアラート */
.error-alert {
  margin-top: var(--ui-space-4, 1rem);
  padding: var(--ui-space-3, 0.75rem);
  background: var(--color-danger-bg, #fef2f2);
  border: 1px solid var(--color-danger, #ef4444);
  border-radius: var(--ui-radius-md, 0.75rem);
  color: var(--color-danger, #ef4444);
}

.error-alert p {
  margin: 0;
}

/* レスポンシブ */
@media (max-width: 768px) {
  .roles-content {
    padding: 0 var(--ui-space-4, 1rem) var(--ui-space-8, 2rem);
  }

  .role-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-3, 0.75rem);
  }

  .role-item__actions {
    width: 100%;
    justify-content: flex-end;
  }

  .member-item {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }
}
</style>
