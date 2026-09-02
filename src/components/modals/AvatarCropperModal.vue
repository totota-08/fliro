<script setup lang="ts">
/**
 * AvatarCropperModal - アバター画像のトリミングモーダル
 *
 * ユーザーが選択した画像を円形にトリミングして
 * アップロード用のファイルを生成する
 */
import { ref, watch, onBeforeUnmount } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppModal from "@/components/ui/AppModal.vue";
import Cropper from "cropperjs";
import { getLogger } from "@logtape/logtape";
// CropperJS 2.x はCSSをJSにバンドルしているため、CSS importは不要

const logger = getLogger("app.components.modals.AvatarCropperModal");

const props = defineProps<{
  /** モーダルの開閉状態 */
  open: boolean;
  /** トリミングする画像ファイル */
  imageFile: File | null;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [file: File];
}>();

const imageRef = ref<HTMLImageElement | null>(null);
const imageUrl = ref<string>("");
const cropper = ref<Cropper | null>(null);
const loading = ref(false);

// モーダルが開いたら画像をセットアップ
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.imageFile) {
      imageUrl.value = URL.createObjectURL(props.imageFile);
    } else {
      cleanup();
    }
  },
);

// CropperJS 2.x はコンストラクタオプションではなくテンプレートで構成する。
// デフォルトテンプレートに正方形制約（aspect-ratio="1"）と初期範囲 0.9 を加えたもの
const CROPPER_TEMPLATE = `
<cropper-canvas background>
  <cropper-image rotatable scalable translatable></cropper-image>
  <cropper-shade hidden></cropper-shade>
  <cropper-handle action="select" plain></cropper-handle>
  <cropper-selection initial-coverage="0.9" aspect-ratio="1" movable resizable>
    <cropper-grid role="grid" bordered covered></cropper-grid>
    <cropper-crosshair centered></cropper-crosshair>
    <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>
    <cropper-handle action="n-resize"></cropper-handle>
    <cropper-handle action="e-resize"></cropper-handle>
    <cropper-handle action="s-resize"></cropper-handle>
    <cropper-handle action="w-resize"></cropper-handle>
    <cropper-handle action="ne-resize"></cropper-handle>
    <cropper-handle action="nw-resize"></cropper-handle>
    <cropper-handle action="se-resize"></cropper-handle>
    <cropper-handle action="sw-resize"></cropper-handle>
  </cropper-selection>
</cropper-canvas>`;

// 画像が読み込まれたらCropperを初期化
function handleImageLoad() {
  if (!imageRef.value) return;

  // 既存のcropperを破棄
  if (cropper.value) {
    cropper.value.destroy();
  }

  cropper.value = new Cropper(imageRef.value, {
    template: CROPPER_TEMPLATE,
  });
}

// トリミングを確定
async function handleConfirm() {
  if (!cropper.value || loading.value) return;

  loading.value = true;

  try {
    const selection = cropper.value.getCropperSelection();
    if (!selection) {
      throw new Error("トリミング範囲を取得できませんでした");
    }
    const canvas = await selection.$toCanvas({ width: 256, height: 256 });

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b: Blob | null) => resolve(b), "image/png", 0.95);
    });

    if (!blob) {
      throw new Error("画像の生成に失敗しました");
    }

    const file = new File([blob], "avatar.png", { type: "image/png" });
    emit("confirm", file);
  } catch (error) {
    logger.error`アバター画像のトリミングに失敗しました: ${error}`;
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  if (loading.value) return;
  emit("close");
}

function cleanup() {
  if (cropper.value) {
    cropper.value.destroy();
    cropper.value = null;
  }
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
    imageUrl.value = "";
  }
}

onBeforeUnmount(() => {
  cleanup();
});
</script>

<template>
  <AppModal :open="open" title="アイコンを調整" size="md" @close="handleClose">
    <div class="avatar-cropper">
      <p class="avatar-cropper__hint">
        ドラッグして位置を調整し、枠をリサイズできます
      </p>

      <div class="avatar-cropper__container">
        <img
          v-if="imageUrl"
          ref="imageRef"
          :src="imageUrl"
          alt="トリミングプレビュー"
          class="avatar-cropper__image"
          @load="handleImageLoad"
        />
      </div>

      <div class="avatar-cropper__actions">
        <AppButton variant="secondary" :disabled="loading" @click="handleClose">
          キャンセル
        </AppButton>
        <AppButton variant="primary" :loading="loading" @click="handleConfirm">
          この画像を使用
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.avatar-cropper {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.avatar-cropper__hint {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  text-align: center;
}

.avatar-cropper__container {
  position: relative;
  width: 100%;
  max-width: 320px;
  height: 320px;
  margin: 0 auto;
  background: var(--ui-surface-secondary, #f8f9fa);
  border-radius: var(--ui-radius-md, 0.75rem);
  overflow: hidden;
}

.avatar-cropper__image {
  display: block;
  max-width: 100%;
}

.avatar-cropper__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2, 0.5rem);
  margin-top: var(--ui-space-2, 0.5rem);
}

/* Cropper.js のスタイルオーバーライド */
:deep(.cropper-view-box) {
  border-radius: 50%;
  outline: 2px solid var(--ui-brand-600, #4f7c82);
  outline-offset: -2px;
}

:deep(.cropper-face) {
  background: transparent;
}

:deep(.cropper-dashed) {
  display: none;
}

:deep(.cropper-center) {
  display: none;
}

:deep(.cropper-point) {
  background: var(--ui-brand-600, #4f7c82);
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

:deep(.cropper-line) {
  background: var(--ui-brand-600, #4f7c82);
}

:deep(.cropper-modal) {
  background: rgba(0, 0, 0, 0.5);
}

@media (max-width: 640px) {
  .avatar-cropper__container {
    max-width: 280px;
    height: 280px;
  }

  .avatar-cropper__actions {
    flex-direction: column;
  }
}
</style>
