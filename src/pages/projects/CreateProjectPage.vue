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
  background: linear-gradient(135deg, #e3f2f4, #f6fbfb 40%, #e8eff0);
}

.project-hero {
  padding: 4rem 3rem;
  background: linear-gradient(
    180deg,
    rgba(11, 46, 51, 0.95),
    rgba(79, 124, 130, 0.9)
  );
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.hero-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-weight: 700;
  color: #b8e3e9;
}

.project-hero h1 {
  font-size: clamp(2rem, 3vw, 3rem);
  margin: 0;
}

.project-hero p {
  margin: 0;
  line-height: 1.7;
  color: #e3f2f4;
}

.hero-scale {
  font-size: 1rem;
}

.hero-scale strong {
  color: #fff;
}

.hero-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hero-list li {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.hero-list strong {
  font-size: 1rem;
}

.hero-list span {
  font-size: 0.9rem;
  color: #d5eef1;
}

.project-panel {
  background: #fff;
  margin: 3rem;
  border-radius: 2rem;
  padding: 2.5rem;
  box-shadow: 0 40px 80px rgba(11, 46, 51, 0.12);
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.panel-header h2 {
  margin: 0.3rem 0 0;
  color: #0b2e33;
}

.panel-header p {
  margin: 0;
  color: #4f7c82;
  font-weight: 600;
}

.panel-pill {
  background: #b8e3e9;
  color: #0b2e33;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  font-weight: 700;
}

.panel-progress {
  height: 10px;
  background: #edf6f7;
  border-radius: 999px;
  margin: 1.25rem 0 2rem;
  overflow: hidden;
}

.panel-progress__value {
  height: 100%;
  background: linear-gradient(90deg, #4f7c82, #0b2e33);
  transition: width 240ms ease;
}

.panel-body {
  flex: 1;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-weight: 600;
  color: #0b2e33;
}

.form-hint {
  margin: 0;
  font-weight: 400;
  color: #4f7c82;
  font-size: 0.9rem;
}

.project-textarea {
  border: 2px solid #b8e3e9;
  border-radius: 1rem;
  padding: 1rem;
  font-size: 1rem;
  min-height: 180px;
  resize: vertical;
  font-family: inherit;
}

.project-textarea:focus {
  outline: none;
  border-color: #4f7c82;
  box-shadow: 0 0 0 3px rgba(79, 124, 130, 0.2);
}

.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.color-swatch {
  width: 42px;
  height: 42px;
  border-radius: 1rem;
  border: 2px solid transparent;
  cursor: pointer;
  transition:
    transform 120ms ease,
    border 120ms ease;
}

.color-swatch.is-active {
  border-color: #0b2e33;
  transform: translateY(-2px) scale(1.05);
}

.color-picker {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px dashed #93b1b5;
  padding: 0.5rem 0.9rem;
  border-radius: 0.85rem;
  color: #4f7c82;
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
  gap: 0.75rem;
}

.date-stack label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
  color: #0b2e33;
}

.date-stack input {
  border: 2px solid #b8e3e9;
  border-radius: 0.95rem;
  padding: 0.8rem 1rem;
  font-size: 1rem;
}

.date-stack input:focus {
  outline: none;
  border-color: #4f7c82;
  box-shadow: 0 0 0 3px rgba(79, 124, 130, 0.2);
}

.toggle-card {
  border: 2px solid #edf2f3;
  border-radius: 1.25rem;
  padding: 1rem 1.25rem;
  transition:
    border 150ms ease,
    background 150ms ease;
}

.toggle-card label {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
}

.toggle-card input {
  margin-top: 0.4rem;
}

.toggle-card strong {
  display: block;
  color: #0b2e33;
}

.toggle-card p {
  margin: 0.2rem 0 0;
  color: #4f7c82;
  font-size: 0.9rem;
}

.invite-hint {
  border: 1px dashed rgba(11, 46, 51, 0.2);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  background: #f8fbfb;
}

.invite-hint strong {
  display: block;
  margin-bottom: 0.35rem;
  color: #0b2e33;
}

.panel-error {
  margin: 1rem 0 0;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  background: rgba(214, 69, 69, 0.1);
  color: #d64545;
  font-weight: 600;
}

.panel-actions {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 240ms ease;
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
    border-bottom-left-radius: 2rem;
    border-bottom-right-radius: 2rem;
  }

  .project-panel {
    margin: 2rem 1.5rem 3rem;
  }
}
</style>
