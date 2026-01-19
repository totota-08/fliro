<script setup lang="ts">
/**
 * AccountSettingsPage.vue - アカウント設定ページ
 *
 * プロフィール編集、アバター変更、アカウント削除などを行うページ
 */
import DangerZone from "@/components/ui/DangerZone.vue";
import ConfirmDangerModal from "@/components/modals/ConfirmDangerModal.vue";
import MFAEnrollmentModal from "@/components/modals/MFAEnrollmentModal.vue";
import AppButton from "@/components/ui/AppButton.vue";
import SectionCard from "@/components/ui/SectionCard.vue";
import UserAvatar from "@/components/common/UserAvatar.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import AppShell from "@/layouts/AppShell.vue";
import {
  removeAccountWithPassword,
  updateAccountAvatar,
  updateProfile,
} from "@/services/accountActions";
import {
  enrollTOTP,
  generateTOTPSecret,
  getMFAEnrollmentStatus,
  startMFAEnrollment,
  unenrollMFA,
} from "@/firebase/authService";
import { useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

// Konami code sequence: ↑ ↑ ↓ ↓ ← → ← → B A
const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
];

const logger = getLogger("app.pages.account.AccountSettingsPage");
const router = useRouter();
const { user, profile } = useAuthStore();

// Profile editing state
const isEditingProfile = ref(false);
const editNickname = ref("");
const editFullName = ref("");
const profileSaving = ref(false);
const profileError = ref("");

// Avatar upload state
const avatarUploading = ref(false);
const avatarMessage = ref("");

// Account deletion state
const showDeleteModal = ref(false);
const deleteLoading = ref(false);
const deleteError = ref("");

// MFA state
const mfaEnrolled = ref(false);
const mfaFactors = ref<
  Array<{
    uid: string;
    displayName: string | null;
    factorId: string;
    enrollmentTime: string;
  }>
>([]);
const mfaLoading = ref(false);
const showMFAEnrollmentModal = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const totpSecret = ref<any>(null);
const qrCodeUrl = ref("");
const mfaError = ref("");

// Konami code tracking
const konamiIndex = ref(0);

// Computed
const avatarUrl = computed(
  () => profile.value?.avatarUrl || user.value?.photoURL || "",
);

// Profile editing functions
function startEditProfile() {
  editNickname.value = profile.value?.nickname || "";
  editFullName.value = profile.value?.fullName || "";
  profileError.value = "";
  isEditingProfile.value = true;
}

function cancelEditProfile() {
  isEditingProfile.value = false;
  profileError.value = "";
}

async function saveProfile() {
  if (profileSaving.value) return;

  profileSaving.value = true;
  profileError.value = "";
  try {
    await updateProfile({
      nickname: editNickname.value.trim(),
      fullName: editFullName.value.trim(),
    });
    isEditingProfile.value = false;
  } catch (error) {
    logger.error`Profile update failed: ${error}`;
    profileError.value = "プロフィールの更新に失敗しました。";
  } finally {
    profileSaving.value = false;
  }
}

// Avatar upload
async function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  avatarMessage.value = "";

  if (!file) return;

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    avatarMessage.value = "ファイルサイズは5MB以下にしてください。";
    input.value = "";
    return;
  }

  avatarUploading.value = true;
  try {
    await updateAccountAvatar(file);
    avatarMessage.value = "アイコンを更新しました。";
  } catch (error) {
    logger.error`Avatar upload failed: ${error}`;
    avatarMessage.value = "アイコンのアップロードに失敗しました。";
  } finally {
    avatarUploading.value = false;
    input.value = "";
  }
}

// Account deletion
function openDeleteModal() {
  deleteError.value = "";
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
  deleteError.value = "";
}

async function handleDeleteAccount(password: string) {
  if (deleteLoading.value) return;

  deleteLoading.value = true;
  deleteError.value = "";
  try {
    await removeAccountWithPassword(password);
    await router.push({ name: ROUTE_NAMES.login });
  } catch (error: unknown) {
    logger.error`Account deletion failed: ${error}`;
    const firebaseError = error as { code?: string };
    if (
      firebaseError?.code === "auth/wrong-password" ||
      firebaseError?.code === "auth/invalid-credential"
    ) {
      deleteError.value = "パスワードが正しくありません。";
    } else if (firebaseError?.code === "auth/too-many-requests") {
      deleteError.value =
        "試行回数が多すぎます。しばらく待ってから再度お試しください。";
    } else {
      deleteError.value =
        "アカウントを削除できませんでした。再度お試しください。";
    }
  } finally {
    deleteLoading.value = false;
  }
}

