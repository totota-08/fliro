<script setup lang="ts">
/**
 * ChatMessageEditor - メッセージのインライン編集
 *
 * メッセージをその場で編集できるテキストエリア
 */
import { ref, watch, nextTick, onMounted } from "vue";
import AppButton from "@/components/ui/AppButton.vue";

const props = defineProps<{
  /** 編集中のテキスト */
  initialText: string;
  /** 編集中フラグ */
  isEditing?: boolean;
}>();

const emit = defineEmits<{
  (e: "save", text: string): void;
  (e: "cancel"): void;
}>();

const editText = ref(props.initialText);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// 編集開始時にフォーカス
watch(
  () => props.isEditing,
  (editing) => {
    if (editing) {
      editText.value = props.initialText;
      nextTick(() => {
        textareaRef.value?.focus();
        // カーソルを末尾に移動
        if (textareaRef.value) {
          textareaRef.value.selectionStart = textareaRef.value.value.length;
          textareaRef.value.selectionEnd = textareaRef.value.value.length;
        }
      });
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (props.isEditing) {
    textareaRef.value?.focus();
  }
});

function handleSave() {
  const trimmed = editText.value.trim();
  if (!trimmed) {
    // 空の場合はキャンセル扱い
    emit("cancel");
    return;
  }
  emit("save", trimmed);
}

function handleCancel() {
  editText.value = props.initialText;
  emit("cancel");
}

function handleKeydown(event: KeyboardEvent) {
  // Escでキャンセル
  if (event.key === "Escape") {
    event.preventDefault();
    handleCancel();
    return;
  }
  // Ctrl+Enter / Cmd+Enter で保存
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    handleSave();
  }
}
</script>

<template>
  <div class="message-editor">
    <textarea
      ref="textareaRef"
      v-model="editText"
      class="editor-textarea"
      rows="3"
      placeholder="メッセージを入力..."
      @keydown="handleKeydown"
    />
    <div class="editor-actions">
      <span class="editor-hint">Escでキャンセル / Ctrl+Enterで保存</span>
      <div class="editor-buttons">
        <AppButton variant="ghost" size="sm" @click="handleCancel">
          キャンセル
        </AppButton>
        <AppButton
          variant="primary"
          size="sm"
          :disabled="!editText.trim()"
          @click="handleSave"
        >
          保存
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-editor {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.editor-textarea {
  width: 100%;
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-brand-400);
  border-radius: var(--ui-radius-md);
  background: var(--ui-surface);
  font-size: var(--ui-text-base);
  line-height: var(--ui-leading-relaxed);
  resize: vertical;
  min-height: 80px;
  transition: var(--ui-transition-colors);
}

.editor-textarea:focus {
  outline: none;
  border-color: var(--ui-brand-600);
  box-shadow: var(--ui-ring-focus);
}

.editor-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--ui-space-2);
}

.editor-hint {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-subtle);
}

.editor-buttons {
  display: flex;
  gap: var(--ui-space-2);
}

@media (max-width: 768px) {
  .editor-hint {
    display: none;
  }

  .editor-actions {
    justify-content: flex-end;
  }
}
</style>
