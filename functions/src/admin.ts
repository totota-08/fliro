/**
 * 管理者用 Cloud Functions
 *
 * 管理者権限を持つユーザーのみが実行可能な機能
 * - adminSearchUsers: ユーザー検索
 * - adminSetUserAdmin: 管理者権限の付与・剥奪
 * - adminCreateInviteCode: 招待コード生成
 * - adminListInviteCodes: 招待コード一覧
 * - adminUpdateAppConfig: アプリ設定更新
 */
import * as admin from "firebase-admin";
import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

// admin.initializeApp() は validateInviteCode.ts で既に呼ばれているため省略
// 複数回呼ぶとエラーになるので、初期化済みかチェック
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// CORS設定（共通）
const corsConfig = [
  "https://fliro.work",
  "https://fliro-cbai.vercel.app",
  "https://fliro-livid.vercel.app",
  "http://localhost:5173",
];

// 共通の関数設定
const functionConfig = {
  region: "asia-northeast1" as const,
  cors: corsConfig,
};

// ============================================
// 型定義
// ============================================

interface AdminUserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAdmin: boolean;
  mfaEnabled: boolean;
  disabled: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
}

interface InvitationCode {
  id: string;
  code: string;
  status: string;
  maxUses: number | null;
  usedCount: number;
  usedBy: string[];
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
  createdBy: string;
}

// ============================================
// 管理者権限チェック
// ============================================

function assertAdmin(
  request: CallableRequest<unknown>,
): asserts request is CallableRequest<unknown> & { auth: { uid: string } } {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "ログインが必要です");
  }
  // DecodedIdTokenのカスタムクレームはインデックスシグネチャでアクセス
  if (request.auth.token?.["admin"] !== true) {
    throw new HttpsError("permission-denied", "管理者権限が必要です");
  }
}

// ============================================
// 1. adminSearchUsers - ユーザー検索
// ============================================

interface SearchUsersRequest {
  query: string;
  limit?: number;
}

interface SearchUsersResponse {
  users: AdminUserInfo[];
}

export const adminSearchUsers = onCall<SearchUsersRequest>(
  functionConfig,
  async (request): Promise<SearchUsersResponse> => {
    assertAdmin(request);

    const { query, limit = 20 } = request.data;

    if (!query || typeof query !== "string") {
      throw new HttpsError("invalid-argument", "検索クエリが必要です");
    }

    const trimmedQuery = query.trim().toLowerCase();
    if (trimmedQuery.length < 2) {
      throw new HttpsError("invalid-argument", "検索クエリは2文字以上必要です");
    }

    try {
      // profilesコレクションからemailLowerで部分一致検索
      // Firestoreは部分一致をネイティブサポートしないため、範囲検索で対応
      const profilesSnapshot = await db
        .collection("profiles")
        .where("emailLower", ">=", trimmedQuery)
        .where("emailLower", "<=", trimmedQuery + "\uf8ff")
        .limit(Math.min(limit, 100))
        .get();

      const users: AdminUserInfo[] = [];

      for (const doc of profilesSnapshot.docs) {
        const profileData = doc.data();
        const uid = doc.id;

        try {
          // Firebase Authからユーザー情報を取得
          const userRecord = await admin.auth().getUser(uid);

          // カスタムクレームからadmin権限を確認
          const isAdmin = userRecord.customClaims?.admin === true;

          // MFA状態を確認
          const mfaEnabled =
            (userRecord.multiFactor?.enrolledFactors?.length ?? 0) > 0;

          users.push({
            uid,
            email: userRecord.email ?? null,
            displayName:
              profileData.displayName ?? userRecord.displayName ?? null,
            photoURL: profileData.photoURL ?? userRecord.photoURL ?? null,
            isAdmin,
            mfaEnabled,
            disabled: userRecord.disabled,
            createdAt: userRecord.metadata.creationTime ?? null,
            lastSignInAt: userRecord.metadata.lastSignInTime ?? null,
          });
        } catch (authError) {
          // Authユーザーが見つからない場合はスキップ
          console.warn(`User ${uid} not found in Auth:`, authError);
        }
      }

      return { users };
    } catch (error) {
      console.error("adminSearchUsers error:", error);
      throw new HttpsError("internal", "ユーザー検索中にエラーが発生しました");
    }
  },
);

// ============================================
// 2. adminSetUserAdmin - 管理者権限の付与・剥奪
// ============================================

interface SetUserAdminRequest {
  targetUid: string;
  grant: boolean;
}

interface SetUserAdminResponse {
  success: boolean;
  error?: string;
}

