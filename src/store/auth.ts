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
/** Firebase Auth のログイン状態が確定したか（プロフィール取得は待たない） */
const authReady = ref(false);
/** プロフィールの初回取得が完了したか（未ログイン時も true になる） */
const profileReady = ref(false);

let initPromise: Promise<void> | null = null;

export function useAuthStore() {
  const isAuthenticated = computed(() => currentUser.value !== null);

  return {
    user: currentUser,
    profile,
    authReady,
    profileReady,
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
  maxRetries: number = 4,
  initialDelay: number = 400,
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

    // 指数バックオフで待機（最大2秒）
    const delay = Math.min(initialDelay * Math.pow(2, attempt), 2000);
    await new Promise((r) => setTimeout(r, delay));
  }

  if (lastError) {
    logger.error`Failed to fetch profile after ${maxRetries} attempts: ${lastError}`;
  }
  return null;
}

/**
 * プロフィールをバックグラウンドで読み込む
 *
 * プロフィール取得（Firestore への往復 + Cloud Functions 待ちのリトライ）を
 * 認証状態の確定と直列にすると、初期表示が最大で数秒ブロックされる。
 * 認証状態の確定（authReady）とは切り離し、非同期に読み込む。
 */
let profileLoadToken = 0;

async function loadProfileInBackground(user: User | null) {
  const token = ++profileLoadToken;

  if (!user) {
    profile.value = null;
    profileReady.value = true;
    return;
  }

  try {
    // Cloud Functions (onUserSignedIn) がプロファイルを作成するので、
    // リトライロジックで取得を試みる
    const result = await fetchProfileWithRetry(user.uid);

    // 取得中にログイン状態が変わっていた場合は結果を破棄する
    if (token !== profileLoadToken) return;

    profile.value = result;

    if (result === null) {
      logger.warn`Profile not found for user ${user.uid} after retries`;
    }
  } catch (error) {
    if (token !== profileLoadToken) return;
    logger.error`Failed to load profile: ${error}`;
    profile.value = null;
  } finally {
    if (token === profileLoadToken) {
      profileReady.value = true;
    }
  }
}

export async function initAuthListener() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      currentUser.value = user;

      // 認証状態が変わったらプロフィールは読み直す
      profileReady.value = false;
      void loadProfileInBackground(user);

      // プロフィールの取得完了は待たずに認証準備完了とする
      if (!authReady.value) {
        authReady.value = true;
        resolve();
      }
    });
  });

  return initPromise;
}

function waitForFlag(flag: typeof authReady, timeoutMs?: number) {
  if (!initPromise) {
    void initAuthListener();
  }

  if (flag.value) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const stop = watch(flag, (ready) => {
      if (ready) {
        finish();
      }
    });

    function finish() {
      stop();
      if (timer) clearTimeout(timer);
      resolve();
    }

    if (timeoutMs !== undefined) {
      timer = setTimeout(finish, timeoutMs);
    }
  });
}

/** Firebase Auth のログイン状態が確定するまで待つ */
export function waitForAuthReady() {
  return waitForFlag(authReady);
}

/**
 * プロフィールの初回取得が終わるまで待つ
 *
 * プロフィールが本当に必要な箇所（サインアップ導線など）でのみ使うこと。
 * 初期表示のクリティカルパスでは待たない。
 *
 * @param timeoutMs 指定した場合、この時間を過ぎたら未取得のまま解決する
 */
export function waitForProfileReady(timeoutMs?: number) {
  return waitForFlag(profileReady, timeoutMs);
}

export async function signOutUser() {
  await firebaseSignOut(auth);
}
