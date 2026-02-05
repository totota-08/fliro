import { ref, computed } from "vue";
import type { AdminSession } from "../types/admin";

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30分

// シングルトンセッション状態
const session = ref<AdminSession>({
  verified: false,
  verifiedAt: null,
  expiresAt: null,
});

export function useAdminSession() {
  const isSessionValid = computed(() => {
    if (!session.value.verified || !session.value.expiresAt) return false;
    return Date.now() < session.value.expiresAt;
  });

  function verifySession() {
    const now = Date.now();
    session.value = {
      verified: true,
      verifiedAt: now,
      expiresAt: now + SESSION_DURATION_MS,
    };
  }

  function clearSession() {
    session.value = {
      verified: false,
      verifiedAt: null,
      expiresAt: null,
    };
  }

  // セッション残り時間（秒）
  const remainingSeconds = computed(() => {
    if (!session.value.expiresAt) return 0;
    const remaining = session.value.expiresAt - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  });

  return {
    session,
    isSessionValid,
    verifySession,
    clearSession,
    remainingSeconds,
  };
}
