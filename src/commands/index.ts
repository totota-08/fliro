import { newsCommand } from "./newsCommand";
import { taskCommand } from "./taskCommand";
import type { ChatCommand, CommandContext } from "./types";

export const commands: ChatCommand[] = [taskCommand, newsCommand];

export async function executeCommand(
  text: string,
  context: CommandContext,
): Promise<{ handled: boolean; result?: any }> {
  const command = commands.find((cmd) => cmd.match(text));
  if (!command) {
    return { handled: false };
  }

  const result = await command.execute(text, context);
  return { handled: true, result };
}
