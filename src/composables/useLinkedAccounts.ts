/**
 * useLinkedAccounts.ts - アカウント連携のUI状態管理Composable
 *
 * Google/GitHubアカウントの連携・解除の状態管理とエラーハンドリングを担当
 */
import {
  getLinkedProviders,
  isProviderLinked,
  linkProvider,
  unlinkProvider,
} from "@/firebase/authService";
import {
  PROVIDER_IDS,
  type LinkedProvider,
  type SocialProvider,
} from "@/types/auth";
import { getLogger } from "@logtape/logtape";
import { computed, onMounted, ref } from "vue";

const logger = getLogger("app.composables.useLinkedAccounts");

export function useLinkedAccounts() {
  const linkedProviders = ref<LinkedProvider[]>([]);
  const loading = ref(false);
  const linkingProvider = ref<SocialProvider | null>(null);
  const unlinkingProvider = ref<string | null>(null);
  const error = ref("");

  // 各プロバイダーの連携状態
  const isGoogleLinked = computed(() =>
    isProviderLinked(linkedProviders.value, PROVIDER_IDS.GOOGLE),
  );
  const isGitHubLinked = computed(() =>
    isProviderLinked(linkedProviders.value, PROVIDER_IDS.GITHUB),
  );
  const isPasswordLinked = computed(() =>
    isProviderLinked(linkedProviders.value, PROVIDER_IDS.PASSWORD),
  );

  // 連携解除可能かどうか（最低1つの認証方法が必要）
  const canUnlink = computed(() => linkedProviders.value.length > 1);

  async function loadLinkedProviders() {
    loading.value = true;
    error.value = "";
    try {
      linkedProviders.value = await getLinkedProviders();
    } catch (e) {
      logger.error`Failed to load linked providers: ${e}`;
      error.value = "連携情報の取得に失敗しました。";
    } finally {
      loading.value = false;
    }
  }

  async function handleLinkProvider(provider: SocialProvider) {
    if (linkingProvider.value) return;

    linkingProvider.value = provider;
    error.value = "";
    try {
      linkedProviders.value = await linkProvider(provider);
    } catch (e) {
      logger.error`Failed to link provider: ${e}`;
      error.value = mapLinkError(e);
    } finally {
      linkingProvider.value = null;
    }
  }

  async function handleUnlinkProvider(providerId: string) {
    if (unlinkingProvider.value) return;

    unlinkingProvider.value = providerId;
    error.value = "";
    try {
      linkedProviders.value = await unlinkProvider(providerId);
    } catch (e) {
      logger.error`Failed to unlink provider: ${e}`;
      error.value = mapUnlinkError(e);
    } finally {
      unlinkingProvider.value = null;
    }
  }

  onMounted(() => {
    loadLinkedProviders();
  });

  return {
    linkedProviders,
    loading,
    linkingProvider,
    unlinkingProvider,
    error,
    isGoogleLinked,
    isGitHubLinked,
    isPasswordLinked,
    canUnlink,
    loadLinkedProviders,
    handleLinkProvider,
    handleUnlinkProvider,
  };
}

function mapLinkError(error: unknown): string {
  if (typeof error === "object" && error && "code" in error) {
    const code = String((error as { code?: string }).code);
    if (code === "auth/credential-already-in-use") {
      return "このアカウントは既に別のユーザーに連携されています。";
    }
    if (code === "auth/provider-already-linked") {
      return "このプロバイダーは既に連携されています。";
    }
    if (code === "auth/popup-closed-by-user") {
      return "認証がキャンセルされました。";
    }
    if (code === "auth/popup-blocked") {
      return "ポップアップがブロックされました。ブラウザの設定を確認してください。";
    }
  }
  return "連携に失敗しました。時間を置いて再度お試しください。";
}

function mapUnlinkError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("最低1つ")) {
      return error.message;
    }
    if (error.message.includes("メールアドレスが設定されていない")) {
      return error.message;
    }
  }
  return "連携解除に失敗しました。時間を置いて再度お試しください。";
}
