import { ref, onMounted } from "vue";
import { useAuthStore } from "@/store/auth";
import { multiFactor } from "firebase/auth";
import { useAdminSession } from "./useAdminSession";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.features.admin.useAdminAccess");

export function useAdminAccess() {
  const { user } = useAuthStore();
  const { session, isSessionValid, verifySession, clearSession } =
    useAdminSession();

  const isAdmin = ref(false);
  const hasMFAEnabled = ref(false);
  const loading = ref(true);

  async function checkAdminStatus() {
    if (!user.value) {
      isAdmin.value = false;
      hasMFAEnabled.value = false;
      loading.value = false;
      return;
    }

    try {
      // カスタムクレームをチェック
      const tokenResult = await user.value.getIdTokenResult(true);
      isAdmin.value = tokenResult.claims.admin === true;

      // MFA状態をチェック
      const mfaUser = multiFactor(user.value);
      hasMFAEnabled.value = mfaUser.enrolledFactors.length > 0;
    } catch (error) {
      logger.error`Failed to check admin status: ${error}`;
      isAdmin.value = false;
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    checkAdminStatus();
  });

  return {
    session,
    isAdmin,
    hasMFAEnabled,
    loading,
    isSessionValid,
    verifySession,
    clearSession,
    checkAdminStatus,
  };
}
