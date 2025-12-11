<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import { appName } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import { loginWithEmail, registerCredentials } from "@/firebase/authService";
import { auth, db } from "@/firebase/config";
import { redeemInvite } from "@/services/projectInvites";
import { useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { doc, getDoc } from "firebase/firestore";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const logger = getLogger("app.pages.invite.InviteAccept");

const route = useRoute();
const router = useRouter();
const { user } = useAuthStore();
const token = String(route.params.token || "");
const loading = ref(true);
const joinProcessing = ref(false);
const errorMsg = ref("");
const successMsg = ref("");
type InvitePreview = {
  projectId: string;
  name?: string;
  requiresPassword?: boolean;
  expiresAtLabel?: string;
  remainingUses?: number | null;
};

const projectPreview = ref<InvitePreview | null>(null);
const requiresPassword = ref(false);
const passwordInput = ref("");
const authMode = ref<"signup" | "login">("signup");
const emailInput = ref("");
const passwordAuthInput = ref("");
const passwordAuthConfirm = ref("");

const isExpired = ref(false);
const isUsageLimited = ref(false);

const canJoin = computed(() => !isExpired.value && !isUsageLimited.value);

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value.toMillis === "function") return value.toMillis();
  return null;
}

onMounted(async () => {
  try {
    const inviteSnap = await getDoc(doc(db, "projectInvites", token));
    if (!inviteSnap.exists()) {
      errorMsg.value = "招待リンクが無効です。";
      return;
    }
    const invite = inviteSnap.data() as any;
    const projectSnap = await getDoc(doc(db, "projects", invite.projectId));
    const expiresMillis = toMillis(invite.expiresAt);
    const usedCount =
      typeof invite.usedCount === "number" ? invite.usedCount : 0;
    const maxUses =
      typeof invite.maxUses === "number" && invite.maxUses > 0
        ? invite.maxUses
        : null;
    const remainingUses = maxUses ? Math.max(0, maxUses - usedCount) : null;
    const now = Date.now();

    isExpired.value = Boolean(expiresMillis && now > expiresMillis);
    isUsageLimited.value = Boolean(maxUses && usedCount >= maxUses);
    requiresPassword.value = Boolean(invite.passwordHash);

    projectPreview.value = {
      projectId: invite.projectId,
      name: projectSnap.exists()
        ? (projectSnap.data().name as string)
        : undefined,
      requiresPassword: Boolean(invite.passwordHash),
      expiresAtLabel: expiresMillis
        ? formatDate(new Date(expiresMillis))
        : "有効期限なし",
      remainingUses,
    };

    if (isExpired.value) {
      errorMsg.value = "この招待リンクは有効期限切れです。";
    } else if (isUsageLimited.value) {
      errorMsg.value = "この招待リンクは利用上限に達しています。";
    } else {
      successMsg.value = "招待リンクを読み込みました。";
    }
  } catch (error) {
    console.error(error);
    errorMsg.value = "招待情報を読み込めませんでした。";
  } finally {
    loading.value = false;
  }
});

async function ensureAuthenticatedUser() {
  if (user.value) return user.value;

  if (!emailInput.value.trim() || !passwordAuthInput.value.trim()) {
    throw new Error("メールアドレスとパスワードを入力してください。");
  }

  if (authMode.value === "signup") {
    if (passwordAuthInput.value !== passwordAuthConfirm.value) {
      throw new Error("パスワードが一致しません。");
    }
    await registerCredentials({
      email: emailInput.value.trim(),
      password: passwordAuthInput.value.trim(),
    });
  } else {
    await loginWithEmail({
      email: emailInput.value.trim(),
      password: passwordAuthInput.value.trim(),
    });
  }

  if (!auth.currentUser) {
    throw new Error("認証に失敗しました。");
  }
  return auth.currentUser;
}

async function handleJoin() {
  if (!projectPreview.value) return;
  if (!canJoin.value) return;
  if (requiresPassword.value && !passwordInput.value.trim()) {
    errorMsg.value = "パスワードを入力してください。";
    return;
  }

  joinProcessing.value = true;
  errorMsg.value = "";
  try {
    const inviteUser = await ensureAuthenticatedUser();
    const projectId = await redeemInvite(
      token,
      inviteUser.uid,
      inviteUser.email ?? emailInput.value.trim(),
      {
        password: passwordInput.value.trim() || undefined,
      },
    );
    await router.push({
      name: ROUTE_NAMES.projectDashboard,
      params: { projectId },
    });
  } catch (error) {
    logger.error`Failed to accept invite: ${error}`;
    if (error instanceof Error) {
      if (error.message === "invite-password-invalid") {
        errorMsg.value = "パスワードが正しくありません。";
      } else if (error.message === "invite-password-required") {
        errorMsg.value = "このリンクにはパスワードが必要です。";
      } else if (error.message === "invite-expired") {
        errorMsg.value = "この招待リンクは有効期限切れです。";
      } else if (error.message === "invite-usage-limit") {
        errorMsg.value = "この招待リンクは利用上限に達しています。";
      } else {
        errorMsg.value = error.message || "招待の承認に失敗しました。";
      }
    } else {
      errorMsg.value = "招待の承認に失敗しました。";
    }
  } finally {
    joinProcessing.value = false;
  }
}
</script>

