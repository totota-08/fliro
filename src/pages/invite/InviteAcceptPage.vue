<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AuthBrand from "@/components/ui/AuthBrand.vue";
import AuthCredentialFields from "@/components/ui/AuthCredentialFields.vue";
import AuthFormField from "@/components/ui/AuthFormField.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import {
  loginWithEmail,
  refreshCurrentUser,
  registerCredentials,
  resendVerificationEmail,
} from "@/firebase/authService";
import { getCurrentUser } from "@/lib/getCurrentUser";
import {
  completeProfileSetup,
  updateAccountAvatar,
} from "@/services/accountActions";
import { redeemInvite, fetchInviteByToken } from "@/services/projectInvites";
import { useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { computed, onMounted, reactive, ref, watch } from "vue";
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
type SignUpStep = "credentials" | "verify" | "profile";

const projectPreview = ref<InvitePreview | null>(null);
const requiresPassword = ref(false);
const passwordInput = ref("");
const authMode = ref<"signup" | "login">("signup");
const emailInput = ref("");
const passwordAuthInput = ref("");
const authRequired = ref(false);
const signUpStep = ref<SignUpStep>("credentials");
const signupCompleted = ref(false);
const signupFlowActive = ref(false);
const credentialForm = reactive({
  email: "",
  password: "",
});
const credentialConfirm = ref("");
const credentialLoading = ref(false);
const credentialError = ref("");
const credentialEmail = ref("");
const verificationMessage = ref("");
const verificationError = ref("");
const resendLoading = ref(false);
const verificationChecking = ref(false);
const profileForm = reactive({
  fullName: "",
  nickname: "",
  birthday: "",
  jobRole: "",
  jobTitle: "",
});
const profileLoading = ref(false);
const profileError = ref("");
const avatarFile = ref<File | null>(null);
const avatarPreview = ref<string | null>(null);

const isExpired = ref(false);
const isUsageLimited = ref(false);

const jobOptions = [
  { value: "", label: "職業を選択してください" },
  { value: "engineer", label: "エンジニア" },
  { value: "designer", label: "デザイナー" },
  { value: "product", label: "プロダクトマネージャー" },
  { value: "marketing", label: "マーケター" },
  { value: "sales", label: "営業" },
  { value: "cs", label: "カスタマーサクセス" },
  { value: "other", label: "その他" },
];

const credentialValid = computed(() => {
  return (
    credentialForm.email.includes("@") && credentialForm.password.length >= 6
  );
});

const profileValid = computed(() => {
  return (
    profileForm.fullName.trim().length > 1 &&
    Boolean(profileForm.birthday) &&
    Boolean(profileForm.jobRole)
  );
});

const stepOrder: SignUpStep[] = ["credentials", "verify", "profile"];
const stepLabels: Record<SignUpStep, string> = {
  credentials: "メールアドレス登録",
  verify: "メール認証",
  profile: "プロフィール設定",
};

const currentStepIndex = computed(() => {
  return Math.max(stepOrder.indexOf(signUpStep.value), 0);
});

const progressPercent = computed(() => {
  return ((currentStepIndex.value + 1) / stepOrder.length) * 100;
});

const canJoin = computed(
  () =>
    Boolean(projectPreview.value) && !isExpired.value && !isUsageLimited.value,
);
const canProceed = computed(() => {
  if (loading.value || joinProcessing.value) return false;
  if (authRequired.value && !projectPreview.value) {
    if (authMode.value === "login") {
      return Boolean(emailInput.value.trim() && passwordAuthInput.value.trim());
    }
    return false;
  }
  if (!canJoin.value) return false;
  if (authMode.value === "signup") {
    if (!signupFlowActive.value) return Boolean(user.value);
    return Boolean(user.value && signupCompleted.value);
  }
  if (!user.value) {
    return Boolean(emailInput.value.trim() && passwordAuthInput.value.trim());
  }
  return true;
});
const showAuthGate = computed(
  () =>
    (!user.value && (authRequired.value || Boolean(projectPreview.value))) ||
    (authMode.value === "signup" &&
      signupFlowActive.value &&
      !signupCompleted.value),
);
const showJoinButton = computed(() => {
  if (
    authMode.value === "signup" &&
    signupFlowActive.value &&
    !signupCompleted.value
  ) {
    return false;
  }
  return (
    Boolean(user.value) || authMode.value === "login" || signupCompleted.value
  );
});

function isPermissionDenied(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  if (code === "permission-denied") return true;
  const message = (error as { message?: string }).message;
  return typeof message === "string" && message.includes("permission-denied");
}

function describeError(error: unknown) {
  if (!error) return "unknown error";
  if (error instanceof Error) {
    const code =
      typeof (error as { code?: string }).code === "string"
        ? (error as { code?: string }).code
        : undefined;
    return JSON.stringify({
      name: error.name,
      message: error.message,
      code,
      stack: error.stack,
    });
  }
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return JSON.stringify({
      name: typeof record.name === "string" ? record.name : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
      code: typeof record.code === "string" ? record.code : undefined,
    });
  }
  return String(error);
}

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
  await loadInviteDetails();
});

