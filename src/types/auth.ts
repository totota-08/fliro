export interface UserProfile {
  uid: string
  email: string
  fullName: string
  nickname: string
  birthday: string
  avatarUrl: string
  createdAt: string
  updatedAt: string
}

export interface CredentialSignUpPayload {
  email: string
  password: string
}

export interface ProfileSetupPayload {
  fullName: string
  nickname?: string
  birthday?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export type SocialProvider = 'google' | 'github'
