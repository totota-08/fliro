import { storage } from '@/lib/firebase'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'

export async function uploadTaskAttachment(taskId: string, file: File) {
  const path = `tasks/${taskId}/${Date.now()}-${file.name}`
  const objectRef = ref(storage, path)
  const snap = await uploadBytes(objectRef, file, {
    contentType: file.type,
  })
  const url = await getDownloadURL(snap.ref)
  return { url, path }
}