watch(authMode, (mode) => {
  if (mode === "signup") {
    signUpStep.value = "credentials";
    signupCompleted.value = false;
    signupFlowActive.value = false;
    credentialError.value = "";
    verificationMessage.value = "";
    verificationError.value = "";
    profileError.value = "";
    if (!credentialForm.email && emailInput.value) {
      credentialForm.email = emailInput.value;
    }
    credentialForm.password = "";
    credentialConfirm.value = "";
  } else {
    if (!emailInput.value && credentialForm.email) {
      emailInput.value = credentialForm.email;
    }
    signupCompleted.value = false;
    signupFlowActive.value = false;
    passwordAuthInput.value = "";
  }
});

async function loadInviteDetails() {
  loading.value = true;
  errorMsg.value = "";
  successMsg.value = "";
  authRequired.value = false;
  projectPreview.value = null;
  isExpired.value = false;
  isUsageLimited.value = false;
  requiresPassword.value = false;

  try {
    const invite = await fetchInviteByToken(token);
    if (!invite) {
      errorMsg.value = "招待リンクが無効です。";
      return;
    }
    let projectName =
      typeof invite.projectName === "string" ? invite.projectName : undefined;
    if (!projectName) {
      try {
        const projectSnap = await getDoc(doc(db, "projects", invite.projectId));
        projectName = projectSnap.exists()
          ? (projectSnap.data().name as string)
          : undefined;
      } catch {
        projectName = undefined;
      }
    }
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
      name: projectName,
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
    const detail = describeError(error);
    logger.error`Failed to load invite: ${detail}`;
    logger.error`Invite load context: ${JSON.stringify({
      tokenLength: token.length,
      authed: Boolean(user.value),
    })}`;
    if (!user.value && isPermissionDenied(error)) {
      authRequired.value = true;
      errorMsg.value = "招待を受けるにはアカウントを作成してください。";
      return;
    }
    errorMsg.value = "招待情報を読み込めませんでした。";
  } finally {
    loading.value = false;
  }
}

const handleCredentialSubmit = async () => {
  if (!credentialValid.value || credentialLoading.value) return;
  if (credentialForm.password !== credentialConfirm.value) {
    credentialError.value = "パスワードが一致しません。";
    return;
  }

  credentialLoading.value = true;
  credentialError.value = "";

  try {
    await registerCredentials({
      email: credentialForm.email.trim(),
      password: credentialForm.password.trim(),
    });
    signupFlowActive.value = true;
    credentialEmail.value = credentialForm.email.trim();
    emailInput.value = credentialEmail.value;
    verificationMessage.value =
      "認証メールを送信しました。受信ボックスをご確認ください。";
    signUpStep.value = "verify";
  } catch (error) {
    logger.error`Credential registration failed: ${error}`;
    credentialError.value = mapFirebaseError(error);
  } finally {
    credentialLoading.value = false;
  }
};

