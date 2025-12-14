import {
  addChecklistItem,
  addComment,
  resolveQuestion,
  subscribeAttachments,
  subscribeChecklist,
  subscribeComments,
  subscribeEvents,
  subscribeLinks,
  subscribeTask,
  toggleChecklist,
  updateTask,
} from '@/lib/firestoreQueries'
import { uploadTaskAttachment } from '@/lib/storage'
import type {
  ActivityEvent,
  Attachment,
  ChecklistItem,
  CommentItem,
  LinkItem,
  Task,
} from '@/types/task'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTaskDetailStore = defineStore('taskDetail', () => {
  const task = ref<Task | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const comments = ref<CommentItem[]>([])
  const checklist = ref<ChecklistItem[]>([])
  const attachments = ref<Attachment[]>([])
  const links = ref<LinkItem[]>([])
  const events = ref<ActivityEvent[]>([])
  const unsubscribers: Array<() => void> = []

  const openChecklist = computed(() => checklist.value.filter((c) => !c.done))
  const doneChecklist = computed(() => checklist.value.filter((c) => c.done))
  const decisions = computed(() => comments.value.filter((c) => c.type === 'decision'))
  const openQuestions = computed(() =>
    comments.value.filter((c) => c.type === 'question' && !c.resolvedAt),
  )

  function clearSubs() {
    unsubscribers.splice(0).forEach((off) => {
      try {
        off()
      } catch {
        /* noop */
      }
    })
  }

  async function load(taskId: string) {
    clearSubs()
    loading.value = true
    error.value = null
    try {
      unsubscribers.push(
        subscribeTask(
          taskId,
          (doc) => {
            task.value = doc
          },
          (err) => {
            error.value = err.message
          },
        ),
      )
      unsubscribers.push(
        subscribeComments(
          taskId,
          (list) => {
            comments.value = list
          },
          (err) => (error.value = err.message),
        ),
      )
      unsubscribers.push(
        subscribeChecklist(
          taskId,
          (list) => {
            checklist.value = list
          },
          (err) => (error.value = err.message),
        ),
      )
      unsubscribers.push(
        subscribeAttachments(
          taskId,
          (list) => {
            attachments.value = list
          },
          (err) => (error.value = err.message),
        ),
      )
      unsubscribers.push(
        subscribeLinks(
          taskId,
          (list) => {
            links.value = list
          },
          (err) => (error.value = err.message),
        ),
      )
      unsubscribers.push(
        subscribeEvents(
          taskId,
          (list) => {
            events.value = list
          },
          (err) => (error.value = err.message),
        ),
      )
    } catch (e: any) {
      error.value = e?.message ?? '読み込みに失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function updateTaskField(taskId: string, payload: Partial<Task>) {
    task.value = task.value ? { ...task.value, ...payload } : null
    await updateTask(taskId, payload)
  }

  async function addChecklist(taskId: string, body: string) {
    const order = checklist.value.length + 1
    await addChecklistItem(taskId, { body, done: false, order })
  }

  async function toggleChecklistItem(taskId: string, itemId: string, done: boolean) {
    await toggleChecklist(taskId, itemId, done)
  }

  async function postComment(taskId: string, payload: Partial<CommentItem>) {
    await addComment(taskId, payload)
  }

  async function setQuestionResolved(taskId: string, commentId: string, resolved: boolean) {
    await resolveQuestion(taskId, commentId, resolved)
  }

  async function uploadAttachment(taskId: string, file: File) {
    const { url, path } = await uploadTaskAttachment(taskId, file)
    return { url, path }
  }

  return {
    task,
    loading,
    error,
    comments,
    checklist,
    attachments,
    links,
    events,
    openChecklist,
    doneChecklist,
    decisions,
    openQuestions,
    load,
    updateTaskField,
    addChecklist,
    toggleChecklistItem,
    postComment,
    setQuestionResolved,
    uploadAttachment,
    clearSubs,
  }
})
