<script setup lang="ts">
/**
 * InviteCodeManager - 招待コード管理パネル
 *
 * 機能:
 * - 新規招待コード作成フォーム（最大使用回数、有効期限、メモ）
 * - 作成したコードをコピー可能な形式で表示
 * - 既存コード一覧表示（ステータス、使用状況、作成日）
 * - ステータスフィルター
 */
import { ref, computed, onMounted } from "vue";
import { getLogger } from "@logtape/logtape";
import AppInput from "@/components/ui/AppInput.vue";
import AppButton from "@/components/ui/AppButton.vue";
import SectionCard from "@/components/ui/SectionCard.vue";
import { createInviteCode, listInviteCodes } from "../services/adminService";
import type { InvitationCode } from "../types/admin";

const logger = getLogger(["features", "admin", "InviteCodeManager"]);

// フィルターオプション
type StatusFilter = "all" | "active" | "used" | "expired";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "すべて",
  active: "有効",
  used: "使用済み",
  expired: "期限切れ",
};

// State
const codes = ref<InvitationCode[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const statusFilter = ref<StatusFilter>("all");

// 新規作成フォーム
const formMaxUses = ref<string>("");
const formExpiresAt = ref<string>("");
const formNote = ref("");
const isCreating = ref(false);
const createError = ref<string | null>(null);
const createdCode = ref<string | null>(null);
const copySuccess = ref(false);

// フィルター済みコード一覧
const filteredCodes = computed(() => {
  if (statusFilter.value === "all") {
    return codes.value;
  }
  return codes.value.filter((code) => code.status === statusFilter.value);
});

// コード一覧の取得
async function loadCodes() {
  isLoading.value = true;
  error.value = null;

  try {
    codes.value = await listInviteCodes();
  } catch (e) {
    logger.error`招待コード一覧の取得に失敗しました: ${e}`;
    error.value = "招待コードの取得に失敗しました。再読み込みしてください。";
  } finally {
    isLoading.value = false;
  }
}

// 新規招待コードの作成
async function handleCreate() {
  isCreating.value = true;
  createError.value = null;
  createdCode.value = null;

  try {
    const params: {
      maxUses?: number;
      expiresAt?: string;
      note?: string;
    } = {};

    // 最大使用回数
    if (formMaxUses.value) {
      const maxUses = parseInt(formMaxUses.value, 10);
      if (isNaN(maxUses) || maxUses < 1) {
        createError.value = "最大使用回数は1以上の数値を入力してください";
        return;
      }
      params.maxUses = maxUses;
    }

    // 有効期限
    if (formExpiresAt.value) {
      params.expiresAt = new Date(formExpiresAt.value).toISOString();
    }

    // メモ
    if (formNote.value.trim()) {
      params.note = formNote.value.trim();
    }

    const result = await createInviteCode(params);
    if (result.success && result.data?.code) {
      createdCode.value = result.data.code;
      // フォームをリセット
      formMaxUses.value = "";
      formExpiresAt.value = "";
      formNote.value = "";
      // コード一覧を再取得
      await loadCodes();
      logger.info`招待コードを作成しました: ${result.data.code}`;
    } else {
      throw new Error(result.error || "コードの作成に失敗しました");
    }
  } catch (e) {
    logger.error`招待コードの作成に失敗しました: ${e}`;
    createError.value =
      "招待コードの作成に失敗しました。もう一度お試しください。";
  } finally {
    isCreating.value = false;
  }
}

// コードをクリップボードにコピー
async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (e) {
    logger.error`クリップボードへのコピーに失敗しました: ${e}`;
  }
}

// 日付のフォーマット（ISO文字列を受け取る）
function formatDate(isoString: string | null): string {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ステータスに応じたバッジクラス
function getStatusClass(status: string): string {
  switch (status) {
    case "active":
      return "badge--success";
    case "used":
      return "badge--neutral";
    case "expired":
      return "badge--warning";
    case "revoked":
      return "badge--danger";
    default:
      return "badge--neutral";
  }
}

// ステータスのラベル
function getStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "有効";
    case "used":
      return "使用済み";
    case "expired":
      return "期限切れ";
    case "revoked":
      return "無効化済み";
    default:
      return status;
  }
}

