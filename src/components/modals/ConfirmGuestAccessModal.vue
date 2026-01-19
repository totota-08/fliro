<script setup lang="ts">
/**
 * ConfirmGuestAccessModal - 公開プロジェクト設定の確認モーダル
 *
 * プロジェクトを公開する際の警告と同意確認用。
 */
import AppAlert from "@/components/ui/AppAlert.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppModal from "@/components/ui/AppModal.vue";

const props = withDefaults(
  defineProps<{
    /** モーダルの開閉状態 */
    open: boolean;
    /** 実行中かどうか */
    loading?: boolean;
  }>(),
  {
    loading: false,
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

function handleConfirm() {
  if (props.loading) return;
  emit("confirm");
}

function handleClose() {
  if (props.loading) return;
  emit("close");
}
</script>

<template>
  <AppModal
    :open="open"
    title="プロジェクトを公開する"
    size="sm"
    @close="handleClose"
  >
    <div class="confirm-guest-modal">
      <!-- 警告メッセージ -->
      <AppAlert variant="warning" title="注意">
        <p>
          プロジェクトを公開すると、リンクを知っている人は誰でもログインなしで閲覧できるようになります。
        </p>
        <p class="confirm-guest-modal__caution">
          機密情報が含まれていないことを確認してください。
        </p>
      </AppAlert>

      <!-- 補足説明 -->
      <div class="confirm-guest-modal__info">
        <h4>ゲスト（未ログインユーザー）ができること</h4>
        <ul>
          <li>公開設定で許可されたページの閲覧</li>
          <li>タスクやスレッドの内容確認</li>
        </ul>
        <h4>ゲストができないこと</h4>
        <ul>
          <li>タスクの作成・編集・削除</li>
          <li>コメントやメッセージの投稿</li>
          <li>プロジェクト設定の変更</li>
        </ul>
      </div>

      <!-- アクションボタン -->
      <div class="confirm-guest-modal__actions">
        <AppButton variant="secondary" :disabled="loading" @click="handleClose">
          キャンセル
        </AppButton>
        <AppButton variant="primary" :loading="loading" @click="handleConfirm">
          理解しました、公開する
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.confirm-guest-modal {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.confirm-guest-modal__caution {
  margin-top: var(--ui-space-2, 0.5rem);
  font-weight: var(--ui-font-semibold, 600);
}

.confirm-guest-modal__info {
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
}

.confirm-guest-modal__info h4 {
  margin: 0 0 var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.confirm-guest-modal__info h4:not(:first-child) {
  margin-top: var(--ui-space-3, 0.75rem);
}

.confirm-guest-modal__info ul {
  margin: 0;
  padding-left: var(--ui-space-5, 1.25rem);
  color: var(--ui-text-muted, #64748b);
}

.confirm-guest-modal__info li {
  margin-bottom: var(--ui-space-1, 0.25rem);
}

.confirm-guest-modal__info li:last-child {
  margin-bottom: 0;
}

.confirm-guest-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2, 0.5rem);
  margin-top: var(--ui-space-2, 0.5rem);
}

@media (max-width: 480px) {
  .confirm-guest-modal__actions {
    flex-direction: column-reverse;
  }

  .confirm-guest-modal__actions > * {
    width: 100%;
  }
}
</style>