const handleResend = async () => {
  if (resendLoading.value) return;
  resendLoading.value = true;
  verificationMessage.value = "";
  verificationError.value = "";

  try {
    await resendVerificationEmail();
    verificationMessage.value = "認証メールを再送しました。";
  } catch (error) {
    logger.error`Resend verification failed: ${error}`;
    verificationError.value = "認証メールの再送に失敗しました。";
  } finally {
    resendLoading.value = false;
  }
};

const checkVerificationStatus = async () => {
  if (verificationChecking.value) return;
  verificationChecking.value = true;
  verificationError.value = "";

  try {
    const refreshed = await refreshCurrentUser();
    if (refreshed?.emailVerified) {
      signUpStep.value = "profile";
      hydrateProfileFromUser(refreshed);
      return;
    }
    verificationError.value =
      "まだメール認証が確認できません。確認後に再度お試しください。";
  } catch (error) {
    logger.error`Verification check failed: ${error}`;
    verificationError.value = "認証状態を確認できませんでした。";
  } finally {
    verificationChecking.value = false;
  }
};

const handleProfileSubmit = async () => {
  if (!profileValid.value || profileLoading.value) return;

  profileLoading.value = true;
  profileError.value = "";

  try {
    const nickname = buildNickname(profileForm.fullName, profileForm.nickname);
    await completeProfileSetup({
      fullName: profileForm.fullName,
      nickname,
      birthday: profileForm.birthday,
      jobRole: profileForm.jobRole,
      jobTitle: profileForm.jobTitle,
    });

    if (avatarFile.value) {
      await updateAccountAvatar(avatarFile.value);
    }

    signupCompleted.value = true;
    await loadInviteDetails();
  } catch (error) {
    logger.error`Profile submission failed: ${error}`;
    profileError.value = "プロフィールの保存に失敗しました。";
  } finally {
    profileLoading.value = false;
  }
};

const handleAvatarChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  avatarFile.value = file;

  if (file) {
    avatarPreview.value = URL.createObjectURL(file);
  } else {
    avatarPreview.value = null;
  }
};

const hydrateProfileFromUser = (current = user.value) => {
  if (!current) return;

  if (!profileForm.fullName && current.displayName) {
    profileForm.fullName = current.displayName;
  }

  if (!profileForm.nickname && current.displayName) {
    profileForm.nickname = current.displayName;
  }
};

function buildNickname(fullName: string, nickname?: string) {
  const trimmed = nickname?.trim();
  if (trimmed) {
    return trimmed;
  }

  const tokens = fullName.trim().split(/\s+/).filter(Boolean);

  if (tokens.length >= 2) {
    return `${extractInitial(tokens[0] ?? fullName)}${extractInitial(tokens[1] ?? tokens[0] ?? fullName)}`;
  }

  const initial = extractInitial(fullName);
  return initial.padEnd(2, initial);
}

function extractInitial(value: string) {
  const ascii = value.match(/[A-Za-z]/);
  if (ascii) {
    return ascii[0].toUpperCase();
  }
  return value.trim().charAt(0).toUpperCase() || "U";
}

function mapFirebaseError(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    const code = String((error as { code?: string }).code);
    if (code === "auth/email-already-in-use")
      return "このメールアドレスは既に登録されています。";
    if (code === "auth/invalid-email")
      return "メールアドレスの形式を確認してください。";
    if (code === "auth/weak-password")
      return "パスワードは 6 文字以上で設定してください。";
  }
  return "リクエストを処理できませんでした。時間を置いて再度お試しください。";
}

async function ensureAuthenticatedUser() {
  const currentUser = user.value ?? (await getCurrentUser());
  if (currentUser) return currentUser;

  if (authMode.value !== "login") {
    throw new Error("アカウント作成を完了してください。");
  }
  if (!emailInput.value.trim() || !passwordAuthInput.value.trim()) {
    throw new Error("メールアドレスとパスワードを入力してください。");
  }
  await loginWithEmail({
    email: emailInput.value.trim(),
    password: passwordAuthInput.value.trim(),
  });

  const authed = await getCurrentUser();
  if (!authed) {
    throw new Error("認証に失敗しました。");
  }
  return authed;
}