export const adminSetUserAdmin = onCall<SetUserAdminRequest>(
  functionConfig,
  async (request): Promise<SetUserAdminResponse> => {
    assertAdmin(request);

    const { targetUid, grant } = request.data;
    const adminUid = request.auth!.uid;

    if (!targetUid || typeof targetUid !== "string") {
      return { success: false, error: "対象ユーザーIDが必要です" };
    }

    if (typeof grant !== "boolean") {
      return { success: false, error: "grant パラメータが必要です" };
    }

    try {
      // 対象ユーザーを取得
      const userRecord = await admin.auth().getUser(targetUid);

      // 権限付与の場合、MFAチェック
      if (grant) {
        const mfaEnabled =
          (userRecord.multiFactor?.enrolledFactors?.length ?? 0) > 0;
        if (!mfaEnabled) {
          return {
            success: false,
            error:
              "管理者権限を付与するには、対象ユーザーがMFAを有効にしている必要があります",
          };
        }
      }

      // 現在のカスタムクレームを取得して更新
      const currentClaims = userRecord.customClaims || {};
      const newClaims = { ...currentClaims, admin: grant };

      // adminクレームを設定
      await admin.auth().setCustomUserClaims(targetUid, newClaims);

      // adminLogsに操作を記録
      await db.collection("adminLogs").add({
        action: grant ? "grant_admin" : "revoke_admin",
        targetUid,
        targetEmail: userRecord.email ?? null,
        performedBy: adminUid,
        performedAt: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          grant,
          previousClaims: currentClaims,
          newClaims,
        },
      });

      return { success: true };
    } catch (error) {
      console.error("adminSetUserAdmin error:", error);
      if ((error as { code?: string }).code === "auth/user-not-found") {
        return { success: false, error: "対象ユーザーが見つかりません" };
      }
      return {
        success: false,
        error: "管理者権限の更新中にエラーが発生しました",
      };
    }
  },
);

// ============================================
// 3. adminCreateInviteCode - 招待コード生成
// ============================================

interface CreateInviteCodeRequest {
  maxUses?: number;
  expiresAt?: string;
  note?: string;
}

interface CreateInviteCodeResponse {
  success: boolean;
  code: string;
  error?: string;
}

// 紛らわしい文字を除外した文字セット（0,O,I,1,L除外）
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  const segments: string[] = [];
  for (let i = 0; i < 3; i++) {
    let segment = "";
    for (let j = 0; j < 4; j++) {
      const randomIndex = Math.floor(Math.random() * CODE_CHARS.length);
      segment += CODE_CHARS[randomIndex];
    }
    segments.push(segment);
  }
  return segments.join("-");
}

export const adminCreateInviteCode = onCall<CreateInviteCodeRequest>(
  functionConfig,
  async (request): Promise<CreateInviteCodeResponse> => {
    assertAdmin(request);

    const { maxUses, expiresAt, note } = request.data;
    const adminUid = request.auth!.uid;

    try {
      // ユニークなコードを生成（衝突チェック）
      let code: string;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        code = generateInviteCode();
        const existing = await db
          .collection("invitationCodes")
          .where("code", "==", code)
          .limit(1)
          .get();

        if (existing.empty) {
          break;
        }
        attempts++;
      } while (attempts < maxAttempts);

      if (attempts >= maxAttempts) {
        return {
          success: false,
          code: "",
          error: "コード生成に失敗しました。再試行してください。",
        };
      }

      // 招待コードドキュメントを作成
      const inviteCodeData = {
        code,
        status: "active",
        maxUses: maxUses ?? null,
        usedCount: 0,
        usedBy: [],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        note: note?.trim() || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: adminUid,
      };

      await db.collection("invitationCodes").add(inviteCodeData);

      return { success: true, code };
    } catch (error) {
      console.error("adminCreateInviteCode error:", error);
      return {
        success: false,
        code: "",
        error: "招待コードの生成中にエラーが発生しました",
      };
    }
  },
);

// ============================================
// 4. adminListInviteCodes - 招待コード一覧
// ============================================

interface ListInviteCodesRequest {
  status?: string;
  limit?: number;
}

interface ListInviteCodesResponse {
  codes: InvitationCode[];
}

export const adminListInviteCodes = onCall<ListInviteCodesRequest>(
  functionConfig,
  async (request): Promise<ListInviteCodesResponse> => {
    assertAdmin(request);

    const { status, limit = 50 } = request.data;

    try {
      let query: FirebaseFirestore.Query = db
        .collection("invitationCodes")
        .orderBy("createdAt", "desc")
        .limit(Math.min(limit, 200));

      // ステータスフィルター
      if (status && typeof status === "string") {
        query = db
          .collection("invitationCodes")
          .where("status", "==", status)
          .orderBy("createdAt", "desc")
          .limit(Math.min(limit, 200));
      }

      const snapshot = await query.get();

      const codes: InvitationCode[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          code: data.code,
          status: data.status,
          maxUses: data.maxUses ?? null,
          usedCount: data.usedCount ?? 0,
          usedBy: data.usedBy ?? [],
          expiresAt: data.expiresAt?.toDate?.()?.toISOString() ?? null,
          note: data.note ?? null,
          createdAt:
            data.createdAt?.toDate?.()?.toISOString() ??
            new Date().toISOString(),
          createdBy: data.createdBy ?? "",
        };
      });

      return { codes };
    } catch (error) {
      console.error("adminListInviteCodes error:", error);
      throw new HttpsError(
        "internal",
        "招待コード一覧の取得中にエラーが発生しました",
      );
    }
  },
);

