import { fetchProfile } from "@/firebase/authService";
import { auth } from "@/lib/firebase";
import type { UserProfile } from "@/types/auth";
import type { User } from "firebase/auth";
import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { computed, ref, watch } from "vue";

const currentUser = ref<User | null>(null);
const profile = ref<UserProfile | null>(null);
const authReady = ref(false);

let initPromise: Promise<void> | null = null;

import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.store.auth");

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

export async function initAuthListener() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      currentUser.value = user;

      if (user) {
        try {
          profile.value = await fetchProfile(user.uid);
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