// 初期ロード
onMounted(() => {
  loadCodes();
});
</script>

<template>
  <div class="invite-code-manager">
    <!-- 新規作成セクション -->
    <SectionCard
      title="新規招待コード作成"
      subtitle="新しい招待コードを発行します"
    >
      <form class="create-form" @submit.prevent="handleCreate">
        <div class="form-row">
          <div class="form-group">
            <label for="maxUses" class="form-label">最大使用回数（任意）</label>
            <AppInput
              id="maxUses"
              v-model="formMaxUses"
              type="number"
              placeholder="無制限"
              :disabled="isCreating"
            />
          </div>

          <div class="form-group">
            <label for="expiresAt" class="form-label">有効期限（任意）</label>
            <input
              id="expiresAt"
              v-model="formExpiresAt"
              type="date"
              class="date-input"
              :disabled="isCreating"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="note" class="form-label">メモ（任意）</label>
          <AppInput
            id="note"
            v-model="formNote"
            type="text"
            placeholder="例: 新規チームメンバー用"
            :disabled="isCreating"
          />
        </div>

        <!-- エラーメッセージ -->
        <p v-if="createError" class="form-error" role="alert">
          {{ createError }}
        </p>

        <AppButton
          type="submit"
          variant="primary"
          :loading="isCreating"
          :disabled="isCreating"
        >
          招待コードを作成
        </AppButton>
      </form>

      <!-- 作成されたコードの表示 -->
      <div v-if="createdCode" class="created-code-section">
        <p class="created-code-label">作成された招待コード:</p>
        <div class="created-code-display">
          <code class="created-code">{{ createdCode }}</code>
          <AppButton
            variant="outline"
            size="sm"
            @click="copyCode(createdCode!)"
          >
            {{ copySuccess ? "コピーしました" : "コピー" }}
          </AppButton>
        </div>
      </div>
    </SectionCard>

    <!-- コード一覧セクション -->
    <SectionCard title="招待コード一覧" class="codes-section">
      <template #headerActions>
        <div class="filter-tabs">
          <button
            v-for="(label, key) in STATUS_LABELS"
            :key="key"
            :class="[
              'filter-tab',
              { 'filter-tab--active': statusFilter === key },
            ]"
            @click="statusFilter = key as StatusFilter"
          >
            {{ label }}
          </button>
        </div>
      </template>

      <!-- ローディング -->
      <div v-if="isLoading" class="loading-state">
        <p>読み込み中...</p>
      </div>

      <!-- エラー -->
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <AppButton variant="outline" size="sm" @click="loadCodes">
          再読み込み
        </AppButton>
      </div>

      <!-- コード一覧テーブル -->
      <div v-else-if="filteredCodes.length > 0" class="codes-table-wrapper">
        <table class="codes-table">
          <thead>
            <tr>
              <th>コード</th>
              <th>ステータス</th>
              <th>使用状況</th>
              <th>有効期限</th>
              <th>作成日</th>
              <th>メモ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="code in filteredCodes" :key="code.id">
              <td>
                <div class="code-cell">
                  <code class="code-value">{{ code.code }}</code>
                  <button
                    class="copy-btn"
                    aria-label="コードをコピー"
                    @click="copyCode(code.code)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path
                        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                      />
                    </svg>
                  </button>
                </div>
              </td>
              <td>
                <span :class="['badge', getStatusClass(code.status)]">
                  {{ getStatusLabel(code.status) }}
                </span>
              </td>
              <td>{{ code.usedCount }} / {{ code.maxUses ?? "無制限" }}</td>
              <td>{{ formatDate(code.expiresAt) }}</td>
              <td>{{ formatDate(code.createdAt) }}</td>
              <td class="note-cell">{{ code.note || "-" }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 空状態 -->
      <div v-else class="empty-state">
        <p>
          {{
            statusFilter === "all"
              ? "招待コードがありません"
              : `${STATUS_LABELS[statusFilter]}の招待コードがありません`
          }}
        </p>
      </div>
    </SectionCard>
  </div>
</template>

<style scoped>
.invite-code-manager {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
}

/* 作成フォーム */
.create-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--ui-space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.form-label {
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-medium);
  color: var(--ui-text);
}

