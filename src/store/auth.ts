import { fetchProfile } from "@/firebase/authService";
import { auth } from "@/lib/firebase";
import type { UserProfile } from "@/types/auth";
import type { User } from "firebase/auth";
import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { computed, ref, watch } from "vue";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.store.auth");

const currentUser = ref<User | null>(null);
const profile = ref<UserProfile | null>(null);
const authReady = ref(false);

let initPromise: Promise<void> | null = null;

export function useAuthStore() {
  const isAuthenticated = computed(() => currentUser.value !== null);

  return {
    user: currentUser,
    profile,
    authReady,
    isAuthenticated,
  };
}

export function setProfile(data: UserProfile | null) {
  profile.value = data;
}

/**
 * リトライロジック付きでプロファイルを取得
 * Cloud Functions (onUserSignedIn) がプロファイルを作成するため、
 * 初回取得時にまだ存在しない場合はリトライする
 */
async function fetchProfileWithRetry(
  uid: string,
  maxRetries: number = 5,
  initialDelay: number = 500,
): Promise<UserProfile | null> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fetchProfile(uid);
      if (result !== null) {
        return result;
      }
      // プロファイルがnullの場合は、Cloud Functionsがまだ作成中の可能性
      // 少し待ってリトライ
    } catch (error) {
      lastError = error;
      logger.warn`Profile fetch attempt ${attempt + 1} failed: ${error}`;
    }

    // 指数バックオフで待機（最大5秒）
    const delay = Math.min(initialDelay * Math.pow(2, attempt), 5000);
    await new Promise((r) => setTimeout(r, delay));
  }

  if (lastError) {
    logger.error`Failed to fetch profile after ${maxRetries} attempts: ${lastError}`;
  }
  return null;
}

export async function initAuthListener() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      currentUser.value = user;

      if (user) {
        try {
          // Cloud Functions (onUserSignedIn) がプロファイルを作成するので、
          // リトライロジックで取得を試みる
          profile.value = await fetchProfileWithRetry(user.uid);

          if (profile.value === null) {
            logger.warn`Profile not found for user ${user.uid} after retries`;
          }
        } catch (error) {
          logger.error`Failed to load profile: ${error}`;
          profile.value = null;
        }
      } else {
        profile.value = null;
      }

      if (!authReady.value) {
        authReady.value = true;
        resolve();
      }
    });
  });

  return initPromise;
}

export function waitForAuthReady() {
  if (!initPromise) {
    void initAuthListener();
  }

  if (authReady.value) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const stop = watch(authReady, (ready) => {
      if (ready) {
        stop();
        resolve();
      }
    });
  });
}

export async function signOutUser() {
  await firebaseSignOut(auth);
}
