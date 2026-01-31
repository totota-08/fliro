<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppCheckbox from "@/components/ui/AppCheckbox.vue";
import AuthBrand from "@/components/ui/AuthBrand.vue";
import AuthFormField from "@/components/ui/AuthFormField.vue";
import AuthProviderButtons from "@/components/ui/AuthProviderButtons.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import { fetchProfile } from "@/firebase/authService";
import { getCurrentUser } from "@/lib/getCurrentUser";
import {
  authenticateWithEmail,
  authenticateWithProvider,
} from "@/services/accountActions";
import type { SocialProvider } from "@/types/auth";
import { computed, reactive, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.pages.auth.Login");

const router = useRouter();
const route = useRoute();

const form = reactive({
  email: "",
  password: "",
});

const rememberMe = ref(false);
const loading = ref(false);
const providerLoading = ref<SocialProvider | null>(null);
const errorMessage = ref("");

const redirectTarget = computed(() => {
  return (route.query.redirect as string) || { name: ROUTE_NAMES.myPage };
});

const providers: { id: SocialProvider; label: string; icon: string }[] = [
  { id: "google", label: "Google でログイン", icon: "google" },
  { id: "github", label: "GitHub でログイン", icon: "github" },
];
const checksetUp = async (profile?: { setUp?: boolean } | null) => {
  // 渡されたプロファイルがあればそれを使用（ソーシャルログイン時）
  if (profile && profile.setUp === false) {
    await router.push({ name: ROUTE_NAMES.signup, query: { setup: "false" } });
    return;
  }

  // プロファイルが渡されていない場合はFirestoreから取得（メールログイン時）
  if (!profile) {
    const user = await getCurrentUser();
    if (!user) return;

    const fetchedProfile = await fetchProfile(user.uid);
    if (fetchedProfile && fetchedProfile.setUp === false) {
      await router.push({
        name: ROUTE_NAMES.signup,
        query: { setup: "false" },
      });
      return;
    }
  }

  await router.push(redirectTarget.value);
};
const handleSubmit = async () => {
  if (loading.value) return;

  loading.value = true;
  errorMessage.value = "";

  try {
    const profile = await authenticateWithEmail({ ...form });
    await checksetUp(profile);
  } catch (error) {
    logger.error`Login failed: ${error}`;
    errorMessage.value = mapFirebaseError(error);
  } finally {
    loading.value = false;
  }
};

const handleProvider = async (provider: SocialProvider) => {
  if (providerLoading.value) return;

  providerLoading.value = provider;
  errorMessage.value = "";

  try {
    const profile = await authenticateWithProvider(provider);
    await checksetUp(profile);
  } catch (error) {
    logger.error`Provider login failed: ${error}`;
    errorMessage.value = mapFirebaseError(error);
  } finally {
    providerLoading.value = null;
  }
};

function mapFirebaseError(error: unknown): string {
  if (typeof error === "object" && error && "code" in error) {
    const code = String((error as { code?: string }).code);

    // 認証情報エラー
    if (code === "auth/invalid-credential")
      return "メールアドレスまたはパスワードが正しくありません。";
    if (code === "auth/invalid-email")
      return "メールアドレスの形式が正しくありません。";
    if (code === "auth/user-not-found")
      return "このメールアドレスは登録されていません。新規登録をお試しください。";
    if (code === "auth/wrong-password") return "パスワードが正しくありません。";

    // アカウント状態エラー
    if (code === "auth/user-disabled")
      return "このアカウントは無効化されています。サポートにお問い合わせください。";
    if (code === "auth/account-exists-with-different-credential")
      return "このメールアドレスは別の方法（Google/GitHubなど）で登録されています。そちらでログインしてください。";

    // 制限エラー
    if (code === "auth/too-many-requests")
      return "ログイン試行回数が上限に達しました。しばらく時間を置いてから再度お試しください。";
    if (code === "auth/operation-not-allowed")
      return "この認証方法は現在利用できません。";

    // ネットワーク・接続エラー
    if (code === "auth/network-request-failed")
      return "ネットワーク接続に問題があります。インターネット接続を確認してください。";

    // ソーシャルログインエラー
    if (code === "auth/popup-closed-by-user")
      return "ログインがキャンセルされました。もう一度お試しください。";
    if (code === "auth/cancelled-popup-request")
      return "ログインがキャンセルされました。";
    if (code === "auth/popup-blocked")
      return "ポップアップがブロックされました。ブラウザの設定を確認してください。";

    // App Check / セキュリティエラー
    if (code === "auth/app-check-token-error" || code.includes("appCheck"))
      return "セキュリティ検証に失敗しました。ページを再読み込みしてください。";

    // MFAエラー
    if (code === "auth/multi-factor-auth-required")
      return "二段階認証が必要です。";

    // その他の認証エラー
    if (code === "auth/requires-recent-login")
      return "セキュリティのため再ログインが必要です。";
    if (code === "auth/invalid-action-code")
      return "リンクが無効または期限切れです。";

    // 未知のauth/エラー
    if (code.startsWith("auth/")) {
      logger.warn`Unknown auth error code: ${code}`;
      return `認証エラーが発生しました（${code}）。時間を置いて再度お試しください。`;
    }
  }

  // エラーオブジェクトでない場合やコードがない場合
  logger.warn`Unexpected login error: ${error}`;
  return "ログインできませんでした。時間を置いて再度お試しください。";
}
</script>

<template>
  <div class="login-hero">
    <div class="login-card">
      <AuthBrand
        title="ログイン"
        description="アカウントにログインしてください"
      />

      <form class="login-form" @submit.prevent="handleSubmit">
        <AuthFormField
          v-model="form.email"
          label="メールアドレス"
          type="email"
          placeholder="you@example.com"
          autocomplete="email"
          required
        />

        <AuthFormField
          v-model="form.password"
          label="パスワード"
          type="password"
          placeholder="••••••••"
          autocomplete="current-password"
          required
        />

        <div class="form-assist">
          <AppCheckbox
            v-model="rememberMe"
            label="ログイン状態を保持"
            size="sm"
          />
          <RouterLink :to="{ name: ROUTE_NAMES.passwordReset }">
            パスワードを忘れた場合
          </RouterLink>
        </div>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>

        <AppButton
          type="submit"
          variant="primary"
          block
          :disabled="loading"
          :loading="loading"
        >
          ログイン
        </AppButton>
      </form>

      <div class="divider">
        <span>または</span>
      </div>

      <AuthProviderButtons
        class="provider-section"
        :providers="providers"
        :loading="providerLoading"
        @select="handleProvider"
      />

      <p class="login-helper">
        アカウントをお持ちでない場合
        <RouterLink :to="{ name: ROUTE_NAMES.signup }">新規登録</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-hero {
  min-height: calc(100vh - 6rem);
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

@supports (min-height: 100dvh) {
  .login-hero {
    min-height: calc(100dvh - 6rem);
  }
}

.login-card {
  width: min(480px, 100%);
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-2xl, 1.5rem);
  padding: var(--ui-space-10, 2.5rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-2xl);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
}

.form-assist {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--ui-text-sm, 0.875rem);
}

