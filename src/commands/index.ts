import { fliloBotCommand } from "./fliloBotCommand";
import { newsCommand } from "./newsCommand";
import { taskCommand } from "./taskCommand";
import type { ChatCommand, CommandContext } from "./types";

export const commands: ChatCommand[] = [
  fliloBotCommand,
  taskCommand,
  newsCommand,
];

export async function executeCommand(
  text: string,
  context: CommandContext,
): Promise<{ handled: boolean; result?: any }> {
  const command = commands.find((cmd) => cmd.match(text));
  if (!command) {
    return { handled: false };
  }

  // ユーモラスコマンドは設定が有効な場合のみ実行
  if (command.humorousOnly && !context.humorousCommandsEnabled) {
    return { handled: false };
  }

  const result = await command.execute(text, context);
  return { handled: true, result };
}
