<script setup lang="ts">
/**
 * BetaGatePage - 招待コード入力ページ
 *
 * 招待制ベータ期間中、ベータアクセス権を持たないユーザーに表示
 * 4文字x3セグメント形式（XXXX-XXXX-XXXX）の入力UI
 */
import { ref, computed } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppAlert from "@/components/ui/AppAlert.vue";
import AuthBrand from "@/components/ui/AuthBrand.vue";
import { useBetaAccess } from "../composables/useBetaAccess";
import { signOutUser } from "@/store/auth";
import { useRouter } from "vue-router";
import { ROUTE_NAMES } from "@/constants/routes";

const router = useRouter();
const { submitInviteCode, isValidating, validationError, clearError } =
  useBetaAccess();

// 3セグメントの入力値
const segment1 = ref("");
const segment2 = ref("");
const segment3 = ref("");

// 入力参照
const input1Ref = ref<HTMLInputElement | null>(null);
const input2Ref = ref<HTMLInputElement | null>(null);
const input3Ref = ref<HTMLInputElement | null>(null);

// フルコード
const fullCode = computed(() => {
  return `${segment1.value}-${segment2.value}-${segment3.value}`.toUpperCase();
});

// 送信可能か
const canSubmit = computed(() => {
  return (
    segment1.value.length === 4 &&
    segment2.value.length === 4 &&
    segment3.value.length === 4 &&
    !isValidating.value
  );
});

// 入力時の自動フォーカス移動
function handleInput(segment: 1 | 2 | 3, value: string) {
  // 英数字のみ許可
  const filtered = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  if (segment === 1) {
    segment1.value = filtered.slice(0, 4);
    if (segment1.value.length === 4) input2Ref.value?.focus();
  } else if (segment === 2) {
    segment2.value = filtered.slice(0, 4);
    if (segment2.value.length === 4) input3Ref.value?.focus();
  } else {
    segment3.value = filtered.slice(0, 4);
  }

  // エラーをクリア
  if (validationError.value) {
    clearError();
  }
}

// Backspaceで前のセグメントに戻る
function handleKeydown(segment: 1 | 2 | 3, event: KeyboardEvent) {
  if (event.key === "Backspace") {
    if (segment === 2 && segment2.value === "") {
      input1Ref.value?.focus();
    } else if (segment === 3 && segment3.value === "") {
      input2Ref.value?.focus();
    }
  }
}

// ペースト処理（XXXX-XXXX-XXXX形式対応）
function handlePaste(event: ClipboardEvent) {
  event.preventDefault();
  const pasted = event.clipboardData?.getData("text") ?? "";
  const cleaned = pasted.replace(/[^A-Za-z0-9-]/g, "").toUpperCase();

  // ハイフン区切りならパース
  const parts = cleaned.split("-");
  if (parts.length === 3) {
    segment1.value = (parts[0] ?? "").slice(0, 4);
    segment2.value = (parts[1] ?? "").slice(0, 4);
    segment3.value = (parts[2] ?? "").slice(0, 4);
  } else {
    // ハイフンなしなら12文字として分割
    const flat = cleaned.replace(/-/g, "");
    segment1.value = flat.slice(0, 4);
    segment2.value = flat.slice(4, 8);
    segment3.value = flat.slice(8, 12);
  }

  // エラーをクリア
  if (validationError.value) {
    clearError();
  }
}

// 送信処理
async function handleSubmit() {
  if (!canSubmit.value) return;

  const result = await submitInviteCode(fullCode.value);

  if (result.success) {
    // 成功時はページリロードしてApp.vueで再判定
    window.location.reload();
  }
}

// ログアウト
async function handleLogout() {
  await signOutUser();
  await router.push({ name: ROUTE_NAMES.login });
}
</script>

