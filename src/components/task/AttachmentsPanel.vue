<script setup lang="ts">
import type { Attachment } from "@/types/task";
import { ref } from "vue";

const props = defineProps<{
  attachments: Attachment[];
}>();

const emit = defineEmits<{
  (e: "upload", file: File): void;
  (e: "open", attachment: Attachment): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);

const onFileChange = (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (!files || !files.length) return;
  emit("upload", files[0]);
  (event.target as HTMLInputElement).value = "";
};
</script>

<template>
  <section class="section-card">
    <div class="section-title">Attachments</div>
    <div class="upload-row">
      <button class="btn ghost" @click="fileInput?.click()">ファイルを追加</button>
      <input ref="fileInput" type="file" class="hidden" @change="onFileChange" />
    </div>
    <div class="list">
      <div
        v-for="file in attachments"
        :key="file.id"
        class="list-row"
        @click="emit('open', file)"
      >
        <div class="file-icon">📎</div>
        <div class="file-meta">
          <div class="name">{{ file.name }}</div>
          <div class="sub">{{ file.contentType || "file" }}</div>
        </div>
        <div class="spacer" />
        <div class="size" v-if="file.size">{{ (file.size / 1024).toFixed(1) }} KB</div>
      </div>
      <p v-if="!attachments.length" class="empty">まだ添付はありません</p>
    </div>
  </section>
</template>

<style scoped>
.section-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 8px;
}

.upload-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.btn {
  border-radius: 10px;
  border: 1px solid #e6e8ee;
  padding: 8px 12px;
  cursor: pointer;
  background: #fff;
}

.btn.ghost {
  background: #fff;
}

.hidden {
  display: none;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e6e8ee;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
}

.file-icon {
  font-size: 18px;
}

.file-meta .name {
  font-weight: 600;
}

.file-meta .sub {
  font-size: 12px;
  color: #94a3b8;
}

.spacer {
  flex: 1;
}

.size {
  font-size: 12px;
  color: #64748b;
}

.empty {
  margin: 0;
  color: #94a3b8;
}
</style>
