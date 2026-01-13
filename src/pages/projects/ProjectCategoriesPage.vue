<script setup lang="ts">
import SectionCard from "@/components/ui/SectionCard.vue";
import { usePageTitle } from "@/composables/usePageTitle";
import AppModal from "@/components/ui/AppModal.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
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
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const logger = getLogger("app.pages.projects.ProjectCategoriesPage");

const { user } = useAuthStore();
const { projectId } = useProjectIdRoute();
const categories = ref<TaskCategory[]>([]);
const canEdit = ref(false);

// ページタイトル設定
usePageTitle("カテゴリ管理", "タスクを整理するためのカテゴリを管理します");

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

/**
 * プリセットカラー（Deep Greenパレットに合う色）
 * 注: これらの値はFirestoreに保存されるデータ値のため、HEXコードを直接使用。
 * CSS変数との対応:
 *   #0b2e33 = --ui-brand-900 (Deep Green)
 *   #4f7c82 = --ui-brand-600 (Teal)
 *   #16a34a = --ui-success (Green)
 *   #f59e0b = --ui-warning (Amber)
 *   #ef4444 = Red (--ui-danger は #d64545)
 *   #8b5cf6 = Purple (トークン未定義)
 *   #3b82f6 = Blue (トークン未定義)
 *   #64748b = --ui-text-muted (Slate)
 */
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
  <div class="project-categories-page">
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
            <AppButton
              type="submit"
              variant="primary"
              :disabled="!newCategory.name.trim() || isCreating"
            >
              {{ isCreating ? "作成中..." : "カテゴリを追加" }}
            </AppButton>
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
              <AppButton
                variant="ghost"
                size="sm"
                @click="openEditModal(category)"
              >
                編集
              </AppButton>
              <AppButton
                variant="danger-outline"
                size="sm"
                @click="openDeleteModal(category)"
              >
                削除
              </AppButton>
            </div>
          </li>
        </ul>
        <AppEmptyState
          v-else
          icon="folder"
          title="カテゴリがまだありません"
          :description="
            canEdit
              ? '上のフォームから新しいカテゴリを作成してください。'
              : 'カテゴリはまだ作成されていません。'
          "
        />
      </SectionCard>
    </div>

    <!-- 編集モーダル -->
    <AppModal :open="isEditModalOpen" size="md" @close="closeEditModal">
      <template #header>
        <h3>カテゴリを編集</h3>
      </template>

      <form @submit.prevent="updateCategory">
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
      </form>

      <template #footer>
        <AppButton variant="ghost" @click="closeEditModal">
          キャンセル
        </AppButton>
        <AppButton
          type="submit"
          variant="primary"
          :disabled="!editForm.name.trim() || isUpdating"
          @click="updateCategory"
        >
          {{ isUpdating ? "保存中..." : "保存" }}
        </AppButton>
      </template>
    </AppModal>

    <!-- 削除確認モーダル -->
    <AppModal :open="isDeleteModalOpen" size="sm" @close="closeDeleteModal">
      <template #header>
        <h3>カテゴリを削除</h3>
      </template>

      <div>
        <p>
          「<strong>{{ deletingCategory?.name }}</strong
          >」を削除しますか？
        </p>
        <p class="modal__warning">この操作は取り消せません。</p>

        <div v-if="deleteError" class="error-alert">
          <p>{{ deleteError }}</p>
        </div>
      </div>

      <template #footer>
        <AppButton variant="ghost" @click="closeDeleteModal">
          キャンセル
        </AppButton>
        <AppButton
          variant="danger"
          :disabled="isDeleting"
          @click="confirmDelete"
        >
          {{ isDeleting ? "削除中..." : "削除する" }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.project-categories-page {
  padding: var(--ui-space-6, 1.5rem);
}

.category-content {
  max-width: 800px;
}

/* 権限警告 */
.permission-warning {
  border: 1px solid color-mix(in srgb, var(--ui-warning) 27%, transparent);
  background: var(--ui-warning-light, #fff7ed);
  border-radius: var(--ui-radius-md);
  padding: var(--ui-space-3) var(--ui-space-4);
  margin-bottom: var(--ui-space-4);
}

.permission-warning__title {
  margin: 0;
  font-weight: var(--ui-font-bold);
  color: var(--ui-warning-dark, #b45309);
}

.permission-warning__desc {
  margin: var(--ui-space-1) 0 0;
  color: var(--ui-warning-text, #92400e);
}

/* フォーム */
.create-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.create-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.create-form__actions {
  display: flex;
  justify-content: flex-end;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  margin-bottom: var(--ui-space-4);
}

.form-label {
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-strong);
}

.required {
  color: var(--ui-danger, #ef4444);
}

.form-input,
.form-textarea {
  width: 100%;
  padding: var(--ui-space-2) var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  font-size: var(--ui-text-base);
  background: var(--ui-surface);
  transition: border-color 0.15s ease;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--ui-brand-600);
}

.form-textarea {
  resize: vertical;
  min-height: 60px;
}

/* カラーピッカー */
.color-picker {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.color-picker__presets {
  display: flex;
  gap: var(--ui-space-1);
  flex-wrap: wrap;
}

.color-preset {
  width: 32px;
  height: 32px;
  border-radius: var(--ui-radius-sm);
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
  border-color: var(--ui-brand-600);
  box-shadow:
    0 0 0 2px var(--ui-surface),
    0 0 0 4px var(--ui-brand-600);
}

.color-picker__custom {
  display: flex;
  align-items: center;
}

.color-custom-label {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
}

.color-custom-input {
  width: 40px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--ui-radius-sm);
  cursor: pointer;
}

/* カテゴリ一覧 */
.category-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  background: var(--ui-surface);
  transition: border-color 0.15s ease;
}

.category-item:hover {
  border-color: var(--ui-brand-400);
}

.category-item__main {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  min-width: 0;
}

.category-item__color {
  width: 24px;
  height: 24px;
  border-radius: var(--ui-radius-sm);
  flex-shrink: 0;
}

.category-item__info {
  min-width: 0;
}

.category-item__name {
  margin: 0;
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-strong);
}

.category-item__desc {
  margin: var(--ui-space-1) 0 0;
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.category-item__actions {
  display: flex;
  gap: var(--ui-space-1);
  flex-shrink: 0;
}

/* 空状態 */
.empty-state {
  text-align: center;
  padding: var(--ui-space-8);
  color: var(--ui-text-muted);
}

.empty-state__hint {
  margin-top: var(--ui-space-2);
  font-size: var(--ui-text-sm);
}

/* モーダルスタイルは AppModal コンポーネントで管理 */

.modal__warning {
  margin-top: var(--ui-space-2);
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
}

/* エラーアラート */
.error-alert {
  margin-top: var(--ui-space-4);
  padding: var(--ui-space-3);
  background: var(--ui-danger-light, #fef2f2);
  border: 1px solid var(--ui-danger, #ef4444);
  border-radius: var(--ui-radius-md);
  color: var(--ui-danger, #ef4444);
}

.error-alert p {
  margin: 0;
}

/* レスポンシブ */
@media (max-width: 768px) {
  .category-content {
    padding: 0 var(--ui-space-3) var(--ui-space-6);
  }

  .category-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-3);
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
