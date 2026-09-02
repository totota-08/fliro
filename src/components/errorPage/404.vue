<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.components.errorPage.404");
const route = useRoute();
const advice = ref("");
const isLoading = ref(true);

const routePath = computed(() => route.path || "/");

onMounted(async () => {
  try {
    const { data } = await axios.get("https://api.adviceslip.com/advice", {
      headers: { Accept: "application/json" },
    });
    advice.value = data.slip?.advice ?? advice.value;
  } catch (err) {
    logger.error`アドバイス取得失敗: ${err}`;
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <section class="error-page">
    <div class="error-page__content">
      <p class="error-page__code">404</p>
      <h2 class="error-page__message">
        リクエストされたパス
        <span class="error-page__path">{{ routePath }}</span>
        は存在しません。
      </h2>
      <p class="error-page__advice">
        <span v-if="isLoading">読み込み中...</span>
        <span v-else>{{ advice }}</span>
      </p>
      <RouterLink to="/" class="error-page__cta">トップページに戻る</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 3rem 1.5rem;
  background: radial-gradient(
    circle,
    rgba(184, 227, 233, 0.35),
    transparent 70%
  );
  color: var(--primary-strong, #0b2e33);
}

.error-page__content {
  display: grid;
  gap: 1.5rem;
  max-width: 520px;
  text-align: center;
  padding: 3rem 2.5rem;
  border-radius: 1.75rem;
  background: rgba(245, 252, 255, 0.9);
  border: 1px solid rgba(11, 46, 51, 0.12);
  box-shadow: 0 24px 60px rgba(11, 46, 51, 0.18);
}

.error-page__code {
  font-size: clamp(3rem, 10vw, 6rem);
  margin: 0;
  font-weight: 700;
  color: var(--primary);
  letter-spacing: 0.2em;
}

.error-page__title {
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  margin: 0;
  font-weight: 700;
}

.error-page__message,
.error-page__advice {
  margin: 0;
  color: var(--text-muted, #516064);
  line-height: 1.6;
}

.error-page__path {
  display: inline-block;
  font-family: var(--ui-font-mono);
  padding: 0.25rem 0.75rem;
  margin-left: 0.25rem;
  border-radius: 999px;
  background: rgba(184, 227, 233, 0.3);
  color: var(--primary-strong, #0b2e33);
}

.error-page__cta {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin: 0 auto;
  padding: 0.8rem 1.75rem;
  border-radius: 999px;
  background: var(--primary, #4f7c82);
  color: var(--surface-elevated, #f5fcff);
  font-weight: 600;
  text-decoration: none;
  border: 1px solid rgba(79, 124, 130, 0.35);
  box-shadow: 0 18px 40px rgba(79, 124, 130, 0.28);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.error-page__cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 45px rgba(79, 124, 130, 0.32);
  background: var(--primary-strong, #0b2e33);
}

.error-page__cta:active {
  transform: translateY(0);
  box-shadow: 0 12px 28px rgba(79, 124, 130, 0.25);
}

@media (max-width: 600px) {
  .error-page {
    padding: 2rem 1.25rem;
  }

  .error-page__content {
    padding: 2.5rem 1.75rem;
    border-radius: 1.25rem;
  }
}
</style>
