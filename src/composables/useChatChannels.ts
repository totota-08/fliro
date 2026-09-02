import type { ChatMessage } from "@/services/projectChat";
import type { TaskDoc } from "@/services/taskService";
import { computed, ref, type Ref } from "vue";

export type ChatChannel = {
  id: string;
  name: string;
  description?: string;
  type: "general" | "custom" | "task";
  createdBy?: string;
  isPublic?: boolean;
  allowedUserIds?: string[];
  allowedRoles?: string[]; // 送信許可されたロールのリスト（空なら全員許可）
  settingsAllowedRoles?: string[]; // 設定編集を許可されたロールのリスト（空なら admin/owner/作成者のみ）
  archived?: boolean; // アーカイブフラグ
};

export const DEFAULT_CHANNEL: ChatChannel = {
  id: "general",
  name: "全体",
  description: "全メンバーと共有するチャネル",
  type: "general",
};

export const MAX_VISIBLE_TASK_CHANNELS = 8;

/**
 * チャットのチャンネル状態と派生リスト。
 * スレッド化されたタスクとカスタムスレッドを1つのチャンネル一覧に統合し、
 * 選択状態・アーカイブ・表示件数の制御と、現在チャンネルのメッセージ抽出を担う。
 */
export function useChatChannels(
  tasks: Ref<TaskDoc[]>,
  customChannels: Ref<ChatChannel[]>,
  messages: Ref<ChatMessage[]>,
) {
  const activeChannelId = ref("general");
  const showAllTaskChannels = ref(false); // タスク一覧の「すべて表示」フラグ
  const showArchivedTaskChannels = ref(false); // アーカイブ済みタスクの表示フラグ
  const showArchivedCustomChannels = ref(false); // アーカイブ済みカスタムスレッドの表示フラグ
  const showMobileThreads = ref(false); // モバイル用スレッドドロワー

  // アクティブなカスタムスレッド（アーカイブされていないもの）
  const activeCustomChannels = computed<ChatChannel[]>(() =>
    customChannels.value.filter((ch) => !ch.archived),
  );

  // アーカイブされたカスタムスレッド
  const archivedCustomChannels = computed<ChatChannel[]>(() =>
    customChannels.value.filter((ch) => ch.archived),
  );

  // 全タスクチャンネル（アーカイブフラグを含む）
  const allTaskChannels = computed<ChatChannel[]>(() =>
    tasks.value
      .filter((task) => task.hasThread !== false)
      .map((task) => ({
        id: task.id,
        name: task.threadName || task.title || "無題のタスク",
        description: task.status,
        type: "task" as const,
        archived: task.threadArchived === true || task.status === "done",
      })),
  );

  // アクティブなタスクチャンネル（アーカイブされていないもの）
  const activeTaskChannels = computed<ChatChannel[]>(() =>
    allTaskChannels.value.filter((ch) => !ch.archived),
  );

  // アーカイブされたタスクチャンネル
  const archivedTaskChannels = computed<ChatChannel[]>(() =>
    allTaskChannels.value.filter((ch) => ch.archived),
  );

  // 表示するアクティブタスクチャンネル（最大8件、またはすべて）
  const visibleActiveTaskChannels = computed(() => {
    if (showAllTaskChannels.value) {
      return activeTaskChannels.value;
    }
    return activeTaskChannels.value.slice(0, MAX_VISIBLE_TASK_CHANNELS);
  });

  // 隠れているアクティブタスクの数
  const hiddenActiveTaskCount = computed(() => {
    return Math.max(
      0,
      activeTaskChannels.value.length - MAX_VISIBLE_TASK_CHANNELS,
    );
  });

  const channels = computed<ChatChannel[]>(() => {
    return [DEFAULT_CHANNEL, ...allTaskChannels.value, ...customChannels.value];
  });

  const currentChannel = computed<ChatChannel>(() => {
    return (
      channels.value.find((c) => c.id === activeChannelId.value) ||
      DEFAULT_CHANNEL
    );
  });

  const currentChannelMessages = computed(() => {
    if (currentChannel.value.type === "task") {
      return messages.value.filter(
        (m) => m.linkedTaskId === currentChannel.value.id,
      );
    }
    return messages.value.filter(
      (m) =>
        (m.channelId || "general") === activeChannelId.value && !m.linkedTaskId,
    );
  });

  // 現在のチャンネルがアーカイブされているかどうか
  const isCurrentChannelArchived = computed(() => {
    if (currentChannel.value.type !== "task") return false;
    const task = tasks.value.find((t) => t.id === currentChannel.value.id);
    return task?.threadArchived === true || task?.status === "done";
  });

  function selectChannel(id: string) {
    if (activeChannelId.value === id) return;
    activeChannelId.value = id;
  }

  // モバイルドロワーでのチャンネル選択（選択後にドロワーを閉じる）
  function selectChannelWithClose(id: string) {
    selectChannel(id);
    showMobileThreads.value = false;
  }

  function toggleMobileThreads() {
    showMobileThreads.value = !showMobileThreads.value;
  }

  return {
    activeChannelId,
    showAllTaskChannels,
    showArchivedTaskChannels,
    showArchivedCustomChannels,
    showMobileThreads,
    activeCustomChannels,
    archivedCustomChannels,
    allTaskChannels,
    activeTaskChannels,
    archivedTaskChannels,
    visibleActiveTaskChannels,
    hiddenActiveTaskCount,
    channels,
    currentChannel,
    currentChannelMessages,
    isCurrentChannelArchived,
    selectChannel,
    selectChannelWithClose,
    toggleMobileThreads,
  };
}
