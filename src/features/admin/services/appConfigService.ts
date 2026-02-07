import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  MaintenanceConfig,
  AnnouncementConfig,
  SampleProjectConfig,
} from "../types/admin";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.features.admin.appConfigService");

export function subscribeToAppConfig(
  onMaintenanceChange: (config: MaintenanceConfig | null) => void,
  onAnnouncementChange: (config: AnnouncementConfig | null) => void,
): () => void {
  const maintenanceUnsub = onSnapshot(
    doc(db, "appConfig", "maintenance"),
    (snapshot) => {
      onMaintenanceChange(
        snapshot.exists() ? (snapshot.data() as MaintenanceConfig) : null,
      );
    },
    (error) => {
      logger.error`Failed to subscribe to maintenance config: ${error}`;
    },
  );

  const announcementUnsub = onSnapshot(
    doc(db, "appConfig", "announcement"),
    (snapshot) => {
      onAnnouncementChange(
        snapshot.exists() ? (snapshot.data() as AnnouncementConfig) : null,
      );
    },
    (error) => {
      logger.error`Failed to subscribe to announcement config: ${error}`;
    },
  );

  return () => {
    maintenanceUnsub();
    announcementUnsub();
  };
}

/**
 * サンプルプロジェクト設定を購読
 */
export function subscribeToSampleProject(
  onChange: (config: SampleProjectConfig | null) => void,
): () => void {
  return onSnapshot(
    doc(db, "appConfig", "sampleProject"),
    (snapshot) => {
      onChange(
        snapshot.exists() ? (snapshot.data() as SampleProjectConfig) : null,
      );
    },
    (error) => {
      logger.error`Failed to subscribe to sample project config: ${error}`;
    },
  );
}

/**
 * サンプルプロジェクトIDを取得（一度だけ）
 */
export async function getSampleProjectId(): Promise<string | null> {
  try {
    const snapshot = await getDoc(doc(db, "appConfig", "sampleProject"));
    if (snapshot.exists()) {
      const data = snapshot.data() as SampleProjectConfig;
      return data.projectId;
    }
    return null;
  } catch (error) {
    logger.error`Failed to get sample project config: ${error}`;
    return null;
  }
}
