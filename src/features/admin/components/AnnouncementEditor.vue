<script setup lang="ts">
/**
 * AnnouncementEditor - 通知エディタパネル
 *
 * 通知の有効/無効トグル
 * 通知メッセージ入力
 * 通知タイプ選択（info/warning/danger）
 * リンク追加（オプション）
 * 閉じるボタン表示の有無
 * プレビュー表示
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import AppToggle from "@/components/ui/AppToggle.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppTextarea from "@/components/ui/AppTextarea.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppAlert from "@/components/ui/AppAlert.vue";
import AppAnnouncementBanner from "@/components/common/AppAnnouncementBanner.vue";
import { updateAppConfig } from "../services/adminService";
import { subscribeToAppConfig } from "../services/appConfigService";
import type { AnnouncementConfig } from "../types/admin";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.features.admin.AnnouncementEditor");

const announcementConfig = ref<AnnouncementConfig | null>(null);
const loading = ref(false);
const error = ref("");
const success = ref("");

// ローカルフォーム状態
const form = reactive({
  enabled: false,
  message: "",
  type: "info" as "info" | "warning" | "danger",
  link: "",
  linkText: "",
  dismissible: true,
});

// タイプ選択肢
const typeOptions = [
  { value: "info", label: "お知らせ（青）" },
  { value: "warning", label: "警告（黄）" },
  { value: "danger", label: "緊急（赤）" },
];

// 変更があるかどうか
const hasChanges = computed(() => {
  if (!announcementConfig.value) return form.enabled || form.message;
  return (
    form.enabled !== announcementConfig.value.enabled ||
    form.message !== announcementConfig.value.message ||
    form.type !== announcementConfig.value.type ||
    form.link !== (announcementConfig.value.link || "") ||
    form.linkText !== (announcementConfig.value.linkText || "") ||
    form.dismissible !== announcementConfig.value.dismissible
  );
});

// プレビュー表示するかどうか
const showPreview = computed(() => {
  return form.message.trim().length > 0;
});

// 購読解除関数
let unsubscribe: (() => void) | null = null;

onMounted(() => {
  unsubscribe = subscribeToAppConfig(
    () => {
      // maintenance callback - not used here
    },
    (config) => {
      announcementConfig.value = config;
      if (config) {
        form.enabled = config.enabled;
        form.message = config.message;
        form.type = config.type;
        form.link = config.link || "";
        form.linkText = config.linkText || "";
        form.dismissible = config.dismissible;
      }
    },
  );
});

onBeforeUnmount(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

async function handleSave() {
  if (loading.value) return;

  loading.value = true;
  error.value = "";
  success.value = "";

  try {
    const trimmedMessage = form.message.trim();
    if (form.enabled && !trimmedMessage) {
      error.value = "通知メッセージを入力してください。";
      loading.value = false;
      return;
    }

    const config: Partial<AnnouncementConfig> = {
      enabled: form.enabled,
      message: trimmedMessage,
      type: form.type,
      dismissible: form.dismissible,
    };

    // リンクが設定されている場合のみ追加
    const trimmedLink = form.link.trim();
    if (trimmedLink) {
      config.link = trimmedLink;
      config.linkText = form.linkText.trim() || undefined;
    }

    const result = await updateAppConfig("announcement", config);

    if (result.success) {
      success.value = "通知設定を保存しました。";
      setTimeout(() => {
        success.value = "";
      }, 3000);
    } else {
      error.value = result.error || "保存に失敗しました。";
    }
  } catch (err) {
    logger.error`Failed to save announcement config: ${err}`;
    error.value = "保存中にエラーが発生しました。";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="announcement-editor">
    <header class="announcement-editor__header">
      <h3 class="announcement-editor__title">お知らせバナー</h3>
      <p class="announcement-editor__description">
        アプリ上部に表示される通知バナーを設定します。メンテナンス予告やお知らせに利用できます。
      </p>
    </header>

    <div class="announcement-editor__content">
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
      <div class="announcement-editor__status">
        <span class="announcement-editor__status-label">現在の状態:</span>
        <span
          :class="[
            'announcement-editor__status-badge',
            announcementConfig?.enabled
              ? 'announcement-editor__status-badge--active'
              : 'announcement-editor__status-badge--inactive',
          ]"
        >
          {{ announcementConfig?.enabled ? "表示中" : "非表示" }}
        </span>
      </div>

      <!-- トグルスイッチ -->
      <div class="announcement-editor__field">
        <AppToggle
          v-model="form.enabled"
          label="お知らせバナーを有効にする"
          description="有効にするとアプリ上部にバナーが表示されます"
        />
      </div>

      <!-- メッセージ入力 -->
      <div class="announcement-editor__field">
        <label
          class="announcement-editor__field-label"
          for="announcement-message"
        >
          メッセージ <span class="announcement-editor__required">*</span>
        </label>
        <AppTextarea
          id="announcement-message"
          v-model="form.message"
          placeholder="例: 本日 22:00 より定期メンテナンスを実施いたします。"
          :rows="3"
        />
      </div>

      <!-- タイプ選択 -->
      <div class="announcement-editor__field">
        <label class="announcement-editor__field-label" for="announcement-type">
          通知タイプ
        </label>
        <AppSelect
          id="announcement-type"
          v-model="form.type"
          :options="typeOptions"
        />
        <p class="announcement-editor__field-hint">
          タイプに応じてバナーの色が変わります。
        </p>
      </div>

      <!-- リンク（オプション） -->
      <div class="announcement-editor__field-group">
        <div class="announcement-editor__field">
          <label
            class="announcement-editor__field-label"
            for="announcement-link"
          >
            リンクURL（オプション）
          </label>
          <AppInput
            id="announcement-link"
            v-model="form.link"
            type="url"
            placeholder="https://example.com/info"
          />
        </div>

        <div class="announcement-editor__field">
          <label
            class="announcement-editor__field-label"
            for="announcement-link-text"
          >
            リンクテキスト
          </label>
          <AppInput
            id="announcement-link-text"
            v-model="form.linkText"
            placeholder="詳細はこちら"
            :disabled="!form.link"
          />
        </div>
      </div>

      <!-- 閉じるボタン -->
      <div class="announcement-editor__field">
        <AppToggle
          v-model="form.dismissible"
          label="閉じるボタンを表示"
          description="ユーザーがバナーを閉じられるようにします"
        />
      </div>

      <!-- プレビュー -->
      <div v-if="showPreview" class="announcement-editor__preview">
        <label class="announcement-editor__field-label">プレビュー</label>
        <div class="announcement-editor__preview-box">
          <AppAnnouncementBanner
            :message="form.message"
            :type="form.type"
            :link="form.link || undefined"
            :link-text="form.linkText || undefined"
            :dismissible="form.dismissible"
          />
        </div>
      </div>

      <!-- 保存ボタン -->
      <div class="announcement-editor__actions">
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
  </div>
</template>

<style scoped>
.announcement-editor {
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  overflow: hidden;
}

.announcement-editor__header {
  padding: var(--ui-space-5, 1.25rem) var(--ui-space-6, 1.5rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface-muted, #f1f5f9);
}

.announcement-editor__title {
  margin: 0 0 var(--ui-space-1, 0.25rem);
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.announcement-editor__description {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-normal, 1.5);
}

.announcement-editor__content {
  padding: var(--ui-space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
}

.announcement-editor__status {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.announcement-editor__status-label {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.announcement-editor__status-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
}

.announcement-editor__status-badge--active {
  background: var(--ui-info-light, #e0f2fe);
  color: #0c4a6e;
}

.announcement-editor__status-badge--inactive {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
}

.announcement-editor__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.announcement-editor__field-group {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--ui-space-4, 1rem);
}

.announcement-editor__field-label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.announcement-editor__required {
  color: var(--ui-danger, #d64545);
}

.announcement-editor__field-hint {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.announcement-editor__preview {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.announcement-editor__preview-box {
  border: 1px dashed var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  overflow: hidden;
}

.announcement-editor__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

@media (max-width: 640px) {
  .announcement-editor__header {
    padding: var(--ui-space-4, 1rem);
  }

  .announcement-editor__content {
    padding: var(--ui-space-4, 1rem);
  }

  .announcement-editor__field-group {
    grid-template-columns: 1fr;
  }
}
</style>
