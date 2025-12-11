import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ProjectSettingsInput {
  aiChatEnabled?: boolean
  aiApiKey?: string
  notificationEnabled?: boolean
}

export async function updateProjectSettings(projectId: string, settings: ProjectSettingsInput) {
  await updateDoc(doc(db, 'projects', projectId), {
    'settings.aiChatEnabled': settings.aiChatEnabled,
    'settings.aiApiKey': settings.aiApiKey,
    'settings.notificationEnabled': settings.notificationEnabled,
  })
}
