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
// CropperJS 2.x はCSSをJSにバンドルしているため、CSS importは不要

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

// 画像が読み込まれたらCropperを初期化
function handleImageLoad() {
  if (!imageRef.value) return;

  // 既存のcropperを破棄
  if (cropper.value) {
    cropper.value.destroy();
  }

  // Cropper.js 2.x の型定義との互換性のため as any を使用
  cropper.value = new Cropper(imageRef.value, {
    aspectRatio: 1,
    viewMode: 1,
    dragMode: "move",
    autoCropArea: 0.9,
    cropBoxResizable: true,
    cropBoxMovable: true,
    guides: false,
    center: true,
    highlight: false,
    background: false,
    responsive: true,
    restore: false,
    checkCrossOrigin: false,
    checkOrientation: false,
  } as any);
}

// トリミングを確定
async function handleConfirm() {
  if (!cropper.value || loading.value) return;

  loading.value = true;

  try {
    // Cropper.js 2.x の型定義との互換性のため as any を使用
    const canvas = (cropper.value as any).getCroppedCanvas({
      width: 256,
      height: 256,
      fillColor: "#fff",
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    }) as HTMLCanvasElement;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b: Blob | null) => resolve(b), "image/png", 0.95);
    });

    if (!blob) {
      throw new Error("画像の生成に失敗しました");
    }

    const file = new File([blob], "avatar.png", { type: "image/png" });
    emit("confirm", file);
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
