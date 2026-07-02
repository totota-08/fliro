<script setup lang="ts">
import AvatarCropperModal from "@/components/modals/AvatarCropperModal.vue";
import AppAlert from "@/components/ui/AppAlert.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppColorPicker from "@/components/ui/AppColorPicker.vue";
import AppField from "@/components/ui/AppField.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppTextarea from "@/components/ui/AppTextarea.vue";
import AppToggle from "@/components/ui/AppToggle.vue";
import DatePicker from "@/components/ui/DatePicker.vue";
import { appName } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import { createProject } from "@/firebase/projectService";
import { fetchScaleStats, type ScaleStats } from "@/services/statsService";
import { useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const logger = getLogger("app.pages.projects.CreateProject");

const router = useRouter();
const { user } = useAuthStore();

const name = ref("");
const description = ref("");
const color = ref("#4f7c82");
const isPublic = ref(false);
const allowGuestView = ref(false);
const startDate = ref<string | null>(null);
const dueDate = ref<string | null>(null);
const submitting = ref(false);
const errorMsg = ref("");

// アイコンアップロード
const MAX_ICON_SIZE = 5 * 1024 * 1024; // Storage ルールの 5MB 制限に合わせる
const iconFile = ref<File | null>(null);
const iconPreviewUrl = ref("");
const iconError = ref("");
const cropperOpen = ref(false);
const pendingImageFile = ref<File | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

function openIconPicker() {
  fileInputRef.value?.click();
}

function handleIconSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    iconError.value = "画像ファイルを選択してください。";
    return;
  }
  if (file.size > MAX_ICON_SIZE) {
    iconError.value = "画像サイズは5MB以下にしてください。";
    return;
  }

  iconError.value = "";
  pendingImageFile.value = file;
  cropperOpen.value = true;
}

function handleCropConfirm(file: File) {
  iconFile.value = file;
  if (iconPreviewUrl.value) URL.revokeObjectURL(iconPreviewUrl.value);
  iconPreviewUrl.value = URL.createObjectURL(file);
  cropperOpen.value = false;
  pendingImageFile.value = null;
}

function handleCropClose() {
  cropperOpen.value = false;
  pendingImageFile.value = null;
}

function removeIcon() {
  iconFile.value = null;
  if (iconPreviewUrl.value) {
    URL.revokeObjectURL(iconPreviewUrl.value);
    iconPreviewUrl.value = "";
  }
}

onBeforeUnmount(() => {
  if (iconPreviewUrl.value) URL.revokeObjectURL(iconPreviewUrl.value);
});

const presetColors = ["#4f7c82", "#0b2e33", "#93b1b5", "#b8e3e9"];

type CreateStep = "basic" | "appearance" | "settings";
const stepOrder: CreateStep[] = ["basic", "appearance", "settings"];
const stepLabels: Record<CreateStep, string> = {
  basic: "基本情報",
  appearance: "見た目",
  settings: "詳細設定",
};
const stepDescriptions: Record<CreateStep, string> = {
  basic: "プロジェクトの名前と目的を入力してください。",
  appearance: "アイコンとテーマカラーでプロジェクトを識別しやすくします。",
  settings: "公開範囲を選び、内容を確認して作成します。",
};

const currentStep = ref<CreateStep>("basic");
const currentStepIndex = computed(() =>
  Math.max(stepOrder.indexOf(currentStep.value), 0),
);
const progressPercent = computed(
  () => ((currentStepIndex.value + 1) / stepOrder.length) * 100,
);
const basicValid = computed(() => name.value.trim().length > 0);
const displayName = computed(() => name.value.trim() || "新しいプロジェクト");
const scaleStats = ref<ScaleStats | null>(null);

const scheduleSummary = computed(() => {
  if (!startDate.value && !dueDate.value) return "未設定";
  const format = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "未定";
  return `${format(startDate.value)} 〜 ${format(dueDate.value)}`;
});

const visibilitySummary = computed(() => {
  const parts = [isPublic.value ? "公開" : "非公開"];
  if (allowGuestView.value) parts.push("ゲスト閲覧可");
  return parts.join(" / ");
});

onMounted(async () => {
  try {
    scaleStats.value = await fetchScaleStats();
  } catch (error) {
    logger.warn`Failed to fetch stats: ${error}`;
  }
});

