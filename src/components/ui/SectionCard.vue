<script setup lang="ts">
/**
 * SectionCard - 統一カードコンポーネント
 *
 * Deep Green / Card UI デザインに準拠したカードラッパー
 * 影、枠線、角丸、余白を統一
 */

withDefaults(
  defineProps<{
    /** カードのサイズ */
    size?: "sm" | "md" | "lg";
    /** 影を強調するか */
    elevated?: boolean;
    /** ヘッダーを表示するか */
    showHeader?: boolean;
    /** タイトル */
    title?: string;
    /** サブタイトル */
    subtitle?: string;
  }>(),
  {
    size: "md",
    elevated: false,
    showHeader: false,
    title: undefined,
    subtitle: undefined,
  },
);
</script>

<template>
  <section
    :class="[
      'section-card',
      `section-card--${size}`,
      { 'section-card--elevated': elevated },
    ]"
  >
    <header
      v-if="showHeader || title || $slots.header"
      class="section-card__header"
    >
      <slot name="header">
        <div v-if="title" class="section-card__header-content">
          <h3 class="section-card__title">{{ title }}</h3>
          <p v-if="subtitle" class="section-card__subtitle">{{ subtitle }}</p>
        </div>
      </slot>
      <div v-if="$slots.headerActions" class="section-card__header-actions">
        <slot name="headerActions" />
      </div>
    </header>

    <div class="section-card__body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="section-card__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.section-card {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-xl, 1.25rem);
  box-shadow: var(--ui-shadow-md, 0 4px 12px rgba(11, 46, 51, 0.08));
  overflow: hidden;
}

.section-card--elevated {
  box-shadow: var(--ui-shadow-lg, 0 12px 24px rgba(11, 46, 51, 0.1));
}

/* Size Variants */
.section-card--sm .section-card__header,
.section-card--sm .section-card__body,
.section-card--sm .section-card__footer {
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
}

.section-card--md .section-card__header,
.section-card--md .section-card__body,
.section-card--md .section-card__footer {
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
}

.section-card--lg .section-card__header,
.section-card--lg .section-card__body,
.section-card--lg .section-card__footer {
  padding: var(--ui-space-6, 1.5rem);
}

/* Header */
.section-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--ui-space-4, 1rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.section-card__header-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.section-card__title {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.section-card__subtitle {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.section-card__header-actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  flex-shrink: 0;
}

/* Body */
.section-card__body {
  /* パディングはサイズバリアントで設定 */
}

/* Footer */
.section-card__footer {
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface-muted, #f1f5f9);
}

/* Remove top padding when no header */
.section-card:not(:has(.section-card__header)) .section-card__body {
  padding-top: var(--ui-space-4, 1rem);
}

/* Remove bottom padding when no footer */
.section-card:not(:has(.section-card__footer)) .section-card__body {
  padding-bottom: var(--ui-space-4, 1rem);
}
</style>
