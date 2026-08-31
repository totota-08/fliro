export interface UserProfile {
  uid: string;
  email: string;
  emailLower?: string;
  fullName: string;
  nickname: string;
  birthday: string;
  avatarUrl: string;
  jobRole: string;
  jobTitle: string;
  createdAt: string;
  updatedAt: string;
  setUp: boolean;
  // ベータアクセス関連（Cloud Functionsから設定）
  betaAccess?: boolean;
  betaCodeUsed?: string;
  betaAccessAt?: string;
  // 招待コード使用済みフラグ
  hasUsedInviteCode: boolean;
  // 管理者権限（Firebase Custom Claimsから取得）
  isAdmin?: boolean;
  // プロジェクト内でアバター画像を非表示にする（trueの場合はイニシャルを表示）
  hideAvatarInProjects?: boolean;
}

export interface CredentialSignUpPayload {
  email: string;
  password: string;
}

export interface ProfileSetupPayload {
  fullName: string;
  nickname?: string;
  birthday?: string;
  jobRole: string;
  jobTitle?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type SocialProvider = "google" | "github";

/**
 * 連携済みプロバイダー情報
 */
export interface LinkedProvider {
  providerId: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  uid: string;
}

/**
 * プロバイダーID定数（FirebaseのproviderIdに対応）
 */
export const PROVIDER_IDS = {
  GOOGLE: "google.com",
  GITHUB: "github.com",
  PASSWORD: "password",
} as const;
