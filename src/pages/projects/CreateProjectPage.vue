<script setup lang="ts">
import AvatarCropperModal from "@/components/modals/AvatarCropperModal.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppColorPicker from "@/components/ui/AppColorPicker.vue";
import AppTextarea from "@/components/ui/AppTextarea.vue";
import AppToggle from "@/components/ui/AppToggle.vue";
import AuthFormField from "@/components/ui/AuthFormField.vue";
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

const homeColors = ["#4f7c82", "#0b2e33", "#93b1b5", "#b8e3e9"];

type CreateStep = "basic" | "appearance" | "settings";
const stepOrder: CreateStep[] = ["basic", "appearance", "settings"];
const stepLabels: Record<CreateStep, string> = {
  basic: "基本情報",
  appearance: "見た目の設定",
  settings: "詳細設定",
};

const currentStep = ref<CreateStep>("basic");
const currentStepIndex = computed(() =>
  Math.max(stepOrder.indexOf(currentStep.value), 0),
);
const progressPercent = computed(
  () => ((currentStepIndex.value + 1) / stepOrder.length) * 100,
);
const basicValid = computed(() => name.value.trim().length > 0);
const scaleStats = ref<ScaleStats | null>(null);

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
        <header class="panel-header">
          <div>
            <p>ステップ {{ currentStepIndex + 1 }} / {{ stepOrder.length }}</p>
            <h2>{{ stepLabels[currentStep] }}</h2>
          </div>
          <span class="panel-pill">{{ Math.round(progressPercent) }}%</span>
        </header>
        <div class="panel-progress">
          <div
            class="panel-progress__value"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>

        <Transition name="slide-fade" mode="out-in">
          <div :key="currentStep" class="panel-body">
            <div v-if="currentStep === 'basic'" class="panel-section">
              <AuthFormField
                v-model="name"
                label="プロジェクト名"
                placeholder="例）Webサイトリニューアル"
                required
              />

              <div class="form-block">
                <span>プロジェクト説明</span>
                <AppTextarea
                  v-model="description"
                  :rows="6"
                  placeholder="プロジェクトの目的やゴール、主要タスクなどを記載してください"
                />
              </div>
            </div>

            <div v-else-if="currentStep === 'appearance'" class="panel-section">
              <div class="form-block">
                <span>プロジェクトアイコン</span>
                <p class="form-hint">
                  サイドバーやプロジェクト一覧に表示されます（5MBまでの画像、任意）。
                </p>
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
                      {{ name.trim().charAt(0) || "P" }}
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
                <p v-if="iconError" class="form-error" role="alert">
                  {{ iconError }}
                </p>
              </div>

              <div class="form-block">
                <span>テーマカラー</span>
                <p class="form-hint">
                  {{ appName }}
                  のブランドカラーから選ぶか、カラーピッカーで細かく調整できます。
                </p>
                <AppColorPicker v-model="color" :preset-colors="homeColors" />
              </div>

              <div class="form-block">
                <span>スケジュール</span>
                <div class="date-stack">
                  <div class="date-field">
                    <span class="date-label">開始日</span>
                    <DatePicker
                      v-model="startDate"
                      placeholder="開始日を選択"
                    />
                  </div>
                  <div class="date-field">
                    <span class="date-label">期限</span>
                    <DatePicker v-model="dueDate" placeholder="期限を選択" />
                  </div>
                </div>
                <p class="form-hint">
                  終了期限はいつでも更新できます。未定の場合は空欄のままでも構いません。
                </p>
              </div>
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

              <div class="invite-hint">
                <strong>参加リンクについて</strong>
                <p>
                  プロジェクト作成後、メンバー管理ページから参加リンクを生成し、チームに共有できます。
                </p>
              </div>
            </div>
          </div>
        </Transition>

        <p v-if="errorMsg" class="panel-error">{{ errorMsg }}</p>

        <div class="panel-actions">
          <AppButton
            variant="secondary"
            @click="prevStep"
            :disabled="currentStepIndex === 0"
            >戻る</AppButton
          >
          <AppButton
            v-if="currentStepIndex < stepOrder.length - 1"
            variant="primary"
            :disabled="currentStep === 'basic' && !basicValid"
            @click="nextStep"
            >次へ進む</AppButton
          >
          <AppButton
            v-else
            type="button"
            variant="primary"
            :loading="submitting"
            :disabled="submitting || !basicValid"
            @click="handleSubmit"
            >プロジェクトを作成</AppButton
          >
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

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
}

