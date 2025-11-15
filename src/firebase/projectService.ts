import { addDoc, collection, doc, serverTimestamp, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { CreateProjectPayload, ProjectDoc } from '@/types/project'
import { addProjectMember } from '@/services/projectMembers'

export async function createProject(payload: CreateProjectPayload, currentUserId: string) {

  const projectBase: any = {
    name: payload.name.trim(),
    description: payload.description?.trim() || '',
    ownerUserId: currentUserId,
    status: 'active',
    settings: {
      isPublic: payload.isPublic ?? false,
      allowGuestView: payload.allowGuestView ?? false,
      defaultTaskStatus: 'todo',
    },
    stats: {
      totalTasks: 0,
      completedTasks: 0,
      totalMembers: 1,
      lastActivityAt: serverTimestamp(),
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  if (payload.color) projectBase.color = payload.color
  if (payload.startDate) projectBase.startDate = new Date(payload.startDate)
  if (payload.dueDate) projectBase.dueDate = new Date(payload.dueDate)

  // Create project document
  const projRef = await addDoc(collection(db, 'projects'), projectBase)

  await addProjectMember({
    projectId: projRef.id,
    userId: currentUserId,
    role: 'owner',
    invitedBy: currentUserId,
    projectName: projectBase.name,
  })

  return projRef.id
}

export async function fetchProject(projectId: string) {
  const ref = doc(db, 'projects', projectId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as unknown as ProjectDoc) }
}

// icon upload feature removed
