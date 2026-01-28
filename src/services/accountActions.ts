import {
  applyEmailVerificationCode,
  confirmPasswordResetWithCode,
  deleteAccountWithPassword,
  deleteCurrentAccount,
  loginWithEmail,
  loginWithProvider,
  saveProfileDetails,
  sendPasswordReset,
  updateUserProfile,
  uploadAvatar,
} from "@/firebase/authService";
import { setProfile } from "@/store/auth";
import type {
  LoginPayload,
  ProfileSetupPayload,
  SocialProvider,
} from "@/types/auth";

export async function authenticateWithEmail(payload: LoginPayload) {
  const profile = await loginWithEmail(payload);
  setProfile(profile);
  return profile;
}

export async function authenticateWithProvider(provider: SocialProvider) {
  const profile = await loginWithProvider(provider);
  setProfile(profile);
  return profile;
}

export async function completeProfileSetup(payload: ProfileSetupPayload) {
  const profile = await saveProfileDetails(payload);
  setProfile(profile);
  return profile;
}

export async function updateAccountAvatar(file: File) {
  const profile = await uploadAvatar(file);
  setProfile(profile);
  return profile;
}

export async function removeAccount(): Promise<void> {
  await deleteCurrentAccount();
  setProfile(null);
}

export async function removeAccountWithPassword(
  password: string,
): Promise<void> {
  await deleteAccountWithPassword(password);
  setProfile(null);
}

export async function updateProfile(payload: {
  nickname?: string;
  fullName?: string;
  hideAvatarInProjects?: boolean;
}) {
  const profile = await updateUserProfile(payload);
  setProfile(profile);
  return profile;
}

export function requestPasswordReset(email: string) {
  return sendPasswordReset(email);
}

export function verifyEmailWithCode(oobCode: string) {
  return applyEmailVerificationCode(oobCode);
}

export function finalizePasswordReset(oobCode: string, newPassword: string) {
  return confirmPasswordResetWithCode(oobCode, newPassword);
}
