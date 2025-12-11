<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { ROUTE_NAMES } from "@/constants/routes";
import { consumeSecretAccess } from "@/services/secretAccess";

const router = useRouter();

onMounted(() => {
  const access = consumeSecretAccess();
  if (access !== "chat") {
    router.replace({ name: ROUTE_NAMES.myPage });
  }
});

function goBack() {
  router.push({ name: ROUTE_NAMES.myPage });
}
</script>

<template>
  <div class="placeholder-shell">
    <div class="placeholder-card">
      <p class="eyebrow">secret page</p>
      <p>何にしよう....</p>
      <button type="button" @click="goBack">マイページへ戻る</button>
    </div>
  </div>
</template>

<style scoped>
.placeholder-shell {
  min-height: 100vh;
  background: radial-gradient(circle at top, #1b1f38, #0c0f1c);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e5ecff;
  padding: 2rem;
}

.placeholder-card {
  max-width: 520px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.5rem;
  padding: 2.5rem;
  background: rgba(7, 11, 25, 0.85);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.35em;
  color: #7ef9ff;
}

h1 {
  margin: 0;
  font-size: clamp(1.5rem, 2vw, 2.2rem);
}

p {
  margin: 0;
  line-height: 1.8;
  color: #c8d1f2;
}

button {
  align-self: flex-start;
  border: none;
  border-radius: 0.85rem;
  padding: 0.85rem 1.4rem;
  cursor: pointer;
  font-weight: 600;
  background: linear-gradient(120deg, #6ff3ff, #506bff);
  color: #081022;
}
</style>
