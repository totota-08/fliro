import { sendProjectMessage } from '@/services/projectChat'
import { createTask } from '@/services/taskService'
import type { ProjectMember } from '@/services/projectMembers'
import type { Ref, ComputedRef } from 'vue'

type Mention = { name: string; userId?: string | null }

type Options = {
  projectId: string
  currentChannel: ComputedRef<{ id: string } | null | undefined>
  user: Ref<{ uid: string } | null>
  profile: Ref<{ nickname?: string | null; fullName?: string | null } | null>
  projectMembers: Ref<ProjectMember[]>
  memberNameById: (id?: string | null) => string
  setBotTyping?: (active: boolean) => void
}

export function useSlashCommands({
  projectId,
  currentChannel,
  user,
  profile,
  projectMembers,
  memberNameById,
  setBotTyping,
}: Options) {
  async function sendBotMessage(text: string, options?: { privateFor?: string | null }) {
    setBotTyping?.(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      await sendProjectMessage(
        projectId,
        'bot',
        'Teamie Bot',
        text,
        currentChannel.value?.id || 'general',
        undefined,
        { isBot: true, privateFor: options?.privateFor ?? null },
      )
    } finally {
      setBotTyping?.(false)
    }
  }

  async function handleSlashCommand(text: string, mentions: Mention[]) {
    const lower = text.toLowerCase()
    if (lower.startsWith('/ping')) {
      await sendBotMessage('pong')
      return true
    }
    if (lower.startsWith('/private')) {
      const match = text.match(/\/private\s+@?([^\s]+)\s+(.+)/i)
      if (!match) {
        await sendBotMessage('private コマンドの形式: /private @ユーザー 本文', { privateFor: user.value?.uid || null })
        return true
      }
      const targetName = match[1]
      const body = match[2]?.trim()
      const targetUser = projectMembers.value.find(
        (m) => (m.nickname || m.fullName || m.displayName || '').toLowerCase() === targetName.toLowerCase(),
      )
      if (!targetUser) {
        await sendBotMessage(`${targetName} さんが見つかりません`, { privateFor: user.value?.uid || null })
        return true
      }
      if (!body) {
        await sendBotMessage('メッセージを入力してください', { privateFor: user.value?.uid || null })
        return true
      }
      if (!user.value) return true
      await sendProjectMessage(
        projectId,
        user.value.uid,
        profile.value?.nickname || profile.value?.fullName || 'User',
        body,
        currentChannel.value?.id || 'general',
        undefined,
        { privateFor: targetUser.userId, mentions: [targetUser.userId] },
      )
      await sendBotMessage(`${targetName} さんへのプライベートメッセージを送信しました`, {
        privateFor: user.value.uid,
      })
      return true
    }
    if (lower.startsWith('/time')) {
      await sendBotMessage(new Date().toLocaleString())
      return true
    }
    if (lower.startsWith('/news')) {
      try {
        const res = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page')
        const data = await res.json()
        const items = (data?.hits || []).slice(0, 3).map((hit: any, idx: number) => `${idx + 1}. ${hit?.title}`)
        await sendBotMessage(items.length ? `今日のニュース\n${items.join('\n')}` : 'ニュースを取得できませんでした')
      } catch (error) {
        await sendBotMessage('ニュースの取得に失敗しました')
      }
      return true
    }
    if (lower.startsWith('/newtask')) {
      const match = text.match(/\/newTask\/"([^\"]*)","([^\"]*)","([^\"]*)"/i)
      const title = match?.[1]?.trim() || ''
      const assigneeName = match?.[2]?.trim() || ''
      const description = match?.[3]?.trim() || ''
      if (!title) {
        await sendBotMessage('newTask コマンドが正しくありません。タスク名を入力してください。', {
          privateFor: user.value?.uid || null,
        })
        return true
      }
      const assignee = mentions.find((m) => m.userId)?.userId || null
      const explicitAssignee =
        assigneeName &&
        projectMembers.value.find(
          (m) => (m.nickname || m.fullName || m.displayName || '').toLowerCase() === assigneeName.toLowerCase(),
        )?.userId
      const finalAssignee = explicitAssignee || assignee || null
      if (!user.value) return true
      const taskId = await createTask(
        projectId,
        {
          title,
          description: description || undefined,
          assigneeId: finalAssignee,
          assigneeName: finalAssignee ? memberNameById(finalAssignee) : null,
        },
        user.value.uid,
      )
      await sendProjectMessage(
        projectId,
        user.value.uid,
        profile.value?.nickname || profile.value?.fullName || 'User',
        title,
        currentChannel.value?.id || 'general',
        undefined,
        { linkedTaskId: taskId, mentions: mentions.map((m) => m.userId || m.name), isTask: true },
      )
      await sendBotMessage(
        `${profile.value?.nickname || profile.value?.fullName || 'ユーザー'}さんが${
          finalAssignee ? memberNameById(finalAssignee) || '担当者未設定' : '担当者未設定'
        }にタスクを割り当てました`,
      )
      return true
    }
    return false
  }

  return { handleSlashCommand }
}
