import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MaintenanceConfig, AnnouncementConfig } from "../types/admin";
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