async function handleSubmit() {
  if (!user.value) {
    errorMsg.value = "ログインが必要です。";
    return;
  }

  if (!name.value.trim()) {
    errorMsg.value = "プロジェクト名は必須です。";
    return;
  }

  submitting.value = true;
  errorMsg.value = "";
  try {
    const id = await createProject(
      {
        name: name.value,
        description: description.value,
        color: color.value,
        startDate: startDate.value,
        dueDate: dueDate.value,
        isPublic: isPublic.value,
        allowGuestView: allowGuestView.value,
      },
      user.value.uid,
      { iconFile: iconFile.value },
    );

    await router.push({
      name: ROUTE_NAMES.projectDashboard,
      params: { projectId: id },
    });
  } catch (e) {
    logger.error`Failed to create project: ${e}`;
    errorMsg.value = "プロジェクトの作成に失敗しました。再度お試しください。";
  } finally {
    submitting.value = false;
  }
}

function goToStep(step: CreateStep) {
  const targetIndex = stepOrder.indexOf(step);
  // 未入力のまま先のステップへ飛ばないよう、進む方向は基本情報の入力を必須にする
  if (targetIndex > currentStepIndex.value && !basicValid.value) return;
  currentStep.value = step;
}

function nextStep() {
  const next = stepOrder[currentStepIndex.value + 1];
  if (!next) return;
  if (currentStep.value === "basic" && !basicValid.value) return;
  currentStep.value = next;
}

function prevStep() {
  const prev = stepOrder[currentStepIndex.value - 1];
  if (!prev) return;
  currentStep.value = prev;
}
</script>

