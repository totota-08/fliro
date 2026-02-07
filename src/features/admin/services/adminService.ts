import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type {
  AdminUserInfo,
  InvitationCode,
  AdminFunctionResponse,
  MaintenanceConfig,
  AnnouncementConfig,
  SampleProjectConfig,
} from "../types/admin";

// ユーザー検索
export async function searchUsers(
  query: string,
  limit = 20,
): Promise<AdminUserInfo[]> {
  const fn = httpsCallable<
    { query: string; limit: number },
    { users: AdminUserInfo[] }
  >(functions, "adminSearchUsers");
  const result = await fn({ query, limit });
  return result.data.users;
}

// 管理者権限の設定
export async function setUserAdmin(
  targetUid: string,
  grant: boolean,
): Promise<AdminFunctionResponse> {
  const fn = httpsCallable<
    { targetUid: string; grant: boolean },
    AdminFunctionResponse
  >(functions, "adminSetUserAdmin");
  const result = await fn({ targetUid, grant });
  return result.data;
}

// 招待コード作成
export async function createInviteCode(params: {
  maxUses?: number;
  expiresAt?: string;
  note?: string;
}): Promise<AdminFunctionResponse<{ code: string }>> {
  const fn = httpsCallable<
    typeof params,
    AdminFunctionResponse<{ code: string }>
  >(functions, "adminCreateInviteCode");
  const result = await fn(params);
  return result.data;
}

// 招待コード一覧
export async function listInviteCodes(params?: {
  status?: string;
  limit?: number;
}): Promise<InvitationCode[]> {
  const fn = httpsCallable<typeof params, { codes: InvitationCode[] }>(
    functions,
    "adminListInviteCodes",
  );
  const result = await fn(params ?? {});
  return result.data.codes;
}

// アプリ設定更新
export async function updateAppConfig(
  configType: "maintenance" | "announcement" | "sampleProject",
  config:
    | Partial<MaintenanceConfig>
    | Partial<AnnouncementConfig>
    | Partial<SampleProjectConfig>,
): Promise<AdminFunctionResponse> {
  const fn = httpsCallable<
    { configType: string; config: object },
    AdminFunctionResponse
  >(functions, "adminUpdateAppConfig");
  const result = await fn({ configType, config });
  return result.data;
}
