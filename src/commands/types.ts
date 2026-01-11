import type { ProjectMember } from "@/services/projectMembers";

export interface CommandContext {
  projectId: string;
  userId: string;
  activeChannelId: string;
  members: ProjectMember[];
  humorousCommandsEnabled?: boolean;
}

export interface ChatCommand {
  name: string; // e.g. "/task"
  description: string;
  example: string;
  suggestions?: Array<{
    name: string;
    description: string;
    example?: string;
  }>;
  match: (text: string) => boolean;
  execute: (
    text: string,
    context: CommandContext,
  ) => Promise<{
    success: boolean;
    message?: string; // Bot message content
    linkedTaskId?: string; // Optional linked task for button
  }>;
}
