import { commands } from "@/commands";
import { computed, ref, watch, type Ref } from "vue";

/**
 * チャット入力欄の "/" コマンド補完。
 * 入力値を監視して候補リストの表示を制御し、候補選択時は入力欄へ反映する。
 */
export function useCommandSuggestions(
  input: Ref<string>,
  humorousEnabled: () => boolean,
  focusComposer: () => void,
) {
  const showCommandSuggestions = ref(false);

  const availableCommands = computed(() => {
    return commands
      .filter((c) => !c.humorousOnly || humorousEnabled())
      .flatMap((c) =>
        c.suggestions?.length
          ? c.suggestions.map((s) => ({
              label: s.name,
              description: s.description,
              example: s.example ?? c.example,
            }))
          : [
              {
                label: c.name,
                description: c.description,
                example: c.example,
              },
            ],
      );
  });

  const filteredCommands = computed(() => {
    if (!input.value.startsWith("/")) return [];
    const query = input.value.toLowerCase();
    return availableCommands.value.filter((cmd) => cmd.label.startsWith(query));
  });

  watch(input, (val) => {
    showCommandSuggestions.value = val.startsWith("/") && !val.includes(" ");
  });

  function selectCommand(cmd: string) {
    // /news は引数なしで実行することが多いため末尾スペースを付けない
    input.value = cmd === "/news" ? cmd : `${cmd} `;
    showCommandSuggestions.value = false;
    focusComposer();
  }

  return {
    showCommandSuggestions,
    filteredCommands,
    selectCommand,
  };
}