// MFA functions
async function loadMFAStatus() {
  mfaLoading.value = true;
  mfaError.value = "";
  try {
    const status = await getMFAEnrollmentStatus();
    mfaEnrolled.value = status.enrolled;
    mfaFactors.value = status.factors;
  } catch (error) {
    logger.error`Failed to load MFA status: ${error}`;
    mfaError.value = "MFA設定の読み込みに失敗しました。";
  } finally {
    mfaLoading.value = false;
  }
}

async function startMFASetup() {
  mfaLoading.value = true;
  mfaError.value = "";
  try {
    const session = await startMFAEnrollment();
    const secret = await generateTOTPSecret(session);
    totpSecret.value = secret;

    // Generate QR code URL
    const issuer = "Fliro";
    const accountName = user.value?.email || "user";
    const otpauthUrl = secret.generateQrCodeUrl(accountName, issuer);
    qrCodeUrl.value = otpauthUrl;

    showMFAEnrollmentModal.value = true;
  } catch (error) {
    logger.error`Failed to start MFA enrollment: ${error}`;
    mfaError.value = "MFA設定の開始に失敗しました。";
  } finally {
    mfaLoading.value = false;
  }
}

async function completeMFAEnrollment(
  verificationCode: string,
  displayName: string,
) {
  if (!totpSecret.value) {
    mfaError.value = "TOTP秘密鍵が見つかりません。";
    return;
  }

  mfaLoading.value = true;
  mfaError.value = "";
  try {
    await enrollTOTP(totpSecret.value, verificationCode, displayName);
    showMFAEnrollmentModal.value = false;
    totpSecret.value = null;
    qrCodeUrl.value = "";
    await loadMFAStatus();
  } catch (error) {
    logger.error`Failed to complete MFA enrollment: ${error}`;
    mfaError.value = "認証コードが正しくありません。もう一度お試しください。";
  } finally {
    mfaLoading.value = false;
  }
}

function closeMFAEnrollmentModal() {
  showMFAEnrollmentModal.value = false;
  totpSecret.value = null;
  qrCodeUrl.value = "";
  mfaError.value = "";
}

async function removeMFA(factorUid: string) {
  if (!confirm("二段階認証を解除してもよろしいですか？")) {
    return;
  }

  mfaLoading.value = true;
  mfaError.value = "";
  try {
    await unenrollMFA(factorUid);
    await loadMFAStatus();
  } catch (error) {
    logger.error`Failed to unenroll MFA: ${error}`;
    mfaError.value = "二段階認証の解除に失敗しました。";
  } finally {
    mfaLoading.value = false;
  }
}

