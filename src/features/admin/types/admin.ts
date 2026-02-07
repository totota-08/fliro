import type { Timestamp } from "firebase/firestore";

// メンテナンス設定
export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  allowedAdminUids: string[];
  updatedAt: Timestamp;
  updatedBy: string;
}

// 通知設定
export interface AnnouncementConfig {
  enabled: boolean;
  message: string;
  type: "info" | "warning" | "danger";
  link?: string;
  linkText?: string;
  dismissible: boolean;
  updatedAt: Timestamp;
  updatedBy: string;
}

// サンプルプロジェクト設定
export interface SampleProjectConfig {
  projectId: string;
  projectName: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// 招待コード（Cloud Functionsから返される形式）
// Cloud FunctionsはJSON経由で返すためTimestampではなくISO文字列
export interface InvitationCode {
  id: string;
  code: string;
  status: "active" | "used" | "expired" | "revoked";
  maxUses: number | null;
  usedCount: number;
  usedBy: string[];
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
  note?: string;
}

// ユーザー検索結果
export interface AdminUserInfo {
  uid: string;
  email: string;
  nickname: string;
  fullName: string;
  avatarUrl: string;
  isAdmin: boolean;
  hasMFA: boolean;
  createdAt: string;
}

// 管理者セッション
export interface AdminSession {
  verified: boolean;
  verifiedAt: number | null;
  expiresAt: number | null;
}

// Cloud Function レスポンス型
export interface AdminFunctionResponse<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}