.form-assist a {
  color: var(--ui-brand-600, #4f7c82);
  text-decoration: none;
  transition: var(--ui-transition-colors);
  min-height: var(--ui-touch-target-min, 44px);
  display: inline-flex;
  align-items: center;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  margin: calc(-1 * var(--ui-space-1, 0.25rem))
    calc(-1 * var(--ui-space-2, 0.5rem));
  border-radius: var(--ui-radius-sm, 0.5rem);
}

.form-assist a:hover {
  color: var(--ui-brand-900, #0b2e33);
  background: var(--ui-brand-100, #e5f6f8);
}

.form-error {
  background: var(--ui-danger-bg, rgba(214, 69, 69, 0.1));
  border: 1px solid rgba(214, 69, 69, 0.3);
  color: var(--ui-danger, #d64545);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
}

.divider {
  margin: var(--ui-space-8, 2rem) 0 var(--ui-space-6, 1.5rem);
  text-align: center;
  position: relative;
}

.divider::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 0;
  height: 1px;
  width: 100%;
  background: var(--ui-border, rgba(11, 46, 51, 0.12));
}

.divider span {
  display: inline-block;
  padding: 0 var(--ui-space-3, 0.75rem);
  background: var(--ui-surface, #ffffff);
  position: relative;
  color: var(--ui-text-muted, #64748b);
  font-weight: var(--ui-font-semibold, 600);
}

.login-helper {
  margin-top: var(--ui-space-6, 1.5rem);
  text-align: center;
  color: var(--ui-brand-600, #4f7c82);
}

.login-helper a {
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-brand-600, #4f7c82);
  text-decoration: none;
  transition: var(--ui-transition-colors);
  min-height: var(--ui-touch-target-min, 44px);
  display: inline-flex;
  align-items: center;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-sm, 0.5rem);
}

.login-helper a:hover {
  color: var(--ui-brand-900, #0b2e33);
  background: var(--ui-brand-100, #e5f6f8);
}

.provider-section {
  margin-top: var(--ui-space-4, 1rem);
}

@media (max-width: 768px) {
  .login-hero {
    padding: var(--ui-space-8, 2rem) var(--ui-space-5, 1.25rem);
  }

  .login-card {
    padding: var(--ui-space-8, 2rem) var(--ui-space-6, 1.5rem);
  }
}

@media (max-width: 600px) {
  .login-card {
    padding: var(--ui-space-6, 1.5rem) var(--ui-space-5, 1.25rem);
  }

  .login-hero {
    padding: var(--ui-space-6, 1.5rem) var(--ui-space-4, 1rem);
  }
}
</style>