// Konami code handler
function handleKeyDown(event: KeyboardEvent) {
  const expectedKey = KONAMI_CODE[konamiIndex.value];
  if (event.code === expectedKey) {
    konamiIndex.value++;
    if (konamiIndex.value === KONAMI_CODE.length) {
      // Konami code completed!
      konamiIndex.value = 0;
      router.push({ name: ROUTE_NAMES.secretAccess });
    }
  } else {
    // Reset if wrong key
    konamiIndex.value = 0;
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  loadMFAStatus();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <AppShell>
    <div class="account-settings">
      <!-- Header -->
      <SectionCard
        title="アカウント設定"
        subtitle="プロフィールやアカウントの設定"
      >
        <template #headerActions>
          <AppButton
            variant="outline"
            size="sm"
            :to="{ name: ROUTE_NAMES.myPage }"
          >
            ← マイページに戻る
          </AppButton>
        </template>
      </SectionCard>

      <!-- Profile Section -->
      <SectionCard
        title="プロフィール"
        subtitle="表示名やアイコンを変更できます"
      >
        <div class="profile-section">
          <!-- Avatar -->
          <div class="profile-section__avatar">
            <div class="profile-section__avatar-wrapper">
              <UserAvatar
                :url="avatarUrl"
                :name="profile?.nickname || profile?.fullName"
                :size="80"
              />
              <label
                class="profile-section__avatar-upload"
                :class="{ 'is-uploading': avatarUploading }"
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  :disabled="avatarUploading"
                  @change="handleAvatarChange"
                />
                <span
                  class="profile-section__avatar-upload-icon"
                  aria-hidden="true"
                >
                  {{ avatarUploading ? "..." : "📷" }}
                </span>
              </label>
            </div>
            <p
              v-if="avatarMessage"
              class="profile-section__avatar-message"
              :class="{ 'is-error': avatarMessage.includes('失敗') }"
            >
              {{ avatarMessage }}
            </p>
          </div>

          <!-- Profile Info / Edit Form -->
          <div class="profile-section__content">
            <template v-if="!isEditingProfile">
              <div class="profile-section__info">
                <div class="profile-section__field">
                  <span class="profile-section__label">ニックネーム</span>
                  <span class="profile-section__value">
                    {{ profile?.nickname || "未設定" }}
                  </span>
                </div>
                <div class="profile-section__field">
                  <span class="profile-section__label">本名</span>
                  <span class="profile-section__value">
                    {{ profile?.fullName || "未設定" }}
                  </span>
                </div>
                <div class="profile-section__field">
                  <span class="profile-section__label">メールアドレス</span>
                  <span
                    class="profile-section__value profile-section__value--muted"
                  >
                    {{ profile?.email }}
                  </span>
                </div>
              </div>
              <div class="profile-section__actions">
                <AppButton
                  variant="primary"
                  size="sm"
                  @click="startEditProfile"
                >
                  プロフィールを編集
                </AppButton>
              </div>
            </template>

            <template v-else>
              <div class="profile-section__edit-form">
                <div class="profile-section__edit-field">
                  <label for="edit-nickname">ニックネーム</label>
                  <input
                    id="edit-nickname"
                    v-model="editNickname"
                    type="text"
                    placeholder="ニックネームを入力"
                  />
                </div>
                <div class="profile-section__edit-field">
                  <label for="edit-fullname">本名</label>
                  <input
                    id="edit-fullname"
                    v-model="editFullName"
                    type="text"
                    placeholder="本名を入力"
                  />
                </div>
                <p v-if="profileError" class="profile-section__error">
                  {{ profileError }}
                </p>
                <div class="profile-section__edit-actions">
                  <AppButton
                    variant="secondary"
                    size="sm"
                    :disabled="profileSaving"
                    @click="cancelEditProfile"
                  >
                    キャンセル
                  </AppButton>
                  <AppButton
                    variant="primary"
                    size="sm"
                    :loading="profileSaving"
                    @click="saveProfile"
                  >
                    保存
                  </AppButton>
                </div>
              </div>
            </template>
          </div>
        </div>
      </SectionCard>

      <!-- Security Section - MFA -->
      <SectionCard
        title="セキュリティ"
        subtitle="二段階認証を設定してアカウントを保護"
      >
        <div class="security-section">
          <div class="security-section__info">
            <div class="security-section__header">
              <h3 class="security-section__title">二段階認証（2FA）</h3>
              <span
                v-if="mfaEnrolled"
                class="security-section__badge security-section__badge--enabled"
              >
                有効
              </span>
              <span v-else class="security-section__badge">無効</span>
            </div>
            <p class="security-section__description">
              二段階認証を有効にすると、ログイン時にパスワードに加えて認証アプリから生成される6桁のコードが必要になります。
            </p>

            <div v-if="mfaFactors.length > 0" class="mfa-factors">
              <h4 class="mfa-factors__title">登録済みの認証方法</h4>
              <div
                v-for="factor in mfaFactors"
                :key="factor.uid"
                class="mfa-factor"
              >
                <div class="mfa-factor__info">
                  <span class="mfa-factor__name">
                    {{ factor.displayName || "認証アプリ" }}
                  </span>
                  <span class="mfa-factor__type">
                    {{
                      factor.factorId === "totp"
                        ? "TOTP（認証アプリ）"
                        : factor.factorId
                    }}
                  </span>
                </div>
                <AppButton
                  variant="danger"
                  size="sm"
                  :disabled="mfaLoading"
                  @click="removeMFA(factor.uid)"
                >
                  解除
                </AppButton>
              </div>
            </div>

            <p v-if="mfaError" class="security-section__error">
              {{ mfaError }}
            </p>
          </div>

          <div class="security-section__actions">
            <AppButton
              v-if="!mfaEnrolled"
              variant="primary"
              :loading="mfaLoading"
              @click="startMFASetup"
            >
              二段階認証を設定
            </AppButton>
            <AppButton
              v-else
              variant="secondary"
              :loading="mfaLoading"
              @click="startMFASetup"
            >
              新しい認証方法を追加
            </AppButton>
          </div>
        </div>
      </SectionCard>

      <!-- Danger Zone - Account Deletion -->
      <DangerZone
        title="危険な操作"
        summary="アカウントの削除など、取り消しできない操作を行えます"
      >
        <div class="danger-content">
          <div class="danger-content__info">
            <p class="danger-content__title">アカウントを削除</p>
            <p class="danger-content__description">
              アカウントを削除すると、すべてのデータが完全に削除されます。この操作は取り消せません。
            </p>
          </div>
          <AppButton variant="danger" size="sm" @click="openDeleteModal">
            アカウントを削除
          </AppButton>
        </div>
      </DangerZone>
    </div>

    <!-- Delete Account Modal -->
    <ConfirmDangerModal
      :open="showDeleteModal"
      title="アカウントの削除"
      warning-message="アカウントを削除すると、すべてのデータが完全に削除され、復元することはできません。"
      input-label="続行するには、パスワードを入力してください"
      input-placeholder="パスワードを入力"
      input-type="password"
      confirm-label="削除する"
      cancel-label="キャンセル"
      :loading="deleteLoading"
      :error="deleteError"
      @close="closeDeleteModal"
      @confirm="handleDeleteAccount"
    />

    <!-- MFA Enrollment Modal -->
    <MFAEnrollmentModal
      :open="showMFAEnrollmentModal"
      :totp-secret="totpSecret"
      :qr-code-url="qrCodeUrl"
      @close="closeMFAEnrollmentModal"
      @confirm="completeMFAEnrollment"
    />
  </AppShell>
</template>

<style scoped>
.account-settings {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
}

/* Profile Section */
.profile-section {
  display: flex;
  gap: var(--ui-space-6, 1.5rem);
  align-items: flex-start;
}

.profile-section__avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
}

.profile-section__avatar-wrapper {
  position: relative;
}

.profile-section__avatar-upload {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ui-brand-600, #4f7c82);
  border: 2px solid var(--ui-surface, #fff);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.profile-section__avatar-upload:hover {
  background: var(--ui-brand-700, #1a4a51);
}

.profile-section__avatar-upload.is-uploading {
  opacity: 0.6;
  cursor: not-allowed;
}

.profile-section__avatar-upload input {
  display: none;
}

.profile-section__avatar-upload-icon {
  font-size: 14px;
}

.profile-section__avatar-message {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-success, #16a34a);
  margin: 0;
  text-align: center;
}

.profile-section__avatar-message.is-error {
  color: var(--ui-danger, #d64545);
}

.profile-section__content {
  flex: 1;
}

.profile-section__info {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.profile-section__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.profile-section__label {
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.profile-section__value {
  font-size: var(--ui-text-base, 1rem);
  color: var(--ui-text, #0b2e33);
}

.profile-section__value--muted {
  color: var(--ui-text-muted, #64748b);
}

.profile-section__actions {
  margin-top: var(--ui-space-4, 1rem);
}

/* Edit Form */
.profile-section__edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.profile-section__edit-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.profile-section__edit-field label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
}

.profile-section__edit-field input {
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface, #fff);
  transition: var(--ui-transition-colors);
}

.profile-section__edit-field input:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.profile-section__error {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger, #d64545);
}

.profile-section__edit-actions {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  margin-top: var(--ui-space-2, 0.5rem);
}

/* Danger Zone Content */
.danger-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
}

.danger-content__info {
  flex: 1;
}

.danger-content__title {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.danger-content__description {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

/* Security Section */
.security-section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.security-section__info {
  flex: 1;
}

.security-section__header {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  margin-bottom: var(--ui-space-2, 0.5rem);
}

.security-section__title {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.security-section__badge {
  display: inline-flex;
  align-items: center;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-medium, 500);
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-surface-secondary, #f8f9fa);
  color: var(--ui-text-muted, #64748b);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

.security-section__badge--enabled {
  background: var(--ui-success-light, #dcfce7);
  color: var(--ui-success, #16a34a);
  border-color: var(--ui-success, #16a34a);
}

.security-section__description {
  margin: 0 0 var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: 1.5;
}

.security-section__error {
  margin: var(--ui-space-2, 0.5rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger, #d64545);
}

.security-section__actions {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
}

/* MFA Factors */
.mfa-factors {
  margin-top: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-surface-secondary, #f8f9fa);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

.mfa-factors__title {
  margin: 0 0 var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
}

.mfa-factor {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem);
  background: var(--ui-surface, #fff);
  border-radius: var(--ui-radius-sm, 0.5rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

.mfa-factor + .mfa-factor {
  margin-top: var(--ui-space-2, 0.5rem);
}

.mfa-factor__info {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.mfa-factor__name {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
}

.mfa-factor__type {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

/* Responsive */
@media (max-width: 768px) {
  .profile-section {
    flex-direction: column;
    align-items: center;
  }

  .profile-section__content {
    width: 100%;
    text-align: center;
  }

  .profile-section__info {
    align-items: center;
  }

  .profile-section__actions {
    display: flex;
    justify-content: center;
  }

  .profile-section__edit-actions {
    justify-content: center;
  }

  .danger-content {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }

  .security-section__actions {
    flex-direction: column;
  }

  .mfa-factor {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