<template>
  <div class="project-shell">
    <div class="project-shell__inner">
      <section class="project-hero">
        <p class="hero-eyebrow">{{ appName }} Projects</p>
        <h1>新しいプロジェクトを始めよう</h1>
        <p class="hero-description">
          チームの目標を達成するためのプロジェクトを作成し、タスク管理やメンバー間のコラボレーションを始めましょう。
        </p>
        <ul v-if="scaleStats" class="hero-stats">
          <li>
            <strong>{{ scaleStats.users.toLocaleString() }}</strong>
            <span>ユーザー</span>
          </li>
          <li>
            <strong>{{ scaleStats.projects.toLocaleString() }}</strong>
            <span>プロジェクト</span>
          </li>
          <li>
            <strong>{{ scaleStats.tasks.toLocaleString() }}</strong>
            <span>タスク</span>
          </li>
        </ul>
        <ul class="hero-features">
          <li>
            <strong>タスク管理</strong>
            <span>チームのタスクを可視化し、進捗を追跡</span>
          </li>
          <li>
            <strong>リアルタイムチャット</strong>
            <span>プロジェクト内でメンバーと即座にコミュニケーション</span>
          </li>
          <li>
            <strong>アクティビティログ</strong>
            <span>プロジェクトの活動履歴を一目で把握</span>
          </li>
        </ul>
      </section>

      <section class="project-panel">
        <nav class="stepper" aria-label="作成ステップ">
          <ol class="stepper__list">
            <li
              v-for="(step, index) in stepOrder"
              :key="step"
              class="stepper__item"
            >
              <button
                type="button"
                class="stepper__button"
                :class="{
                  'is-current': step === currentStep,
                  'is-done': index < currentStepIndex,
                }"
                :aria-current="step === currentStep ? 'step' : undefined"
                :disabled="index > currentStepIndex && !basicValid"
                @click="goToStep(step)"
              >
                <span class="stepper__index" aria-hidden="true">
                  <svg
                    v-if="index < currentStepIndex"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M3 8L7 12L13 4"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <template v-else>{{ index + 1 }}</template>
                </span>
                <span class="stepper__label">{{ stepLabels[step] }}</span>
              </button>
              <span
                v-if="index < stepOrder.length - 1"
                class="stepper__connector"
                :class="{ 'is-done': index < currentStepIndex }"
                aria-hidden="true"
              />
            </li>
          </ol>
          <div
            class="stepper__progress"
            role="progressbar"
            :aria-valuenow="currentStepIndex + 1"
            aria-valuemin="1"
            :aria-valuemax="stepOrder.length"
            :aria-valuetext="`ステップ ${currentStepIndex + 1} / ${stepOrder.length}`"
          >
            <div
              class="stepper__progress-value"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
        </nav>

        <header class="panel-header">
          <h2>{{ stepLabels[currentStep] }}</h2>
          <p>{{ stepDescriptions[currentStep] }}</p>
        </header>

        <Transition name="slide-fade" mode="out-in">
          <div :key="currentStep" class="panel-body">
            <div v-if="currentStep === 'basic'" class="panel-section">
              <AppField label="プロジェクト名" required>
                <AppInput
                  v-model="name"
                  placeholder="例）Webサイトリニューアル"
                />
              </AppField>

              <AppField
                label="プロジェクト説明"
                hint="プロジェクトの目的やゴール、主要タスクなどを記載してください（任意）。"
              >
                <AppTextarea
                  v-model="description"
                  :rows="6"
                  placeholder="例）自社サイトを刷新し、問い合わせ数を2倍にする"
                />
              </AppField>
            </div>

            <div v-else-if="currentStep === 'appearance'" class="panel-section">
              <AppField
                label="プロジェクトアイコン"
                hint="サイドバーやプロジェクト一覧に表示されます（5MBまでの画像、任意）。"
                :error="iconError || undefined"
              >
                <div class="icon-uploader">
                  <div class="icon-uploader__preview" aria-hidden="true">
                    <img
                      v-if="iconPreviewUrl"
                      :src="iconPreviewUrl"
                      alt=""
                      class="icon-uploader__image"
                    />
                    <span
                      v-else
                      class="icon-uploader__fallback"
                      :style="{ backgroundColor: color }"
                    >
                      {{ displayName.charAt(0) }}
                    </span>
                  </div>
                  <div class="icon-uploader__actions">
                    <AppButton
                      variant="outline"
                      size="sm"
                      @click="openIconPicker"
                    >
                      {{ iconPreviewUrl ? "画像を変更" : "画像を選択" }}
                    </AppButton>
                    <AppButton
                      v-if="iconPreviewUrl"
                      variant="ghost"
                      size="sm"
                      @click="removeIcon"
                    >
                      削除
                    </AppButton>
                  </div>
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept="image/*"
                    class="icon-uploader__input"
                    aria-label="プロジェクトアイコンを選択"
                    @change="handleIconSelect"
                  />
                </div>
              </AppField>

              <AppField
                label="テーマカラー"
                :hint="`${appName} のブランドカラーから選ぶか、カスタムで細かく調整できます。`"
              >
                <AppColorPicker v-model="color" :preset-colors="presetColors" />
              </AppField>

              <div class="appearance-preview" aria-hidden="true">
                <p class="appearance-preview__caption">表示イメージ</p>
                <div
                  class="appearance-preview__item"
                  :style="{ borderLeftColor: color }"
                >
                  <img
                    v-if="iconPreviewUrl"
                    :src="iconPreviewUrl"
                    alt=""
                    class="appearance-preview__icon"
                  />
                  <span
                    v-else
                    class="appearance-preview__dot"
                    :style="{ backgroundColor: color }"
                  />
                  <span class="appearance-preview__name">
                    {{ displayName }}
                  </span>
                </div>
              </div>

              <AppField
                label="スケジュール"
                hint="期限はいつでも更新できます。未定の場合は空欄のままでも構いません。"
              >
                <div class="date-grid">
                  <label class="date-field">
                    <span class="date-field__label">開始日</span>
                    <DatePicker
                      v-model="startDate"
                      placeholder="開始日を選択"
                    />
                  </label>
                  <label class="date-field">
                    <span class="date-field__label">期限</span>
                    <DatePicker v-model="dueDate" placeholder="期限を選択" />
                  </label>
                </div>
              </AppField>
            </div>

            <div v-else class="panel-section">
              <AppToggle
                v-model="isPublic"
                label="公開プロジェクト"
                description="ワークスペースの全メンバーが閲覧できる状態にします。"
              />

              <AppToggle
                v-model="allowGuestView"
                label="ゲスト閲覧を許可"
                description="リンクを共有されたゲストにも読み取り専用で公開します。"
              />

              <AppAlert variant="info" title="参加リンクについて">
                プロジェクト作成後、メンバー管理ページから参加リンクを生成し、チームに共有できます。
              </AppAlert>

              <div class="summary">
                <p class="summary__title">作成内容の確認</p>
                <dl class="summary__list">
                  <div class="summary__row">
                    <dt>プロジェクト名</dt>
                    <dd>
                      <span class="summary__project">
                        <img
                          v-if="iconPreviewUrl"
                          :src="iconPreviewUrl"
                          alt=""
                          class="summary__icon"
                        />
                        <span
                          v-else
                          class="summary__dot"
                          :style="{ backgroundColor: color }"
                          aria-hidden="true"
                        />
                        {{ displayName }}
                      </span>
                    </dd>
                  </div>
                  <div class="summary__row">
                    <dt>スケジュール</dt>
                    <dd>{{ scheduleSummary }}</dd>
                  </div>
                  <div class="summary__row">
                    <dt>公開設定</dt>
                    <dd>{{ visibilitySummary }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </Transition>

        <AppAlert v-if="errorMsg" variant="danger" class="panel-alert">
          {{ errorMsg }}
        </AppAlert>

        <div class="panel-actions">
          <AppButton
            v-if="currentStepIndex > 0"
            variant="ghost"
            @click="prevStep"
          >
            戻る
          </AppButton>
          <span v-else aria-hidden="true" />
          <AppButton
            v-if="currentStepIndex < stepOrder.length - 1"
            variant="primary"
            :disabled="currentStep === 'basic' && !basicValid"
            @click="nextStep"
          >
            次へ進む
          </AppButton>
          <AppButton
            v-else
            type="button"
            variant="primary"
            :loading="submitting"
            :disabled="submitting || !basicValid"
            @click="handleSubmit"
          >
            プロジェクトを作成
          </AppButton>
        </div>
      </section>
    </div>

    <AvatarCropperModal
      :open="cropperOpen"
      :image-file="pendingImageFile"
      @close="handleCropClose"
      @confirm="handleCropConfirm"
    />
  </div>
</template>

<style scoped>
.project-shell {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  background: linear-gradient(
    135deg,
    var(--ui-brand-100, #e5f6f8),
    var(--ui-bg, #f5fcff) 40%,
    var(--ui-brand-100, #e5f6f8)
  );
}

@supports (min-height: 100dvh) {
  .project-shell {
    min-height: 100dvh;
  }
}

.project-shell__inner {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  max-width: 960px;
  width: 100%;
}

.project-hero {
  padding: var(--ui-space-10, 2.5rem) var(--ui-space-8, 2rem);
  background: var(--ui-hero-gradient);
  color: var(--ui-text-inverse, #ffffff);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
}

.hero-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-brand-200, #b8e3e9);
}

.project-hero h1 {
  font-size: clamp(2rem, 3vw, 3rem);
  margin: 0;
}

.project-hero p {
  margin: 0;
  line-height: 1.7;
  color: var(--ui-brand-100, #e5f6f8);
}

.hero-description {
  font-size: var(--ui-text-base, 1rem);
  line-height: 1.7;
  color: var(--ui-brand-100, #e5f6f8);
  max-width: 380px;
}

.hero-stats {
  list-style: none;
  margin: var(--ui-space-2, 0.5rem) 0 0;
  padding: 0;
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  flex-wrap: wrap;
}

.hero-stats li {
  background: var(--ui-surface-glass-12);
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  min-width: 80px;
}

.hero-stats strong {
  font-size: var(--ui-text-2xl, 1.5rem);
  color: var(--ui-text-inverse, #ffffff);
}

.hero-stats span {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-surface-glass-70);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hero-features {
  list-style: none;
  margin: var(--ui-space-2, 0.5rem) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.hero-features li {
  background: var(--ui-surface-glass-08);
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.hero-features strong {
  font-size: var(--ui-text-base, 1rem);
  color: var(--ui-text-inverse, #ffffff);
}

.hero-features span {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-surface-glass);
}

.project-panel {
  background: var(--ui-surface-glass, rgba(255, 255, 255, 0.8));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  margin: var(--ui-space-8, 2rem);
  border-radius: var(--ui-radius-2xl, 1.5rem);
  padding: var(--ui-space-8, 2rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-xl);
  display: flex;
  flex-direction: column;
}

@supports not (backdrop-filter: blur(12px)) {
  .project-panel {
    background: var(--ui-surface, #ffffff);
  }
}

.stepper {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.stepper__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
}

.stepper__item {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  flex: 1;
  min-width: 0;
}

.stepper__item:last-child {
  flex: 0 0 auto;
}

.stepper__button {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  border: none;
  background: transparent;
  padding: var(--ui-space-1, 0.25rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  cursor: pointer;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  transition: var(--ui-transition-colors);
}

.stepper__button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.stepper__button:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.stepper__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-bold, 700);
  flex-shrink: 0;
  transition: var(--ui-transition-colors);
}

.stepper__index svg {
  width: 0.875rem;
  height: 0.875rem;
}

.stepper__button.is-current {
  color: var(--ui-brand-900, #0b2e33);
}

.stepper__button.is-current .stepper__index {
  background: var(--ui-brand-600, #4f7c82);
  color: var(--ui-text-inverse, #ffffff);
}

.stepper__button.is-done {
  color: var(--ui-brand-600, #4f7c82);
}

.stepper__button.is-done .stepper__index {
  background: var(--ui-brand-200, #b8e3e9);
  color: var(--ui-brand-900, #0b2e33);
}

.stepper__connector {
  flex: 1;
  height: 2px;
  min-width: var(--ui-space-3, 0.75rem);
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-full, 9999px);
}

.stepper__connector.is-done {
  background: var(--ui-brand-400, #7ec3cc);
}

.stepper__progress {
  height: 4px;
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-full, 9999px);
  overflow: hidden;
}

.stepper__progress-value {
  height: 100%;
  background: var(--ui-brand-600, #4f7c82);
  transition: width var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.panel-header {
  margin: var(--ui-space-5, 1.25rem) 0;
}

.panel-header h2 {
  margin: 0;
  color: var(--ui-brand-900, #0b2e33);
  font-size: var(--ui-text-xl, 1.25rem);
}

.panel-header p {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.panel-body {
  flex: 1;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
}

.icon-uploader {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
}

.icon-uploader__preview {
  width: 64px;
  height: 64px;
  border-radius: var(--ui-radius-lg, 1rem);
  overflow: hidden;
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  flex-shrink: 0;
}

.icon-uploader__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-uploader__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--ui-text-inverse, #ffffff);
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-bold, 700);
}

.icon-uploader__actions {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  flex-wrap: wrap;
}

.icon-uploader__input {
  display: none;
}

.appearance-preview {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.appearance-preview__caption {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-muted, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.appearance-preview__item {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-left-width: 3px;
  border-radius: var(--ui-radius-md, 0.75rem);
}

.appearance-preview__icon {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--ui-radius-sm, 0.5rem);
  object-fit: cover;
  flex-shrink: 0;
}

.appearance-preview__dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: var(--ui-radius-full, 9999px);
  flex-shrink: 0;
}

.appearance-preview__name {
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-3, 0.75rem);
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.date-field__label {
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-muted, #64748b);
}

.summary {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-brand-50, #f5fcff);
}

.summary__title {
  margin: 0 0 var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-brand-900, #0b2e33);
}

.summary__list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.summary__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3, 0.75rem);
}

.summary__row dt {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  flex-shrink: 0;
}

.summary__row dd {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
  text-align: right;
  min-width: 0;
}

.summary__project {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  max-width: 100%;
}

.summary__icon {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--ui-radius-sm, 0.5rem);
  object-fit: cover;
  flex-shrink: 0;
}

.summary__dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: var(--ui-radius-full, 9999px);
  flex-shrink: 0;
}

.panel-alert {
  margin-top: var(--ui-space-4, 1rem);
}

.panel-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  margin-top: var(--ui-space-5, 1.25rem);
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (prefers-reduced-motion: reduce) {
  .slide-fade-enter-active,
  .slide-fade-leave-active,
  .stepper__progress-value {
    transition: none;
  }
}

@media (max-width: 1024px) {
  .project-shell__inner {
    grid-template-columns: 1fr;
  }

  .project-hero {
    border-bottom-left-radius: var(--ui-radius-2xl, 1.5rem);
    border-bottom-right-radius: var(--ui-radius-2xl, 1.5rem);
  }

  .project-panel {
    margin: var(--ui-space-6, 1.5rem) var(--ui-space-4, 1rem)
      var(--ui-space-8, 2rem);
  }
}

@media (max-width: 768px) {
  .project-hero {
    padding: var(--ui-space-8, 2rem) var(--ui-space-6, 1.5rem);
  }

  .project-hero h1 {
    font-size: var(--ui-text-2xl, 1.5rem);
  }

  .hero-description {
    max-width: none;
  }

  .hero-stats {
    justify-content: center;
  }

  .project-panel {
    padding: var(--ui-space-6, 1.5rem);
  }

  .panel-header h2 {
    font-size: var(--ui-text-lg, 1.125rem);
  }
}

@media (max-width: 480px) {
  .project-hero {
    padding: var(--ui-space-6, 1.5rem) var(--ui-space-4, 1rem);
  }

  .project-hero h1 {
    font-size: var(--ui-text-xl, 1.25rem);
  }

  .hero-stats li {
    min-width: 70px;
    padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  }

  .hero-stats strong {
    font-size: var(--ui-text-xl, 1.25rem);
  }

  .hero-features li {
    padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  }

  .project-panel {
    margin: var(--ui-space-4, 1rem);
    padding: var(--ui-space-5, 1.25rem);
    border-radius: var(--ui-radius-xl, 1.25rem);
  }

  .stepper__label {
    display: none;
  }

  .stepper__button.is-current .stepper__label {
    display: inline;
  }

  .date-grid {
    grid-template-columns: 1fr;
  }

  .summary__row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-1, 0.25rem);
  }

  .summary__row dd {
    text-align: left;
  }

  .panel-actions {
    flex-direction: column-reverse;
  }

  .panel-actions > * {
    width: 100%;
  }
}
</style>