<template>
  <div class="invite-shell">
    <section class="invite-card">
      <p class="invite-eyebrow">Project Invitation</p>
      <h1>{{ appName }} プロジェクトへの招待</h1>

      <div v-if="loading">読み込み中...</div>
      <p v-else-if="errorMsg" class="error">{{ errorMsg }}</p>

      <template v-else>
        <p>以下のプロジェクトに参加しますか？</p>
        <dl>
          <div>
            <dt>招待先</dt>
            <dd>{{ projectPreview?.name || projectPreview?.projectId }}</dd>
          </div>
          <div>
            <dt>パスワード</dt>
            <dd>{{ requiresPassword ? "入力が必要です" : "不要" }}</dd>
          </div>
          <div>
            <dt>有効期限</dt>
            <dd>{{ projectPreview?.expiresAtLabel || "不明" }}</dd>
          </div>
          <div>
            <dt>残り利用回数</dt>
            <dd>{{ projectPreview?.remainingUses ?? "無制限" }}</dd>
          </div>
        </dl>

        <div v-if="requiresPassword" class="password-block">
          <label>
            <span>参加パスワード</span>
            <input
              v-model="passwordInput"
              type="password"
              placeholder="リンク作成時のパスワードを入力"
            />
          </label>
        </div>

        <div v-if="!user" class="auth-card">
          <div class="auth-toggle">
            <button
              type="button"
              :class="{ 'is-active': authMode === 'signup' }"
              @click="authMode = 'signup'"
            >
              新規登録
            </button>
            <button
              type="button"
              :class="{ 'is-active': authMode === 'login' }"
              @click="authMode = 'login'"
            >
              ログイン
            </button>
          </div>

          <label>
            <span>メールアドレス</span>
            <input
              v-model="emailInput"
              type="email"
              placeholder="you@example.com"
            />
          </label>

          <label>
            <span>パスワード</span>
            <input
              v-model="passwordAuthInput"
              type="password"
              placeholder="6文字以上"
            />
          </label>

          <label v-if="authMode === 'signup'">
            <span>パスワード確認</span>
            <input
              v-model="passwordAuthConfirm"
              type="password"
              placeholder="もう一度入力"
            />
          </label>
        </div>

        <div v-if="successMsg" class="success">{{ successMsg }}</div>

        <div class="actions">
          <AppButton variant="secondary" :to="{ name: ROUTE_NAMES.home }"
            >ホームに戻る</AppButton
          >
          <AppButton
            variant="primary"
            :loading="joinProcessing || loading"
            :disabled="!canJoin"
            @click="handleJoin"
          >
            {{
              user
                ? "参加する"
                : authMode === "signup"
                  ? "アカウントを作成して参加"
                  : "ログインして参加"
            }}
          </AppButton>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.invite-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top, #e3f6f8, #fff);
  padding: 2rem;
}

.invite-card {
  background: #fff;
  border: 2px solid #b8e3e9;
  border-radius: 1.5rem;
  padding: 2rem;
  max-width: 560px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.invite-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.3em;
  color: #4f7c82;
  margin: 0;
}

h1 {
  margin: 0;
  color: #0b2e33;
}

dl {
  margin: 0;
  display: grid;
  gap: 0.5rem;
}

dt {
  font-size: 0.85rem;
  color: #4f7c82;
}

dd {
  margin: 0;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.password-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.password-block span {
  font-weight: 600;
  color: #0b2e33;
}

.password-block input {
  border: 2px solid #b8e3e9;
  border-radius: 0.9rem;
  padding: 0.75rem 1rem;
  font-size: 1rem;
}

.password-block input:focus {
  outline: none;
  border-color: #4f7c82;
  box-shadow: 0 0 0 3px rgba(79, 124, 130, 0.2);
}

.auth-card {
  border: 1px solid #d7e2ef;
  border-radius: 1rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: #f7fbfc;
}

.auth-card label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-weight: 600;
  color: #0b2e33;
}

.auth-card input {
  border: 1px solid #d7e2ef;
  border-radius: 0.85rem;
  padding: 0.7rem 0.9rem;
}

.auth-toggle {
  display: inline-flex;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.auth-toggle button {
  border: 1px solid #d7e2ef;
  background: #fff;
  border-radius: 0.75rem;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
}

.auth-toggle button.is-active {
  background: rgba(79, 124, 130, 0.16);
  border-color: #4f7c82;
}

.error {
  color: #d64545;
  font-weight: 600;
}

.success {
  color: #2f855a;
  font-weight: 600;
}
</style>
