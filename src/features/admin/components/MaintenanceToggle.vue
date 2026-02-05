<script setup lang="ts">
/**
 * MaintenanceToggle - メンテナンスモード切替パネル
 *
 * メンテナンスモードの有効/無効トグル
 * メンテナンスメッセージの編集
 * 現在の状態をリアルタイム表示
 */
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import AppToggle from "@/components/ui/AppToggle.vue";
import AppTextarea from "@/components/ui/AppTextarea.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppModal from "@/components/ui/AppModal.vue";
import AppAlert from "@/components/ui/AppAlert.vue";
import ReauthModal from "./ReauthModal.vue";
import { updateAppConfig } from "../services/adminService";
import { subscribeToAppConfig } from "../services/appConfigService";
import type { MaintenanceConfig } from "../types/admin";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.features.admin.MaintenanceToggle");

const maintenanceConfig = ref<MaintenanceConfig | null>(null);
const loading = ref(false);
const error = ref("");
const success = ref("");
const showConfirmModal = ref(false);
const showReauthModal = ref(false);
const pendingSave = ref(false);

// ローカルフォーム状態
const form = reactive({
  enabled: false,
  message: "",
});

// 変更があるかどうか
const hasChanges = computed(() => {
  const currentConfig = maintenanceConfig.value;
  // 設定がまだ存在しない場合は、フォームに入力があれば変更ありとする
  if (!currentConfig) {
    return form.enabled || form.message.trim() !== "";
  }
  return (
    form.enabled !== currentConfig.enabled ||
    form.message !== currentConfig.message
  );
});

// 購読解除関数
let unsubscribe: (() => void) | null = null;

onMounted(() => {
  unsubscribe = subscribeToAppConfig(
    (config) => {
      maintenanceConfig.value = config;
      if (config) {
        form.enabled = config.enabled;
        form.message = config.message;
      }
    },
    () => {
      // announcement callback - not used here
    },
  );
});

