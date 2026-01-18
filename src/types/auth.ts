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
