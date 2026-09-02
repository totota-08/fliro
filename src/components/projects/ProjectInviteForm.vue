<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import AppToggle from "@/components/ui/AppToggle.vue";
import { createProjectInvite } from "@/services/projectInvites";
import { useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { computed, ref } from "vue";

const logger = getLogger("app.components.projects.ProjectInviteForm");

const props = withDefaults(
  defineProps<{
    projectId: string;
    label?: string;
    projectName?: string | null;
  }>(),
  {
    label: "プロジェクト参加リンク",
    projectName: null,
  },
);

const emit = defineEmits<{
  (e: "generated", link: string): void;
}>();

const { user, profile } = useAuthStore();
const enablePassword = ref(false);
const password = ref("");
const expirySelectOptions = computed(() => [
  { label: "24時間", value: "24" },
  { label: "7日間", value: String(24 * 7) },
  { label: "30日間", value: String(24 * 30) },
  { label: "期限なし", value: "" },
]);
const expiryValue = ref(String(24 * 7));
const expiry = computed(() =>
  expiryValue.value ? Number(expiryValue.value) : null,
);
const maxUses = ref<string>("");
const generating = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const generatedLink = ref("");

async function handleGenerate() {
  if (!user.value) {
    errorMessage.value = "リンクを作成するにはログインが必要です。";
    return;
  }
  if (!props.projectId) {
    errorMessage.value = "プロジェクトIDが無効です。";
    return;
  }
  if (enablePassword.value && password.value.trim().length < 4) {
    errorMessage.value = "パスワードは4文字以上で入力してください。";
    return;
  }
  const maxUsesNumber = maxUses.value.trim()
    ? Number(maxUses.value.trim())
    : null;
  if (
    maxUsesNumber !== null &&
    (!Number.isFinite(maxUsesNumber) || maxUsesNumber < 1)
  ) {
    errorMessage.value = "利用回数は1以上の数値を入力してください。";
    return;
  }
  generating.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    const token = await createProjectInvite({
      projectId: props.projectId,
      projectName: props.projectName,
      createdBy: user.value.uid,
      createdByName: profile.value?.nickname || profile.value?.fullName || null,
      password: enablePassword.value ? password.value.trim() : null,
      expiresInHours: expiry.value ?? null,
      maxUses: maxUsesNumber,
    });
    const link =
      typeof window !== "undefined"
        ? `${window.location.origin}/invite/${token}`
        : token;
    generatedLink.value = link;
    successMessage.value =
      "共有リンクを作成しました。コピーしてメンバーに共有してください。";
    emit("generated", link);
    if (!enablePassword.value) {
      password.value = "";
    }
  } catch (error) {
    logger.error`Failed to generate invite link: ${error}`;
    errorMessage.value =
      "リンクの生成に失敗しました。時間をおいてもう一度お試しください。";
  } finally {
    generating.value = false;
  }
}

async function copyLink() {
  if (!generatedLink.value) return;
  try {
    await navigator.clipboard.writeText(generatedLink.value);
    successMessage.value = "リンクをコピーしました。";
  } catch (error) {
    logger.warn`Failed to copy link: ${error}`;
    errorMessage.value =
      "コピーに失敗しました。リンクを手動で選択してください。";
  }
}
</script>

<template>
  <div class="invite-card">
    <header>
      <h3>{{ props.label }}</h3>
      <p>
        リンクを共有するとプロジェクトへ参加できます。必要に応じてパスワードを設定してください。
      </p>
    </header>

    <div class="invite-options">
      <AppToggle v-model="enablePassword" label="パスワードを設定する" />

      <AppInput
        v-if="enablePassword"
        v-model="password"
        type="password"
        placeholder="共有用パスワード（4文字以上）"
      />

      <div class="invite-field">
        <label class="invite-label">有効期限</label>
        <AppSelect
          v-model="expiryValue"
          :options="expirySelectOptions"
          placeholder="期限を選択"
        />
      </div>

      <div class="invite-field">
        <label class="invite-label">利用回数上限（任意・未入力で無制限）</label>
        <AppInput v-model="maxUses" type="number" placeholder="例) 10" />
      </div>
    </div>

    <div class="invite-actions">
      <AppButton
        variant="primary"
        :disabled="generating"
        :loading="generating"
        @click="handleGenerate"
      >
        参加リンクを生成
      </AppButton>
    </div>

    <div v-if="generatedLink" class="invite-result">
      <label class="invite-label">共有リンク</label>
      <div class="link-box">
        <span>{{ generatedLink }}</span>
        <AppButton variant="ghost" size="sm" @click="copyLink">
          コピー
        </AppButton>
      </div>
      <p v-if="enablePassword" class="password-note">
        ※ パスワードはリンクとは別に安全な経路で共有してください。
      </p>
    </div>

    <p v-if="errorMessage" class="invite-error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="invite-message">{{ successMessage }}</p>
  </div>
</template>

<style scoped>
.invite-card {
  border: 2px dashed var(--ui-brand-100, #e5f6f8);
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-5, 1.25rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  background: var(--ui-surface, #ffffff);
}

.invite-card header h3 {
  margin: 0;
  color: var(--ui-text-strong, #0f172a);
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-bold, 700);
}

.invite-card header p {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.invite-options {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.invite-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.invite-label {
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
  font-size: var(--ui-text-sm, 0.875rem);
}

.invite-actions {
  padding-top: var(--ui-space-2, 0.5rem);
}

.invite-result {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.link-box {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  align-items: center;
  justify-content: space-between;
  background: var(--ui-surface-muted, #f1f5f9);
  font-size: var(--ui-text-sm, 0.875rem);
  word-break: break-all;
}

.password-note {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.invite-error {
  margin: 0;
  color: var(--ui-danger, #d64545);
  font-weight: var(--ui-font-semibold, 600);
  font-size: var(--ui-text-sm, 0.875rem);
}

.invite-message {
  margin: 0;
  color: var(--ui-text-strong, #0f172a);
  font-weight: var(--ui-font-semibold, 600);
  font-size: var(--ui-text-sm, 0.875rem);
}
</style>
