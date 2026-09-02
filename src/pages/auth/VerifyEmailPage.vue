<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AuthBrand from "@/components/ui/AuthBrand.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import { verifyEmailWithCode } from "@/services/accountActions";
import { getLogger } from "@logtape/logtape";
import { onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

const logger = getLogger("app.pages.auth.VerifyEmail");

const route = useRoute();
const router = useRouter();
const oobCode = ref<string | null>(null);
const loading = ref(true);
const success = ref(false);
const errorMessage = ref("");

onMounted(async () => {
  const code = route.query.oobCode;
  const mode = route.query.mode;

  if (mode === "resetPassword") {
    router.replace({
      name: ROUTE_NAMES.passwordResetConfirm,
      query: route.query,
    });
    return;
  }

  if (mode !== "verifyEmail") {
    errorMessage.value = "メール認証用リンクではありません。";
    loading.value = false;
    return;
  }

  if (typeof code !== "string") {
    errorMessage.value =
      "認証コードが無効です。再度メールのリンクからアクセスしてください。";
    loading.value = false;
    return;
  }

  oobCode.value = code;

  try {
    await verifyEmailWithCode(code);
    success.value = true;
  } catch (error) {
    logger.error`Email verification failed: ${error}`;
    errorMessage.value =
      "認証に失敗しました。リンクの有効期限が切れている可能性があります。";
  } finally {
    loading.value = false;
  }
});

const goToContinue = () => {
  window.close();
};
</script>

<template>
  <div class="action-shell">
    <div class="action-card">
      <AuthBrand
        title="メール認証"
        :description="
          success
            ? 'メールアドレスの認証が完了しました。'
            : 'メールアドレスを確認しています。'
        "
      />

      <div class="action-body">
        <p v-if="loading">メール認証を処理しています...</p>
        <template v-else>
          <p v-if="success">
            プロフィールの登録を行なってください。<br />
            こちらの画面は閉じても問題ありません。
          </p>
          <p v-if="errorMessage" class="action-error">{{ errorMessage }}</p>
        </template>
      </div>

      <div class="action-footer">
        <AppButton v-if="success" variant="primary" @click="goToContinue">
          ウィンドウを閉じる
        </AppButton>
        <RouterLink v-else :to="{ name: ROUTE_NAMES.home }"
          >ヘルプを見る</RouterLink
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.action-shell {
  min-height: calc(100vh - 4rem);
  background: linear-gradient(
    135deg,
    var(--ui-brand-100, rgba(184, 227, 233, 0.35)),
    var(--ui-surface, #ffffff),
    var(--ui-border-strong, rgba(147, 177, 181, 0.35))
  );
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.action-card {
  width: min(460px, 100%);
  background: var(--ui-surface, #ffffff);
  border-radius: 1.5rem;
  padding: 2.25rem;
  border: 1px solid var(--ui-border-strong, rgba(147, 177, 181, 0.35));
  box-shadow: var(
    --ui-shadow-xl,
    0 40px 70px var(--ui-shadow-color, rgba(11, 46, 51, 0.1))
  );
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.action-body {
  color: var(--ui-brand-600, #4f7c82);
  line-height: 1.7;
}

.action-error {
  background: var(--ui-danger-bg, rgba(214, 69, 69, 0.08));
  border: 1px solid var(--ui-danger, #d64545);
  color: var(--ui-danger, #d64545);
  border-radius: 0.85rem;
  padding: 0.75rem 1rem;
  font-weight: 600;
}

.action-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  align-items: center;
}

.action-footer a {
  font-weight: 600;
  color: var(--ui-brand-600, #4f7c82);
}

.action-footer a:hover {
  color: var(--ui-brand-900, #0b2e33);
}
</style>