.form-error {
  margin: 0;
  padding: var(--ui-space-3);
  background: var(--ui-danger-light);
  border-radius: var(--ui-radius-sm);
  color: var(--ui-danger-text);
  font-size: var(--ui-text-sm);
}

/* 作成されたコード表示 */
.created-code-section {
  margin-top: var(--ui-space-6);
  padding-top: var(--ui-space-6);
  border-top: 1px solid var(--ui-border-light);
}

.created-code-label {
  margin: 0 0 var(--ui-space-2);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-medium);
  color: var(--ui-text);
}

.created-code-display {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-4);
  background: var(--ui-success-light);
  border-radius: var(--ui-radius-md);
}

.created-code {
  flex: 1;
  font-family: var(--ui-font-mono);
  font-size: var(--ui-text-lg);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-success-text);
  word-break: break-all;
}

/* コード一覧セクション */
.codes-section {
  margin-top: var(--ui-space-2);
}

.filter-tabs {
  display: flex;
  gap: var(--ui-space-1);
}

.filter-tab {
  padding: var(--ui-space-2) var(--ui-space-3);
  background: transparent;
  border: none;
  border-radius: var(--ui-radius-sm);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-medium);
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.filter-tab:hover {
  background: var(--ui-surface-hover);
  color: var(--ui-text);
}

.filter-tab--active {
  background: var(--ui-brand-100);
  color: var(--ui-brand-700);
}

/* テーブル */
.codes-table-wrapper {
  overflow-x: auto;
  margin: 0 calc(-1 * var(--ui-space-5));
  padding: 0 var(--ui-space-5);
}

.codes-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--ui-text-sm);
}

.codes-table th,
.codes-table td {
  padding: var(--ui-space-3) var(--ui-space-4);
  text-align: left;
  border-bottom: 1px solid var(--ui-border-light);
}

.codes-table th {
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-muted);
  white-space: nowrap;
}

.codes-table td {
  color: var(--ui-text);
}

.codes-table tbody tr:hover {
  background: var(--ui-surface-hover);
}

.code-cell {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.code-value {
  font-family: var(--ui-font-mono);
  font-size: var(--ui-text-sm);
  color: var(--ui-brand-700);
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-sm);
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.copy-btn:hover {
  background: var(--ui-surface-muted);
  color: var(--ui-text);
  border-color: var(--ui-border-strong);
}

.note-cell {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--ui-text-muted);
}

/* バッジ */
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--ui-space-1) var(--ui-space-2);
  border-radius: var(--ui-radius-full);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-medium);
  white-space: nowrap;
}

.badge--success {
  background: var(--ui-success-light);
  color: var(--ui-success-text);
}

.badge--warning {
  background: var(--ui-warning-light);
  color: var(--ui-warning-text);
}

.badge--neutral {
  background: var(--ui-surface-muted);
  color: var(--ui-text-muted);
  border: 1px solid var(--ui-border);
}

.badge--danger {
  background: var(--ui-danger-light);
  color: var(--ui-danger-text);
}

/* 状態表示 */
.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: var(--ui-space-8) var(--ui-space-4);
  color: var(--ui-text-muted);
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-4);
}

/* レスポンシブ対応 */
@media (max-width: 768px) {
  .filter-tabs {
    flex-wrap: wrap;
  }

  .codes-table {
    font-size: var(--ui-text-xs);
  }

  .codes-table th,
  .codes-table td {
    padding: var(--ui-space-2) var(--ui-space-3);
  }

  .note-cell {
    max-width: 120px;
  }
}

/* Date input styling */
.date-input {
  width: 100%;
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface, #fff);
  transition: var(--ui-transition-colors);
}

.date-input:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.date-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--ui-surface-secondary, #f8f9fa);
}
</style>
