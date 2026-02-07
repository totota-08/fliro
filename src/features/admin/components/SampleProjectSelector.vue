<script setup lang="ts">
/**
 * SampleProjectSelector - LPのサンプルプロジェクト選択パネル
 *
 * ランディングページの「サンプルを見る」ボタンのリンク先を設定
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppAlert from "@/components/ui/AppAlert.vue";
import { updateAppConfig } from "../services/adminService";
import { subscribeToSampleProject } from "../services/appConfigService";
import type { SampleProjectConfig } from "../types/admin";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.features.admin.SampleProjectSelector");

const sampleProjectConfig = ref<SampleProjectConfig | null>(null);
const loading = ref(false);
const error = ref("");
const success = ref("");

// ローカルフォーム状態
const form = reactive({
  projectId: "",
  projectName: "",
});

// 変更があるかどうか
const hasChanges = computed(() => {
  const currentConfig = sampleProjectConfig.value;
  if (!currentConfig) {
    return form.projectId.trim() !== "";
  }
  return (
    form.projectId.trim() !== currentConfig.projectId ||
    form.projectName.trim() !== currentConfig.projectName
  );
});

// 購読解除関数
let unsubscribe: (() => void) | null = null;

onMounted(() => {
  unsubscribe = subscribeToSampleProject((config) => {
    sampleProjectConfig.value = config;
    if (config) {
      form.projectId = config.projectId;
      form.projectName = config.projectName;
    }
  });
});

onBeforeUnmount(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

async function handleSave() {
  if (loading.value) return;

  const trimmedProjectId = form.projectId.trim();
  if (!trimmedProjectId) {
    error.value = "プロジェクトIDを入力してください。";
    return;
  }

  loading.value = true;
  error.value = "";
  success.value = "";

  try {
    const result = await updateAppConfig("sampleProject", {
      projectId: trimmedProjectId,
      projectName: form.projectName.trim(),
    });

    if (result.success) {
      success.value = "サンプルプロジェクト設定を保存しました。";
      setTimeout(() => {
        success.value = "";
      }, 3000);
    } else {
      error.value = result.error || "保存に失敗しました。";
    }
  } catch (err) {
    logger.error`Failed to save sample project config: ${err}`;
    error.value = "保存中にエラーが発生しました。";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="sample-project-selector">
    <header class="sample-project-selector__header">
      <h3 class="sample-project-selector__title">サンプルプロジェクト</h3>
      <p class="sample-project-selector__description">
        ランディングページの「サンプルを見る」ボタンから遷移するプロジェクトを設定します。
      </p>
    </header>

    <div class="sample-project-selector__content">
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

      <!-- 現在の設定表示 -->
      <div v-if="sampleProjectConfig" class="sample-project-selector__current">
        <span class="sample-project-selector__current-label">現在の設定:</span>
        <code class="sample-project-selector__current-value">
          {{ sampleProjectConfig.projectId }}
        </code>
        <span
          v-if="sampleProjectConfig.projectName"
          class="sample-project-selector__current-name"
        >
          ({{ sampleProjectConfig.projectName }})
        </span>
      </div>
      <div v-else class="sample-project-selector__current">
        <span class="sample-project-selector__current-label">現在の設定:</span>
        <span class="sample-project-selector__current-none">未設定</span>
      </div>

      <!-- プロジェクトID入力 -->
      <div class="sample-project-selector__field">
        <label class="sample-project-selector__field-label" for="project-id">
          プロジェクトID
        </label>
        <AppInput
          id="project-id"
          v-model="form.projectId"
          placeholder="例: Tk6b6Kelr8O3XUS8BqCq"
        />
        <p class="sample-project-selector__field-hint">
          FirestoreのプロジェクトドキュメントIDを入力してください。
        </p>
      </div>

      <!-- プロジェクト名（メモ用） -->
      <div class="sample-project-selector__field">
        <label class="sample-project-selector__field-label" for="project-name">
          プロジェクト名（メモ用）
        </label>
        <AppInput
          id="project-name"
          v-model="form.projectName"
          placeholder="例: サンプルプロジェクト"
        />
        <p class="sample-project-selector__field-hint">
          管理用のメモです。実際の表示には使用されません。
        </p>
      </div>

      <!-- 保存ボタン -->
      <div class="sample-project-selector__actions">
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
.sample-project-selector {
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  overflow: hidden;
}

.sample-project-selector__header {
  padding: var(--ui-space-5, 1.25rem) var(--ui-space-6, 1.5rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface-muted, #f1f5f9);
}

.sample-project-selector__title {
  margin: 0 0 var(--ui-space-1, 0.25rem);
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.sample-project-selector__description {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-normal, 1.5);
}

.sample-project-selector__content {
  padding: var(--ui-space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
}

.sample-project-selector__current {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  flex-wrap: wrap;
}

.sample-project-selector__current-label {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.sample-project-selector__current-value {
  font-family: var(--ui-font-mono, ui-monospace, monospace);
  font-size: var(--ui-text-sm, 0.875rem);
  background: var(--ui-surface-muted, #f1f5f9);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-sm, 0.375rem);
  color: var(--ui-brand-600, #4f7c82);
}

.sample-project-selector__current-name {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.sample-project-selector__current-none {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-placeholder, #94a3b8);
  font-style: italic;
}

.sample-project-selector__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.sample-project-selector__field-label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.sample-project-selector__field-hint {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.sample-project-selector__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

@media (max-width: 640px) {
  .sample-project-selector__header {
    padding: var(--ui-space-4, 1rem);
  }

  .sample-project-selector__content {
    padding: var(--ui-space-4, 1rem);
  }
}
</style>
