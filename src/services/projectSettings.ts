import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ProjectSettingsInput {
  aiChatEnabled?: boolean;
  aiApiKey?: string;
  notificationEnabled?: boolean;
  humorousCommandsEnabled?: boolean;
}

export async function updateProjectSettings(
  projectId: string,
  settings: ProjectSettingsInput,
) {
  const updateData: Record<string, unknown> = {};

  if (settings.aiChatEnabled !== undefined) {
    updateData["settings.aiChatEnabled"] = settings.aiChatEnabled;
  }
  if (settings.aiApiKey !== undefined) {
    updateData["settings.aiApiKey"] = settings.aiApiKey;
  }
  if (settings.notificationEnabled !== undefined) {
    updateData["settings.notificationEnabled"] = settings.notificationEnabled;
  }
  if (settings.humorousCommandsEnabled !== undefined) {
    updateData["settings.humorousCommandsEnabled"] =
      settings.humorousCommandsEnabled;
  }

  if (Object.keys(updateData).length > 0) {
    await updateDoc(doc(db, "projects", projectId), updateData);
  }
}
