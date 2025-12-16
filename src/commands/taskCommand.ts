import { createTask } from "@/services/taskService";
import { addProjectEvent } from "@/services/projectActivityLogService";
import { parseTaskCommand } from "@/utils/taskCommandParser";
import type { ChatCommand, CommandContext } from "./types";

function resolveActorName(context: CommandContext) {
  const member = context.members.find((m) => m.userId === context.userId);
  return (
    member?.nickname ||
    member?.fullName ||
    member?.displayName ||
    context.userId
  );
}

async function logCommandResult(
  context: CommandContext,
  payload: {
    result: "success" | "failed";
    command: string;
    createdTaskId?: string;
    errorReason?: string;
  },
  actorName: string,
) {
  try {
    await addProjectEvent(context.projectId, {
      type: "bot.command_executed",
      origin: "command",
      actorId: context.userId,
      actorName,
      payload: {
        ...payload,
        channelId: context.activeChannelId,
      },
    });
  } catch (error) {
    // best-effort logging; do not throw
  }
}

export const taskCommand: ChatCommand = {
  name: "/task",
  description: "タスクを作成します",
  example: "/task 新機能のテスト due:2025-01-01 @User",
  match: (text: string) => text.startsWith("/task "),
  execute: async (text: string, context: CommandContext) => {
    const actorName = resolveActorName(context);
    const result = parseTaskCommand(text, context.members);

    if (!result.isValid || !result.payload) {
      await logCommandResult(
        context,
        { result: "failed", command: text, errorReason: result.error },
        actorName,
      );
      return {
        success: false,
        message: `⚠️ ${result.error || "Invalid command"}`,
      };
    }

    try {
      const taskId = await createTask(
        context.projectId,
        result.payload,
        context.userId,
        {
          origin: "command",
          actorName,
          actorId: context.userId,
        },
      );

      const assigneeText = result.payload.assigneeName
        ? ` (担当: ${result.payload.assigneeName})`
        : "";
      const dateText = result.payload.dueDate
        ? ` (期限: ${result.payload.dueDate.toLocaleDateString()})`
        : "";
      const successText = `Task created: 「${result.payload.title}」${assigneeText}${dateText} (ID: ${taskId})`;

      await logCommandResult(
        context,
        { result: "success", command: text, createdTaskId: taskId },
        actorName,
      );

      return {
        success: true,
        message: successText,
        linkedTaskId: taskId,
      };
    } catch (e) {
      await logCommandResult(
        context,
        { result: "failed", command: text, errorReason: (e as Error).message },
        actorName,
      );
      try {
        await addProjectEvent(context.projectId, {
          type: "bot.error",
          origin: "bot",
          actorId: null,
          actorName: "Flilo Bot",
          payload: {
            command: text,
            reason: (e as Error).message || "Task creation failed",
          },
        });
      } catch {
        // best-effort only
      }
      return {
        success: false,
        message: "⚠️ Task creation failed. Please try again.",
      };
    }
  },
};
