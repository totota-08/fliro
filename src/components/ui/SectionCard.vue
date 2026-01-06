<script setup lang="ts">
/**
 * セクションカードコンポーネント
 *
 * Deep Green / Card UIデザインに準拠したカードラッパーを提供します。
 *
 * @example
 * <SectionCard title="タスク一覧">
 *   <p>カードの内容</p>
 * </SectionCard>
 *
 * <SectionCard size="lg">
 *   <template #header>
 *     <h2>カスタムヘッダー</h2>
 *   </template>
 *   <p>カードの内容</p>
 * </SectionCard>
 */

interface Props {
  /** カードのタイトル（header slotがない場合に使用） */
  title?: string;
  /** カードのサイズ（デフォルトはmd） */
  size?: "sm" | "md" | "lg";
  /** カードの影を強調するか */
  elevated?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: "md",
  elevated: false,
});

const cardClass = computed(() => {
  const classes = ["section-card"];
  if (props.size === "sm") classes.push("section-card--sm");
  if (props.size === "lg") classes.push("section-card--lg");
  if (props.elevated) classes.push("section-card--elevated");
  return classes.join(" ");
});
</script>

<script lang="ts">
import { computed } from "vue";
export default {
  name: "SectionCard",
};
</script>

<template>
  <section :class="cardClass">
    <header v-if="$slots.header || title" class="section-card__header">
      <slot name="header">
        <h2 class="section-card__title">{{ title }}</h2>
      </slot>
    </header>
    <div class="section-card__content">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="section-card__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.section-card {
  background: var(--card-bg);
  border: var(--card-border);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  padding: var(--card-padding);
  margin-bottom: var(--section-gap);
}

.section-card--sm {
  padding: var(--card-padding-sm);
  border-radius: var(--radius-sm);
}

.section-card--lg {
  padding: var(--gap-2xl);
  border-radius: var(--card-radius-lg);
}

.section-card--elevated {
  box-shadow: var(--shadow-lg);
}

.section-card__header {
  margin-bottom: var(--gap-lg);
}

.section-card__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--brand);
  line-height: var(--line-height-tight);
}

.section-card__content {
  /* デフォルトスタイルなし - コンテンツに依存 */
}

.section-card__footer {
  margin-top: var(--gap-lg);
  padding-top: var(--gap-lg);
  border-top: var(--border-width) solid var(--border-color);
}

/* 最後のカードの下マージンを削除 */
.section-card:last-child {
  margin-bottom: 0;
}
</style>
