import type { ProjectMember } from "@/services/projectMembers";
import type { CreateTaskPayload } from "@/services/taskService";

export interface TaskCommandResult {
  isValid: boolean;
  error?: string;
  payload?: CreateTaskPayload;
}

export function parseTaskCommand(
  text: string,
  members: ProjectMember[],
): TaskCommandResult {
  if (!text.startsWith("/task ")) {
    return { isValid: false, error: "Not a task command" };
  }

  const content = text.slice(6).trim();
  if (!content) {
    return { isValid: false, error: "Title is required" };
  }

  let title = content;
  let dueDate: Date | null = null;
  let assigneeId: string | null = null;
  let assigneeName: string | null = null;
  let categoryName: string | null = null;

  // Extract due:YYYY-MM-DD
  const dueMatch = title.match(/\bdue:(\d{4}-\d{2}-\d{2})\b/);
  if (dueMatch && dueMatch[1]) {
    const d = new Date(dueMatch[1]);
    if (isNaN(d.getTime())) {
      return { isValid: false, error: "Invalid date format. Use YYYY-MM-DD" };
    }
    dueDate = d;
    title = title.replace(dueMatch[0], "").trim();
  }

  // Extract @Assignee
  const assignMatch = title.match(/@(\S+)/);
  if (assignMatch && assignMatch[1]) {
    const nameQuery = assignMatch[1].toLowerCase();
    const member = members.find(
      (m) =>
        (m.nickname || "").toLowerCase() === nameQuery ||
        (m.fullName || "").toLowerCase() === nameQuery ||
        (m.displayName || "").toLowerCase() === nameQuery,
    );

    if (member) {
      assigneeId = member.userId;
      assigneeName = member.nickname || member.fullName || "Unknown";
      title = title.replace(assignMatch[0], "").trim();
    } else {
      return {
        isValid: false,
        error: `Member "${assignMatch[1]}" not found.`,
      };
    }
  }

  // Extract #Category
  const catMatch = title.match(/#(\S+)/);
  if (catMatch && catMatch[1]) {
    categoryName = catMatch[1]; // We store name, matching logic is simpler to do here if we had category list,
    // but per requirement we just pass null/ignore if logic complex or let caller handle.
    // Prompt says: "if categories exist, match by name; otherwise store category as null (do not fail)."
    // Since we don't have categories passed in, we will treat as just stripping tag for now or null.
    title = title.replace(catMatch[0], "").trim();
  }

  if (!title) {
    return { isValid: false, error: "Title is required" };
  }

  // categoryName is currently unused in payload as strict ID is needed or name field in payload
  // but keeping variable for future use if payload supports threadName/categoryName
  void categoryName;

  return {
    isValid: true,
    payload: {
      title,
      dueDate,
      assigneeId,
      assigneeName,
      status: "todo",
      hasThread: false, // Explicitly false as per requirements
    },
  };
}
