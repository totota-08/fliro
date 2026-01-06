<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AuthFormField from "@/components/ui/AuthFormField.vue";
import { appName } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import { createProject } from "@/firebase/projectService";
import { fetchScaleStats } from "@/services/statsService";
import { useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const logger = getLogger("app.pages.projects.CreateProject");

const router = useRouter();
const { user } = useAuthStore();

const name = ref("");
const description = ref("");
const color = ref("#4f7c82");
// icon upload feature removed
const isPublic = ref(false);
const allowGuestView = ref(false);
const startDate = ref<string | null>(null);
const dueDate = ref<string | null>(null);
const submitting = ref(false);
const errorMsg = ref("");

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
const scaleStats = ref<{ users: number; projects: number } | null>(null);

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

// icon upload feature removed
</script>

<template>
  <div class="project-shell">
    <section class="project-hero">
      <p class="hero-eyebrow">{{ appName }} Projects</p>
      <h1>メッセージ</h1>
      <!-- <p v-if="scaleStats" class="hero-scale">
        現在 <strong>{{ scaleStats.users.toLocaleString() }}</strong> 人のユーザーが {{ appName }} を利用し、
        <strong>{{ scaleStats.projects.toLocaleString() }}</strong> 件のプロジェクトが進行中です。
      </p> -->
      <ul class="hero-list">
        <li>
          <strong>強調</strong>
          <span>テキスト</span>
        </li>
        <li>
          <strong>強調</strong>
          <span>テキスト</span>
        </li>
        <li>
          <strong>強調</strong>
          <span>テキスト</span>
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

            <label class="form-block">
              <span>プロジェクト説明</span>
              <textarea
                v-model="description"
                rows="6"
                class="project-textarea"
                placeholder="プロジェクトの目的やゴール、主要タスクなどを記載してください"
              />
            </label>
          </div>

          <div v-else-if="currentStep === 'appearance'" class="panel-section">
            <div class="form-block">
              <span>テーマカラー</span>
              <p class="form-hint">
                {{ appName }}
                のブランドカラーから選ぶか、カラーピッカーで細かく調整できます。
              </p>
              <div class="color-grid">
                <button
                  v-for="c in homeColors"
                  :key="c"
                  type="button"
                  class="color-swatch"
                  :class="{ 'is-active': color === c }"
                  :style="{ background: c }"
                  @click="color = c"
                />
                <label class="color-picker">
                  <span>カスタム</span>
                  <input
                    v-model="color"
                    type="color"
                    aria-label="カスタムカラー"
                  />
                </label>
              </div>
            </div>

            <div class="form-block">
              <span>スケジュール</span>
              <div class="date-stack">
                <label>
                  <span>開始日</span>
                  <input v-model="startDate" type="date" />
                </label>
                <label>
                  <span>期限</span>
                  <input v-model="dueDate" type="date" />
                </label>
              </div>
              <p class="form-hint">
                終了期限はいつでも更新できます。未定の場合は空欄のままでも構いません。
              </p>
            </div>
          </div>

          <div v-else class="panel-section">
            <div class="toggle-card">
              <label>
                <input v-model="isPublic" type="checkbox" />
                <div>
                  <strong>公開プロジェクト</strong>
                  <p>ワークスペースの全メンバーが閲覧できる状態にします。</p>
                </div>
              </label>
            </div>

            <div class="toggle-card">
              <label>
                <input v-model="allowGuestView" type="checkbox" />
                <div>
                  <strong>ゲスト閲覧を許可</strong>
                  <p>リンクを共有されたゲストにも読み取り専用で公開します。</p>
                </div>
              </label>
            </div>

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
</template>

<style scoped>
.project-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(320px, 480px) minmax(0, 620px);
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

.project-hero {
  padding: var(--ui-space-16, 4rem) var(--ui-space-12, 3rem);
  background: linear-gradient(
    180deg,
    rgba(11, 46, 51, 0.95),
    rgba(79, 124, 130, 0.9)
  );
  color: var(--ui-text-inverse, #ffffff);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
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

.hero-scale {
  font-size: var(--ui-text-base, 1rem);
}

.hero-scale strong {
  color: var(--ui-text-inverse, #ffffff);
}

.hero-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.hero-list li {
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.hero-list strong {
  font-size: var(--ui-text-base, 1rem);
}

.hero-list span {
  font-size: var(--ui-text-sm, 0.875rem);
  color: rgba(255, 255, 255, 0.8);
}

.project-panel {
  background: var(--ui-surface, #ffffff);
  margin: var(--ui-space-12, 3rem);
  border-radius: var(--ui-radius-3xl, 2rem);
  padding: var(--ui-space-10, 2.5rem);
  box-shadow: var(--ui-shadow-2xl);
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-6, 1.5rem);
}

.panel-header h2 {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-brand-900, #0b2e33);
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
  height: 10px;
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-full, 9999px);
  margin: var(--ui-space-5, 1.25rem) 0 var(--ui-space-8, 2rem);
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
  gap: var(--ui-space-6, 1.5rem);
}

.form-block {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.form-hint {
  margin: 0;
  font-weight: var(--ui-font-normal, 400);
  color: var(--ui-brand-600, #4f7c82);
  font-size: var(--ui-text-sm, 0.875rem);
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

.toggle-card {
  border: 2px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  transition: var(--ui-transition-colors);
}

.toggle-card:has(input:checked) {
  border-color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-brand-100, #e5f6f8);
}

.toggle-card label {
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  align-items: flex-start;
  cursor: pointer;
}

.toggle-card input {
  margin-top: var(--ui-space-1, 0.25rem);
  accent-color: var(--ui-brand-600, #4f7c82);
}

.toggle-card strong {
  display: block;
  color: var(--ui-text, #0b2e33);
}

.toggle-card p {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-brand-600, #4f7c82);
  font-size: var(--ui-text-sm, 0.875rem);
}

.invite-hint {
  border: 1px dashed var(--ui-border-strong, rgba(11, 46, 51, 0.2));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  background: var(--ui-surface-muted, #f1f5f9);
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
  margin-top: var(--ui-space-6, 1.5rem);
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
  .project-shell {
    grid-template-columns: 1fr;
  }

  .project-hero {
    border-bottom-left-radius: var(--ui-radius-3xl, 2rem);
    border-bottom-right-radius: var(--ui-radius-3xl, 2rem);
  }

  .project-panel {
    margin: var(--ui-space-8, 2rem) var(--ui-space-6, 1.5rem)
      var(--ui-space-12, 3rem);
  }
}
</style>