// ============================================
// 5. adminUpdateAppConfig - アプリ設定更新
// ============================================

interface UpdateAppConfigRequest {
  configType: "maintenance" | "announcement";
  config: Record<string, unknown>;
}

interface UpdateAppConfigResponse {
  success: boolean;
  error?: string;
}

export const adminUpdateAppConfig = onCall<UpdateAppConfigRequest>(
  functionConfig,
  async (request): Promise<UpdateAppConfigResponse> => {
    assertAdmin(request);

    const { configType, config } = request.data;
    const adminUid = request.auth!.uid;

    // configTypeバリデーション
    if (!configType || !["maintenance", "announcement"].includes(configType)) {
      return { success: false, error: "無効なconfigTypeです" };
    }

    if (!config || typeof config !== "object") {
      return { success: false, error: "configオブジェクトが必要です" };
    }

    try {
      const docRef = db.collection("appConfig").doc(configType);

      await docRef.set(
        {
          ...config,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: adminUid,
        },
        { merge: true },
      );

      // 操作ログを記録
      await db.collection("adminLogs").add({
        action: `update_app_config_${configType}`,
        configType,
        performedBy: adminUid,
        performedAt: admin.firestore.FieldValue.serverTimestamp(),
        details: { config },
      });

      return { success: true };
    } catch (error) {
      console.error("adminUpdateAppConfig error:", error);
      return {
        success: false,
        error: "アプリ設定の更新中にエラーが発生しました",
      };
    }
  },
);

// ============================================
// 6. adminUpdateLandingStats - LP統計の更新
// ============================================

interface UpdateLandingStatsResponse {
  success: boolean;
  stats?: {
    completedTasks: number;
    activeProjects: number;
  };
  error?: string;
}

/**
 * LP用の統計データを更新
 * - completedTasks: 完了したタスクの数
 * - activeProjects: アクティブなプロジェクトの数
 */
export const adminUpdateLandingStats = onCall(
  functionConfig,
  async (request): Promise<UpdateLandingStatsResponse> => {
    assertAdmin(request);

    try {
      // プロジェクト数を取得
      const projectsSnap = await db.collection("projects").get();
      const activeProjects = projectsSnap.size;

      // 完了タスク数を取得（collectionGroup query）
      const tasksSnap = await db
        .collectionGroup("tasks")
        .where("status", "==", "done")
        .get();
      const completedTasks = tasksSnap.size;

      const stats = {
        completedTasks,
        activeProjects,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth!.uid,
      };

      // appConfig/landingStats に保存
      await db.collection("appConfig").doc("landingStats").set(stats);

      // 操作ログを記録
      await db.collection("adminLogs").add({
        action: "update_landing_stats",
        performedBy: request.auth!.uid,
        performedAt: admin.firestore.FieldValue.serverTimestamp(),
        details: { completedTasks, activeProjects },
      });

      return {
        success: true,
        stats: { completedTasks, activeProjects },
      };
    } catch (error) {
      console.error("adminUpdateLandingStats error:", error);
      return {
        success: false,
        error: "LP統計の更新中にエラーが発生しました",
      };
    }
  },
);

// ============================================
// 7. scheduledUpdateLandingStats - LP統計の定期更新
// ============================================

/**
 * LP用の統計データを毎時更新するスケジュール関数
 */
export const scheduledUpdateLandingStats = onSchedule(
  {
    schedule: "every 1 hours",
    region: "asia-northeast1",
    timeZone: "Asia/Tokyo",
  },
  async () => {
    try {
      // プロジェクト数を取得
      const projectsSnap = await db.collection("projects").get();
      const activeProjects = projectsSnap.size;

      // 完了タスク数を取得（collectionGroup query）
      const tasksSnap = await db
        .collectionGroup("tasks")
        .where("status", "==", "done")
        .get();
      const completedTasks = tasksSnap.size;

      // appConfig/landingStats に保存
      await db.collection("appConfig").doc("landingStats").set({
        completedTasks,
        activeProjects,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: "scheduler",
      });

      console.log(
        `Landing stats updated: ${completedTasks} tasks, ${activeProjects} projects`,
      );
    } catch (error) {
      console.error("scheduledUpdateLandingStats error:", error);
    }
  },
);