onBeforeUnmount(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

// enabledが切り替わったときの処理
watch(
  () => form.enabled,
  (newValue, oldValue) => {
    // 有効化しようとしている場合のみ確認ダイアログを表示
    if (
      newValue &&
      !oldValue &&
      maintenanceConfig.value &&
      !maintenanceConfig.value.enabled
    ) {
      showConfirmModal.value = true;
    }
  },
);

function handleConfirmCancel() {
  // キャンセル時は元の状態に戻す
  form.enabled = maintenanceConfig.value?.enabled ?? false;
  showConfirmModal.value = false;
}

function handleConfirmOk() {
  showConfirmModal.value = false;
  // 再認証モーダルを表示
  showReauthModal.value = true;
  pendingSave.value = true;
}

function handleReauthCancel() {
  // 再認証キャンセル時は元の状態に戻す
  form.enabled = maintenanceConfig.value?.enabled ?? false;
  showReauthModal.value = false;
  pendingSave.value = false;
}

async function handleReauthSuccess() {
  showReauthModal.value = false;
  if (pendingSave.value) {
    pendingSave.value = false;
    await performSave();
  }
}

async function handleSave() {
  if (loading.value) return;

  const trimmedMessage = form.message.trim();
  if (form.enabled && !trimmedMessage) {
    error.value = "メンテナンスメッセージを入力してください。";
    return;
  }

  // メンテナンスモードを有効化する場合は再認証が必要
  const isEnabling = form.enabled && !maintenanceConfig.value?.enabled;
  if (isEnabling) {
    showReauthModal.value = true;
    pendingSave.value = true;
    return;
  }

  await performSave();
}

async function performSave() {
  if (loading.value) return;

  loading.value = true;
  error.value = "";
  success.value = "";

  try {
    const trimmedMessage = form.message.trim();

    const result = await updateAppConfig("maintenance", {
      enabled: form.enabled,
      message: trimmedMessage,
    });

    if (result.success) {
      success.value = "メンテナンス設定を保存しました。";
      setTimeout(() => {
        success.value = "";
      }, 3000);
    } else {
      error.value = result.error || "保存に失敗しました。";
    }
  } catch (err) {
    logger.error`Failed to save maintenance config: ${err}`;
    error.value = "保存中にエラーが発生しました。";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="maintenance-toggle">
    <header class="maintenance-toggle__header">
      <h3 class="maintenance-toggle__title">メンテナンスモード</h3>
      <p class="maintenance-toggle__description">
        メンテナンスモードを有効にすると、管理者以外のユーザーはアプリにアクセスできなくなります。
      </p>
    </header>

    <div class="maintenance-toggle__content">
      <AppAlert v-if="error" variant="danger" dismissible @dismiss="error = ''">
        {{ error }}
      </AppAlert>

      <AppAlert
        v-if="success"
        variant="success"
        dismissible
        @dismiss="success = ''"
      >
        {{ success }}
      </AppAlert>

      <!-- 現在のステータス表示 -->
      <div class="maintenance-toggle__status">
        <span class="maintenance-toggle__status-label">現在の状態:</span>
        <span
          :class="[
            'maintenance-toggle__status-badge',
            maintenanceConfig?.enabled
              ? 'maintenance-toggle__status-badge--active'
              : 'maintenance-toggle__status-badge--inactive',
          ]"
        >
          {{ maintenanceConfig?.enabled ? "メンテナンス中" : "通常稼働" }}
        </span>
      </div>

      <!-- トグルスイッチ -->
      <div class="maintenance-toggle__field">
        <AppToggle
          v-model="form.enabled"
          label="メンテナンスモードを有効にする"
          description="有効にすると一般ユーザーはアクセスできなくなります"
        />
      </div>

      <!-- メッセージ入力 -->
      <div class="maintenance-toggle__field">
        <label
          class="maintenance-toggle__field-label"
          for="maintenance-message"
        >
          メンテナンスメッセージ
        </label>
        <AppTextarea
          id="maintenance-message"
          v-model="form.message"
          placeholder="例: 現在メンテナンス中です。しばらくお待ちください。"
          :rows="4"
        />
        <p class="maintenance-toggle__field-hint">
          ユーザーに表示されるメッセージを入力してください。
        </p>
      </div>

      <!-- 保存ボタン -->
      <div class="maintenance-toggle__actions">
        <AppButton
          variant="primary"
          :disabled="!hasChanges || loading"
          :loading="loading"
          @click="handleSave"
        >
          保存する
        </AppButton>
      </div>
    </div>

    <!-- 有効化確認モーダル -->
    <AppModal
      :open="showConfirmModal"
      title="メンテナンスモードの有効化"
      size="sm"
      @close="handleConfirmCancel"
    >
      <div class="confirm-modal__content">
        <AppAlert variant="warning">
          メンテナンスモードを有効にすると、管理者以外のユーザーはアプリにアクセスできなくなります。
          本当に有効にしますか?
        </AppAlert>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="handleConfirmCancel">
          キャンセル
        </AppButton>
        <AppButton variant="danger" @click="handleConfirmOk">
          有効にする
        </AppButton>
      </template>
    </AppModal>

    <!-- 再認証モーダル -->
    <ReauthModal
      :open="showReauthModal"
      title="重要な操作の確認"
      description="メンテナンスモードを有効化するには、セキュリティのため再認証が必要です。"
      @close="handleReauthCancel"
      @success="handleReauthSuccess"
    />
  </div>
</template>

<style scoped>
.maintenance-toggle {
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  overflow: hidden;
}

.maintenance-toggle__header {
  padding: var(--ui-space-5, 1.25rem) var(--ui-space-6, 1.5rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface-muted, #f1f5f9);
}

.maintenance-toggle__title {
  margin: 0 0 var(--ui-space-1, 0.25rem);
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.maintenance-toggle__description {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-normal, 1.5);
}

.maintenance-toggle__content {
  padding: var(--ui-space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
}

.maintenance-toggle__status {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.maintenance-toggle__status-label {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.maintenance-toggle__status-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
}

.maintenance-toggle__status-badge--active {
  background: var(--ui-danger-light, #fee2e2);
  color: var(--ui-danger-text, #991b1b);
}

.maintenance-toggle__status-badge--inactive {
  background: var(--ui-success-light, #dcfce7);
  color: var(--ui-success-text, #166534);
}

.maintenance-toggle__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.maintenance-toggle__field-label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.maintenance-toggle__field-hint {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.maintenance-toggle__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.confirm-modal__content {
  margin-bottom: var(--ui-space-4, 1rem);
}

@media (max-width: 640px) {
  .maintenance-toggle__header {
    padding: var(--ui-space-4, 1rem);
  }

  .maintenance-toggle__content {
    padding: var(--ui-space-4, 1rem);
  }
}
</style>
