import { ref } from "vue";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

const user = ref<User | null>(null);
const loading = ref(true);
let initialized = false;

export function useAuth() {
  // onMounted 経由だと setup 外から呼ばれた場合にリスナーが登録されず、
  // loading が永久に true のままになるため、初回呼び出しで即座に登録する。
  // グローバル状態のためリスナーはアプリ生存中は解除しない。
  if (!initialized) {
    initialized = true;
    onAuthStateChanged(auth, (u) => {
      user.value = u;
      loading.value = false;
    });
  }

  return {
    user,
    loading,
  };
}