async function handleJoin() {
  if (!projectPreview.value && !authRequired.value) return;
  if (projectPreview.value && !canJoin.value) return;
  if (
    projectPreview.value &&
    requiresPassword.value &&
    !passwordInput.value.trim()
  ) {
    errorMsg.value = "パスワードを入力してください。";
    return;
  }
  if (
    authMode.value === "signup" &&
    signupFlowActive.value &&
    !signupCompleted.value
  ) {
    errorMsg.value = "アカウント作成を完了してください。";
    return;
  }

  joinProcessing.value = true;
  errorMsg.value = "";
  try {
    const needsAuth = authRequired.value && !user.value;
    const inviteUser = await ensureAuthenticatedUser();
    await loadInviteDetails();
    if (needsAuth) {
      if (projectPreview.value) {
        successMsg.value = "招待情報を読み込みました。内容を確認してください。";
      } else {
        errorMsg.value = "招待情報を読み込めませんでした。";
      }
      return;
    }
    if (!canJoin.value) {
      errorMsg.value = "再確認の結果、この招待リンクは利用できません。";
      return;
    }
    const fallbackEmail =
      credentialForm.email.trim() || emailInput.value.trim();
    const projectId = await redeemInvite(
      token,
      inviteUser.uid,
      inviteUser.email ?? fallbackEmail,
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
  <div class="signup-shell">
    <section class="signup-card">
      <AuthBrand
        title="プロジェクトへの招待"
        description="招待内容を確認して参加しましょう"
      />

      <div v-if="loading" class="invite-loading">読み込み中...</div>
      <p v-else-if="errorMsg && !showAuthGate" class="form-error">
        {{ errorMsg }}
      </p>

      <template v-else>
        <div class="invite-content">
          <p v-if="errorMsg" class="form-error">{{ errorMsg }}</p>

          <template v-if="projectPreview">
            <p class="invite-lead">以下のプロジェクトに参加しますか？</p>
            <dl class="invite-details">
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

            <div v-if="requiresPassword" class="invite-password">
              <AuthFormField
                v-model="passwordInput"
                label="参加パスワード"
                type="password"
                placeholder="リンク作成時のパスワードを入力"
              />
            </div>
          </template>

          <div v-if="showAuthGate" class="invite-auth">
            <template v-if="authMode === 'login'">
              <form class="signup-form" @submit.prevent="handleJoin">
                <AuthCredentialFields
                  variant="invite"
                  v-model:email="emailInput"
                  v-model:password="passwordAuthInput"
                />
                <p class="auth-switch">
                  <button
                    type="button"
                    class="text-link"
                    @click="authMode = 'signup'"
                  >
                    アカウントをお持ちでない場合はこちら
                  </button>
                </p>
              </form>
            </template>
            <template v-else>
              <div class="signup-progress">
                <div class="signup-progress__labels">
                  <span
                    >ステップ {{ currentStepIndex + 1 }} /
                    {{ stepOrder.length }}</span
                  >
                  <span>{{ stepLabels[signUpStep] }}</span>
                </div>
                <div class="signup-progress__bar">
                  <div
                    class="signup-progress__value"
                    :style="{ width: `${progressPercent}%` }"
                  />
                </div>
              </div>

              <Transition name="slide-fade" mode="out-in">
                <form
                  v-if="signUpStep === 'credentials'"
                  key="credentials"
                  class="signup-form"
                  @submit.prevent="handleCredentialSubmit"
                >
                  <AuthCredentialFields
                    variant="invite"
                    v-model:email="credentialForm.email"
                    v-model:password="credentialForm.password"
                    v-model:confirm="credentialConfirm"
                    :show-confirm="true"
                    password-placeholder="8文字以上"
                    password-hint="8文字以上、英数字を含む"
                  />

                  <p v-if="credentialError" class="form-error">
                    {{ credentialError }}
                  </p>

                  <AppButton
                    type="submit"
                    variant="primary"
                    block
                    :disabled="!credentialValid || credentialLoading"
                    :loading="credentialLoading"
                  >
                    認証メールを送信
                  </AppButton>
                </form>

                <div
                  v-else-if="signUpStep === 'verify'"
                  key="verify"
                  class="verify-step"
                >
                  <p>
                    <strong>{{ credentialEmail }}</strong>
                    宛に認証メールを送信しました。受信ボックスからリンクをクリックして認証を完了してください。
                  </p>
                  <p v-if="verificationMessage" class="verify-step__message">
                    {{ verificationMessage }}
                  </p>
                  <p v-if="verificationError" class="form-error">
                    {{ verificationError }}
                  </p>
                  <div class="verify-step__actions">
                    <AppButton
                      type="button"
                      variant="secondary"
                      :disabled="resendLoading"
                      :loading="resendLoading"
                      @click="handleResend"
                    >
                      認証メールを再送
                    </AppButton>
                    <AppButton
                      type="button"
                      variant="primary"
                      :disabled="verificationChecking"
                      :loading="verificationChecking"
                      @click="checkVerificationStatus"
                    >
                      認証を確認
                    </AppButton>
                  </div>
                </div>

                <form
                  v-else
                  key="profile"
                  class="signup-form"
                  @submit.prevent="handleProfileSubmit"
                >
                  <AuthFormField
                    v-model="profileForm.fullName"
                    label="本名"
                    type="text"
                    placeholder="山田 太郎"
                    required
                  />

                  <AuthFormField
                    v-model="profileForm.nickname"
                    label="ニックネーム (任意)"
                    type="text"
                    placeholder="任意で入力"
                  />

                  <AuthFormField
                    v-model="profileForm.birthday"
                    label="生年月日"
                    type="date"
                    required
                  />

                  <div class="job-field">
                    <label class="job-field__label" for="jobRole">職業</label>
                    <select id="jobRole" v-model="profileForm.jobRole" required>
                      <option
                        v-for="option in jobOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </div>

                  <AuthFormField
                    v-model="profileForm.jobTitle"
                    label="役職 (任意)"
                    type="text"
                    placeholder="例: プロジェクトマネージャー"
                  />

                  <div class="avatar-field">
                    <span>アイコン</span>
                    <label class="avatar-field__upload">
                      <input
                        type="file"
                        accept="image/*"
                        @change="handleAvatarChange"
                      />
                      画像を選択
                    </label>
                    <p class="avatar-field__hint">
                      アップロードは任意です。PNG / JPG / WEBP
                      などに対応しています。
                    </p>
                    <div v-if="avatarPreview" class="avatar-field__preview">
                      <img :src="avatarPreview" alt="アイコンのプレビュー" />
                    </div>
                  </div>

                  <p v-if="profileError" class="form-error">
                    {{ profileError }}
                  </p>

                  <AppButton
                    type="submit"
                    variant="primary"
                    block
                    :disabled="!profileValid || profileLoading"
                    :loading="profileLoading"
                  >
                    プロフィールを登録
                  </AppButton>
                </form>
              </Transition>
              <p class="auth-switch">
                <button
                  type="button"
                  class="text-link"
                  @click="authMode = 'login'"
                >
                  アカウントがある場合はこちら
                </button>
              </p>
            </template>
          </div>

          <div v-if="successMsg" class="invite-success">{{ successMsg }}</div>

          <div class="actions">
            <AppButton
              v-if="showJoinButton"
              variant="primary"
              :loading="joinProcessing || loading"
              :disabled="!canProceed"
              @click="handleJoin"
            >
              {{ user || signupCompleted ? "参加する" : "ログインして参加" }}
            </AppButton>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.signup-shell {
  min-height: calc(100vh - 4rem);
  background: linear-gradient(
    135deg,
    rgba(184, 227, 233, 0.35),
    var(--ui-surface, #fff),
    rgba(147, 177, 181, 0.35)
  );
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-8, 2rem) var(--ui-space-4, 1rem);
}

@supports (min-height: 100dvh) {
  .signup-shell {
    min-height: calc(100dvh - 4rem);
  }
}

.signup-card {
  width: min(500px, 100%);
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-2xl, 1.5rem);
  padding: var(--ui-space-10, 2.5rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-2xl);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
}

.invite-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.invite-loading {
  color: var(--ui-brand-600, #4f7c82);
  font-weight: var(--ui-font-semibold, 600);
}

.invite-lead {
  color: var(--ui-brand-600, #4f7c82);
  font-weight: var(--ui-font-semibold, 600);
  margin: 0;
}

.invite-details {
  margin: 0;
  display: grid;
  gap: var(--ui-space-2, 0.5rem);
}

.invite-details dt {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-brand-600, #4f7c82);
}

.invite-details dd {
  margin: 0;
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.invite-auth {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.signup-progress {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.signup-progress__labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-brand-600, #4f7c82);
  font-weight: var(--ui-font-semibold, 600);
}

.signup-progress__bar {
  width: 100%;
  height: 0.4rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-border, rgba(11, 46, 51, 0.12));
  overflow: hidden;
}

.signup-progress__value {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--ui-brand-600, #4f7c82),
    var(--ui-brand-900, #0b2e33)
  );
  border-radius: var(--ui-radius-full, 9999px);
  transition: width var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.signup-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.auth-switch {
  text-align: center;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-brand-600, #4f7c82);
  margin: 0;
}

.text-link {
  border: none;
  background: none;
  padding: 0;
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-brand-600, #4f7c82);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.text-link:hover {
  color: var(--ui-brand-900, #0b2e33);
}

.text-link:focus {
  outline: none;
}

.verify-step {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  text-align: left;
  color: var(--ui-brand-600, #4f7c82);
}

.verify-step__message {
  color: var(--ui-brand-900, #0b2e33);
  font-weight: var(--ui-font-semibold, 600);
}

.verify-step__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-3, 0.75rem);
}

.avatar-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.avatar-field__upload {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  border: 1px dashed var(--ui-border-strong, rgba(11, 46, 51, 0.2));
  border-radius: var(--ui-radius-md, 0.75rem);
  color: var(--ui-brand-600, #4f7c82);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.avatar-field__upload:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-brand-100, #e5f6f8);
}

.avatar-field__upload input {
  display: none;
}

.avatar-field__hint {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.job-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.job-field__label {
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
  font-size: var(--ui-text-sm, 0.875rem);
}

.job-field select {
  border: 1px solid var(--ui-border-strong, rgba(11, 46, 51, 0.2));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  font-size: var(--ui-text-base, 1rem);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  transition: var(--ui-transition-colors);
}

.job-field select:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.avatar-field__preview img {
  width: 72px;
  height: 72px;
  border-radius: var(--ui-radius-full, 9999px);
  object-fit: cover;
  border: 2px solid var(--ui-brand-200, #b8e3e9);
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.invite-success {
  color: var(--ui-brand-900, #0b2e33);
  font-weight: var(--ui-font-semibold, 600);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-3, 0.75rem);
  justify-content: flex-end;
}

.form-error {
  background: var(--ui-danger-bg, rgba(214, 69, 69, 0.08));
  border: 1px solid rgba(214, 69, 69, 0.35);
  color: var(--ui-danger, #d64545);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
}

.invite-password :deep(.auth-field) {
  margin-bottom: 0;
}

@media (max-width: 600px) {
  .signup-card {
    padding: var(--ui-space-8, 2rem) var(--ui-space-6, 1.5rem);
  }

  .verify-step__actions {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .actions {
    justify-content: stretch;
  }

  .actions :deep(.app-button) {
    width: 100%;
  }
}
</style>
