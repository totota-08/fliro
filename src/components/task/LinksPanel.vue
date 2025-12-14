<script setup lang="ts">
import type { LinkItem } from "@/types/task";
import { ref } from "vue";

const props = defineProps<{
  links: LinkItem[];
}>();

const emit = defineEmits<{
  (e: "add", link: { title: string; url: string }): void;
}>();

const title = ref("");
const url = ref("");

const submit = () => {
  if (!url.value.trim()) return;
  emit("add", { title: title.value.trim() || url.value.trim(), url: url.value.trim() });
  title.value = "";
  url.value = "";
};
</script>

<template>
  <section class="section-card">
    <div class="section-title">Links</div>
    <div class="two-input">
      <input v-model="title" type="text" placeholder="タイトル" />
      <input v-model="url" type="url" placeholder="https://example.com" @keyup.enter="submit" />
      <button class="btn primary" @click="submit">追加</button>
    </div>
    <div class="list">
      <a v-for="link in links" :key="link.id" class="list-row" :href="link.url" target="_blank">
        <div class="link-dot"></div>
        <div class="text">
          <div class="name">{{ link.title }}</div>
          <div class="sub">{{ link.url }}</div>
        </div>
      </a>
      <p v-if="!links.length" class="empty">リンクはまだありません</p>
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

.two-input {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  margin-bottom: 8px;
}

input {
  border-radius: 10px;
  border: 1px solid #e6e8ee;
  padding: 8px 10px;
}

.btn {
  border-radius: 10px;
  border: 1px solid #e6e8ee;
  padding: 8px 12px;
  cursor: pointer;
  background: #fff;
}

.btn.primary {
  background: linear-gradient(135deg, #4f7c82, #0b2e33);
  color: #fff;
  border-color: #4f7c82;
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
  text-decoration: none;
  color: inherit;
}

.link-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4f7c82;
}

.text .name {
  font-weight: 600;
}

.text .sub {
  font-size: 12px;
  color: #94a3b8;
}

.empty {
  margin: 0;
  color: #94a3b8;
}
</style>
