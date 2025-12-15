import { createTask } from "@/services/taskService";
import { parseTaskCommand } from "@/utils/taskCommandParser";
import type { ChatCommand, CommandContext } from "./types";

export const taskCommand: ChatCommand = {
  name: "/task",
  description: "タスクを作成します",
  example: "/task 新機能のテスト due:2025-01-01 @User",
  match: (text: string) => text.startsWith("/task "),
  execute: async (text: string, context: CommandContext) => {
    const result = parseTaskCommand(text, context.members);

    if (!result.isValid || !result.payload) {
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
      );

      const assigneeText = result.payload.assigneeName
        ? ` (担当: ${result.payload.assigneeName})`
        : "";
      const dateText = result.payload.dueDate
        ? ` (期限: ${result.payload.dueDate.toLocaleDateString()})`
        : "";
      const successText = `Task created: 「${result.payload.title}」${assigneeText}${dateText} (ID: ${taskId})`;

      return {
        success: true,
        message: successText,
        linkedTaskId: taskId,
      };
    } catch (e) {
      return {
        success: false,
        message: "⚠️ Task creation failed. Please try again.",
      };
    }
  },
};