.panel-header h2 {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-brand-900, #0b2e33);
  font-size: var(--ui-text-xl, 1.25rem);
}

.panel-header p {
  margin: 0;
  color: var(--ui-brand-600, #4f7c82);
  font-weight: var(--ui-font-semibold, 600);
}

.panel-pill {
  background: var(--ui-brand-200, #b8e3e9);
  color: var(--ui-brand-900, #0b2e33);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-weight: var(--ui-font-bold, 700);
}

.panel-progress {
  height: 6px;
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-full, 9999px);
  margin: var(--ui-space-4, 1rem) 0 var(--ui-space-5, 1.25rem);
  overflow: hidden;
}

.panel-progress__value {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--ui-brand-600, #4f7c82),
    var(--ui-brand-900, #0b2e33)
  );
  transition: width var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.panel-body {
  flex: 1;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
}

.form-block {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.form-hint {
  margin: 0;
  font-weight: var(--ui-font-normal, 400);
  color: var(--ui-brand-600, #4f7c82);
  font-size: var(--ui-text-sm, 0.875rem);
}

.form-error {
  margin: 0;
  font-weight: var(--ui-font-normal, 400);
  color: var(--ui-danger, #d64545);
  font-size: var(--ui-text-sm, 0.875rem);
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

.project-textarea {
  border: 2px solid var(--ui-brand-200, #b8e3e9);
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-4, 1rem);
  font-size: var(--ui-text-base, 1rem);
  min-height: 180px;
  resize: vertical;
  font-family: inherit;
  transition: var(--ui-transition-colors);
}

.project-textarea:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-3, 0.75rem);
  align-items: center;
}

.color-swatch {
  width: 42px;
  height: 42px;
  border-radius: var(--ui-radius-lg, 1rem);
  border: 2px solid transparent;
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.color-swatch.is-active {
  border-color: var(--ui-brand-900, #0b2e33);
  transform: translateY(-2px) scale(1.05);
}

.color-picker {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  border: 1px dashed var(--ui-border-strong, rgba(11, 46, 51, 0.2));
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  color: var(--ui-brand-600, #4f7c82);
}

.color-picker input {
  border: none;
  background: transparent;
  width: 40px;
  height: 32px;
  padding: 0;
}

.date-stack {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.date-stack label {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.date-stack input {
  border: 2px solid var(--ui-brand-200, #b8e3e9);
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  font-size: var(--ui-text-base, 1rem);
  transition: var(--ui-transition-colors);
}

.date-stack input:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.invite-hint {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: var(--ui-brand-50, #f5fcff);
}

.invite-hint strong {
  display: block;
  margin-bottom: var(--ui-space-1, 0.25rem);
  color: var(--ui-text, #0b2e33);
}

.invite-hint p {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.panel-error {
  margin: var(--ui-space-4, 1rem) 0 0;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-lg, 1rem);
  background: var(--ui-danger-bg, rgba(214, 69, 69, 0.1));
  color: var(--ui-danger, #d64545);
  font-weight: var(--ui-font-semibold, 600);
}

.panel-actions {
  display: flex;
  justify-content: space-between;
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

  .panel-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-2, 0.5rem);
  }

  .panel-pill {
    align-self: flex-end;
    margin-top: calc(-1 * var(--ui-space-6, 1.5rem));
  }

  .panel-actions {
    flex-direction: column;
  }

  .panel-actions > * {
    width: 100%;
  }
}
</style>
