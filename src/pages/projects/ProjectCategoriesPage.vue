<script setup lang="ts">
import PageHeader from "@/components/ui/PageHeader.vue";
import SectionCard from "@/components/ui/SectionCard.vue";
import { appName } from "@/constants/appMeta";
import { buildProjectNavItems } from "@/constants/projectNav";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
import ProjectAppShell from "@/layouts/ProjectAppShell.vue";
import { db } from "@/lib/firebase";
import {
  addTaskCategory,
  deleteTaskCategory,
  listenTaskCategories,
  updateTaskCategory,
  type TaskCategory,
} from "@/services/taskCategoryService";
import { useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { doc, getDoc } from "firebase/firestore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const logger = getLogger("app.pages.projects.ProjectCategoriesPage");

const { user, profile } = useAuthStore();
const { projectId } = useProjectIdRoute();
const categories = ref<TaskCategory[]>([]);
const canEdit = ref(false);

// 作成フォーム
const newCategory = ref({
  name: "",
  color: "",
  description: "",
});

// 編集モーダル
const isEditModalOpen = ref(false);
const editingCategory = ref<TaskCategory | null>(null);
const editForm = ref({
  name: "",
  color: "",
  description: "",
});

// 削除確認モーダル
const isDeleteModalOpen = ref(false);
const deletingCategory = ref<TaskCategory | null>(null);
const deleteError = ref("");
const isDeleting = ref(false);

// 操作中フラグ
const isCreating = ref(false);
const isUpdating = ref(false);

// プリセットカラー（Deep Greenパレットに合う色）
const presetColors = [
  { value: "#0b2e33", label: "Deep Green" },
  { value: "#4f7c82", label: "Teal" },
  { value: "#16a34a", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#64748b", label: "Slate" },
];

let stopCategories: (() => void) | null = null;

const navItems = computed(() => buildProjectNavItems(projectId.value));

const profileInfo = computed(() => ({
  name: profile.value?.nickname || profile.value?.fullName || `${appName} User`,
  email: profile.value?.email || "",
}));

async function evaluatePermissions() {
  if (!user.value) {
    canEdit.value = false;
    return;
  }
  const memberSnap = await getDoc(
    doc(db, "projects", projectId.value, "members", user.value.uid),
  );
  const data = memberSnap.data();
  canEdit.value = Boolean(
    data?.role === "admin" || data?.projectRole === "owner",
  );
}

function watchCategories() {
  stopCategories = listenTaskCategories(projectId.value, (list) => {
    categories.value = list;
  });
}

// 作成
async function createCategory() {
  if (!canEdit.value || !newCategory.value.name.trim()) return;
  if (isCreating.value) return;

  isCreating.value = true;
  try {
    await addTaskCategory(projectId.value, newCategory.value.name, {
      color: newCategory.value.color || undefined,
      description: newCategory.value.description || undefined,
    });
    newCategory.value = { name: "", color: "", description: "" };
  } catch (error) {
    logger.error`Failed to create category: ${error}`;
    alert(
      error instanceof Error ? error.message : "カテゴリの作成に失敗しました",
    );
  } finally {
    isCreating.value = false;
  }
}

// 編集モーダルを開く
function openEditModal(category: TaskCategory) {
  if (!canEdit.value) return;
  editingCategory.value = category;
  editForm.value = {
    name: category.name,
    color: category.color || "",
    description: category.description || "",
  };
  isEditModalOpen.value = true;
}

// 編集モーダルを閉じる
function closeEditModal() {
  isEditModalOpen.value = false;
  editingCategory.value = null;
  editForm.value = { name: "", color: "", description: "" };
}

// 更新
async function updateCategory() {
  if (!canEdit.value || !editingCategory.value) return;
  if (!editForm.value.name.trim()) return;
  if (isUpdating.value) return;

  isUpdating.value = true;
  try {
    await updateTaskCategory(projectId.value, editingCategory.value.id, {
      name: editForm.value.name,
      color: editForm.value.color || undefined,
      description: editForm.value.description || undefined,
    });
    closeEditModal();
  } catch (error) {
    logger.error`Failed to update category: ${error}`;
    alert(
      error instanceof Error ? error.message : "カテゴリの更新に失敗しました",
    );
  } finally {
    isUpdating.value = false;
  }
}

// 削除確認モーダルを開く
function openDeleteModal(category: TaskCategory) {
  if (!canEdit.value) return;
  deletingCategory.value = category;
  deleteError.value = "";
  isDeleteModalOpen.value = true;
}

// 削除確認モーダルを閉じる
function closeDeleteModal() {
  isDeleteModalOpen.value = false;
  deletingCategory.value = null;
  deleteError.value = "";
}

// 削除
async function confirmDelete() {
  if (!canEdit.value || !deletingCategory.value) return;
  if (isDeleting.value) return;

  isDeleting.value = true;
  deleteError.value = "";

  try {
    await deleteTaskCategory(projectId.value, deletingCategory.value.id);
    closeDeleteModal();
  } catch (error) {
    logger.error`Failed to delete category: ${error}`;
    deleteError.value =
      error instanceof Error ? error.message : "カテゴリの削除に失敗しました";
  } finally {
    isDeleting.value = false;
  }
}

// カラーピッカー関連
function selectPresetColor(color: string, target: "new" | "edit") {
  if (target === "new") {
    newCategory.value.color = color;
  } else {
    editForm.value.color = color;
  }
}

function handleCustomColorChange(event: Event, target: "new" | "edit") {
  const input = event.target as HTMLInputElement;
  if (target === "new") {
    newCategory.value.color = input.value;
  } else {
    editForm.value.color = input.value;
  }
}

onMounted(() => {
  evaluatePermissions();
  watchCategories();
});

watch(projectId, (newId, oldId) => {
  if (!newId || newId === oldId) return;
  evaluatePermissions();
  stopCategories?.();
  watchCategories();
});

onBeforeUnmount(() => {
  stopCategories?.();
});
</script>

<template>
  <ProjectAppShell
    :project-id="projectId"
    :nav-items="navItems"
    :sidebar-projects="[]"
    :profile-info="profileInfo"
    brand-subtitle="カテゴリ"
  >
    <template #headerTitle>
      <PageHeader
        breadcrumb="プロジェクト > カテゴリ"
        title="カテゴリ管理"
        subtitle="タスクを整理するためのカテゴリを管理します"
      />
    </template>

    <div class="category-content">
      <!-- 権限警告 -->
      <div v-if="!canEdit" class="permission-warning">
        <p class="permission-warning__title">管理者のみ編集できます</p>
        <p class="permission-warning__desc">
          閲覧はできますが、追加・編集・削除はできません。
        </p>
      </div>

      <!-- 新規作成セクション -->
      <SectionCard v-if="canEdit" title="新規カテゴリ作成">
        <form class="create-form" @submit.prevent="createCategory">
          <div class="create-form__field">
            <label class="form-label">
              カテゴリ名 <span class="required">*</span>
            </label>
            <input
              v-model="newCategory.name"
              type="text"
              class="form-input"
              placeholder="例: バグ修正"
              maxlength="30"
              required
            />
          </div>

          <div class="create-form__field">
            <label class="form-label">カラー</label>
            <div class="color-picker">
              <div class="color-picker__presets">
                <button
                  v-for="preset in presetColors"
                  :key="preset.value"
                  type="button"
                  class="color-preset"
                  :class="{ 'is-selected': newCategory.color === preset.value }"
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
                    :value="newCategory.color || '#0b2e33'"
                    @input="handleCustomColorChange($event, 'new')"
                  />
                </label>
              </div>
            </div>
          </div>

          <div class="create-form__field">
            <label class="form-label">説明</label>
            <textarea
              v-model="newCategory.description"
              class="form-textarea"
              placeholder="カテゴリの説明（オプション）"
              rows="2"
            />
          </div>

          <div class="create-form__actions">
            <button
              type="submit"
              class="btn btn--primary"
              :disabled="!newCategory.name.trim() || isCreating"
            >
              {{ isCreating ? "作成中..." : "カテゴリを追加" }}
            </button>
          </div>
        </form>
      </SectionCard>

      <!-- カテゴリ一覧 -->
      <SectionCard title="カテゴリ一覧">
        <ul v-if="categories.length" class="category-list">
          <li
            v-for="category in categories"
            :key="category.id"
            class="category-item"
          >
            <div class="category-item__main">
              <span
                v-if="category.color"
                class="category-item__color"
                :style="{ backgroundColor: category.color }"
              />
              <div class="category-item__info">
                <p class="category-item__name">{{ category.name }}</p>
                <p v-if="category.description" class="category-item__desc">
                  {{ category.description }}
                </p>
              </div>
            </div>
            <div v-if="canEdit" class="category-item__actions">
              <button
                type="button"
                class="btn btn--ghost btn--sm"
                @click="openEditModal(category)"
              >
                編集
              </button>
              <button
                type="button"
                class="btn btn--danger-outline btn--sm"
                @click="openDeleteModal(category)"
              >
                削除
              </button>
            </div>
          </li>
        </ul>
        <div v-else class="empty-state">
          <p>カテゴリがまだありません。</p>
          <p v-if="canEdit" class="empty-state__hint">
            上のフォームから新しいカテゴリを作成してください。
          </p>
        </div>
      </SectionCard>
    </div>

    <!-- 編集モーダル -->
    <Teleport to="body">
      <div
        v-if="isEditModalOpen"
        class="modal-overlay"
        @click.self="closeEditModal"
      >
        <div class="modal" role="dialog" aria-labelledby="edit-modal-title">
          <header class="modal__header">
            <h3 id="edit-modal-title">カテゴリを編集</h3>
            <button
              type="button"
              class="modal__close"
              aria-label="閉じる"
              @click="closeEditModal"
            >
              &times;
            </button>
          </header>

          <form class="modal__body" @submit.prevent="updateCategory">
            <div class="form-field">
              <label class="form-label">
                カテゴリ名 <span class="required">*</span>
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
                    :class="{ 'is-selected': editForm.color === preset.value }"
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
                      :value="editForm.color || '#0b2e33'"
                      @input="handleCustomColorChange($event, 'edit')"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div class="form-field">
              <label class="form-label">説明</label>
              <textarea
                v-model="editForm.description"
                class="form-textarea"
                rows="2"
              />
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

    <!-- 削除確認モーダル -->
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
            <h3 id="delete-modal-title">カテゴリを削除</h3>
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
              「<strong>{{ deletingCategory?.name }}</strong
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
  </ProjectAppShell>
</template>

<style scoped>
.category-content {
  padding: 0 var(--gap-lg) var(--gap-2xl);
  max-width: 800px;
}

/* 権限警告 */
.permission-warning {
  border: 1px solid var(--color-warning-border, #f59e0b44);
  background: var(--color-warning-bg, #fff7ed);
  border-radius: var(--radius-md);
  padding: var(--gap-md) var(--gap-lg);
  margin-bottom: var(--gap-lg);
}

.permission-warning__title {
  margin: 0;
  font-weight: var(--font-weight-bold);
  color: var(--color-warning-text, #b45309);
}

.permission-warning__desc {
  margin: var(--gap-xs) 0 0;
  color: var(--color-warning-text-muted, #92400e);
}

/* フォーム */
.create-form {
  display: flex;
  flex-direction: column;
  gap: var(--gap-lg);
}

.create-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}

.create-form__actions {
  display: flex;
  justify-content: flex-end;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
  margin-bottom: var(--gap-lg);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-strong);
}

.required {
  color: var(--color-danger, #ef4444);
}

.form-input,
.form-textarea {
  width: 100%;
  padding: var(--gap-sm) var(--gap-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  background: var(--surface);
  transition: border-color 0.15s ease;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--brand);
}

.form-textarea {
  resize: vertical;
  min-height: 60px;
}

/* カラーピッカー */
.color-picker {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}

.color-picker__presets {
  display: flex;
  gap: var(--gap-xs);
  flex-wrap: wrap;
}

.color-preset {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
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
  border-color: var(--brand);
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 4px var(--brand);
}

.color-picker__custom {
  display: flex;
  align-items: center;
}

.color-custom-label {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.color-custom-input {
  width: 40px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

/* カテゴリ一覧 */
.category-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--gap-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  transition: border-color 0.15s ease;
}

.category-item:hover {
  border-color: var(--brand-muted);
}

.category-item__main {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  min-width: 0;
}

.category-item__color {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.category-item__info {
  min-width: 0;
}

.category-item__name {
  margin: 0;
  font-weight: var(--font-weight-semibold);
  color: var(--text-strong);
}

.category-item__desc {
  margin: var(--gap-xs) 0 0;
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.category-item__actions {
  display: flex;
  gap: var(--gap-xs);
  flex-shrink: 0;
}

/* 空状態 */
.empty-state {
  text-align: center;
  padding: var(--gap-2xl);
  color: var(--text-muted);
}

.empty-state__hint {
  margin-top: var(--gap-sm);
  font-size: var(--font-size-sm);
}

/* ボタン */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap-xs);
  padding: var(--gap-sm) var(--gap-lg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.btn--sm {
  padding: var(--gap-xs) var(--gap-sm);
  font-size: var(--font-size-sm);
}

.btn--primary {
  background: var(--brand);
  color: var(--text-on-brand);
}

.btn--primary:hover:not(:disabled) {
  background: var(--brand-hover);
}

.btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--ghost {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-strong);
}

.btn--ghost:hover {
  background: var(--surface-hover);
}

.btn--danger {
  background: var(--color-danger, #ef4444);
  color: white;
}

.btn--danger:hover:not(:disabled) {
  background: var(--color-danger-hover, #dc2626);
}

.btn--danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--danger-outline {
  background: transparent;
  border: 1px solid var(--color-danger, #ef4444);
  color: var(--color-danger, #ef4444);
}

.btn--danger-outline:hover {
  background: var(--color-danger-bg, #fef2f2);
}

/* モーダル */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--gap-lg);
  z-index: 100;
}

.modal {
  background: var(--surface);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal--sm {
  max-width: 400px;
}

.modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--gap-lg);
  border-bottom: 1px solid var(--border-color);
}

.modal__header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--brand);
}

.modal__close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal__close:hover {
  color: var(--text-strong);
}

.modal__body {
  padding: var(--gap-lg);
}

.modal__warning {
  margin-top: var(--gap-sm);
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--gap-sm);
  padding: var(--gap-lg);
  border-top: 1px solid var(--border-color);
}

/* エラーアラート */
.error-alert {
  margin-top: var(--gap-lg);
  padding: var(--gap-md);
  background: var(--color-danger-bg, #fef2f2);
  border: 1px solid var(--color-danger, #ef4444);
  border-radius: var(--radius-md);
  color: var(--color-danger, #ef4444);
}

.error-alert p {
  margin: 0;
}

/* レスポンシブ */
@media (max-width: 768px) {
  .category-content {
    padding: 0 var(--gap-md) var(--gap-xl);
  }

  .category-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--gap-md);
  }

  .category-item__actions {
    width: 100%;
    justify-content: flex-end;
  }

  .category-item__desc {
    max-width: 100%;
  }
}
</style>