<template>
  <div class="beta-gate-hero">
    <div class="beta-gate-card">
      <AuthBrand
        title="招待制ベータ版"
        description="Fliroはただいま招待制でベータテストを実施しています"
      />

      <div class="beta-gate-info">
        <p>
          アプリを利用するには招待コードが必要です。<br />
          招待コードをお持ちの方は以下に入力してください。
        </p>
      </div>

      <form class="beta-gate-form" @submit.prevent="handleSubmit">
        <div class="code-input-group" @paste="handlePaste">
          <input
            ref="input1Ref"
            type="text"
            class="code-segment"
            maxlength="4"
            placeholder="XXXX"
            :value="segment1"
            :disabled="isValidating"
            autocomplete="off"
            autocapitalize="characters"
            @input="
              handleInput(1, ($event.target as HTMLInputElement).value ?? '')
            "
            @keydown="handleKeydown(1, $event)"
          />
          <span class="code-separator">-</span>
          <input
            ref="input2Ref"
            type="text"
            class="code-segment"
            maxlength="4"
            placeholder="XXXX"
            :value="segment2"
            :disabled="isValidating"
            autocomplete="off"
            autocapitalize="characters"
            @input="
              handleInput(2, ($event.target as HTMLInputElement).value ?? '')
            "
            @keydown="handleKeydown(2, $event)"
          />
          <span class="code-separator">-</span>
          <input
            ref="input3Ref"
            type="text"
            class="code-segment"
            maxlength="4"
            placeholder="XXXX"
            :value="segment3"
            :disabled="isValidating"
            autocomplete="off"
            autocapitalize="characters"
            @input="
              handleInput(3, ($event.target as HTMLInputElement).value ?? '')
            "
            @keydown="handleKeydown(3, $event)"
          />
        </div>

        <AppAlert v-if="validationError" variant="danger">
          {{ validationError }}
        </AppAlert>

        <AppButton
          type="submit"
          variant="primary"
          block
          :disabled="!canSubmit"
          :loading="isValidating"
        >
          招待コードを確認
        </AppButton>
      </form>

      <div class="beta-gate-footer">
        <p>招待コードをお持ちでない場合は、正式リリースまでお待ちください。</p>
        <AppButton variant="ghost" size="sm" @click="handleLogout">
          ログアウト
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.beta-gate-hero {
  min-height: 100vh;
  min-height: 100dvh;
  padding: var(--ui-space-12, 3rem) var(--ui-space-6, 1.5rem);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    var(--ui-brand-200, #b8e3e9),
    var(--ui-surface, #fff) 45%,
    var(--ui-brand-300, #93b1b5)
  );
}

.beta-gate-card {
  width: min(520px, 100%);
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-2xl, 1.5rem);
  padding: var(--ui-space-10, 2.5rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-2xl);
}

.beta-gate-info {
  margin-top: var(--ui-space-6, 1.5rem);
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-info-light, #e0f2fe);
  border-radius: var(--ui-radius-md, 0.75rem);
  color: var(--ui-info, #0284c7);
  font-size: var(--ui-text-sm, 0.875rem);
  line-height: var(--ui-leading-relaxed, 1.625);
}

.beta-gate-info p {
  margin: 0;
}

.beta-gate-form {
  margin-top: var(--ui-space-8, 2rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
}

.code-input-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2, 0.5rem);
}

.code-segment {
  width: 5rem;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-2, 0.5rem);
  text-align: center;
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-semibold, 600);
  font-family: var(--ui-font-mono, monospace);
  letter-spacing: 0.15em;
  border: 2px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  transition: var(--ui-transition-all, all 0.15s ease);
  text-transform: uppercase;
}

.code-segment::placeholder {
  color: var(--ui-text-placeholder, #94a3b8);
  letter-spacing: 0.15em;
}

.code-segment:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus, 0 0 0 3px rgba(79, 124, 130, 0.15));
}

.code-segment:disabled {
  background: var(--ui-surface-muted, #f8fafc);
  cursor: not-allowed;
}

.code-separator {
  font-size: var(--ui-text-2xl, 1.5rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-muted, #64748b);
}

.beta-gate-footer {
  margin-top: var(--ui-space-8, 2rem);
  padding-top: var(--ui-space-6, 1.5rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  text-align: center;
}

.beta-gate-footer p {
  margin: 0 0 var(--ui-space-4, 1rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

@media (max-width: 600px) {
  .beta-gate-card {
    padding: var(--ui-space-6, 1.5rem) var(--ui-space-5, 1.25rem);
  }

  .code-segment {
    width: 4rem;
    font-size: var(--ui-text-lg, 1.125rem);
    padding: var(--ui-space-2, 0.5rem);
  }

  .code-separator {
    font-size: var(--ui-text-xl, 1.25rem);
  }
}
</style>
