<script setup lang="ts">
/**
 * SettingsLinkList.vue
 * 「カテゴリ管理」「通知設定」など関連設定リンクの見た目を統一
 */
import type { Component } from "vue";

export interface SettingsLinkItem {
  title: string;
  description?: string;
  icon?: Component;
  to?: object | string;
  onClick?: () => void;
}

interface Props {
  items: SettingsLinkItem[];
}

defineProps<Props>();
</script>

<template>
  <div class="settings-link-list">
    <component
      :is="item.to ? 'router-link' : 'button'"
      v-for="(item, index) in items"
      :key="index"
      :to="item.to"
      type="button"
      class="settings-link-item"
      @click="item.onClick"
    >
      <span
        v-if="item.icon || $slots[`icon-${index}`]"
        class="settings-link-item__icon"
      >
        <slot :name="`icon-${index}`">
          <component :is="item.icon" v-if="item.icon" />
        </slot>
      </span>
      <span class="settings-link-item__content">
        <span class="settings-link-item__title">{{ item.title }}</span>
        <span v-if="item.description" class="settings-link-item__description">
          {{ item.description }}
        </span>
      </span>
      <span class="settings-link-item__arrow" aria-hidden="true">→</span>
    </component>
  </div>
</template>

<style scoped>
.settings-link-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.settings-link-item {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  cursor: pointer;
  text-align: left;
  text-decoration: none;
  transition: var(--ui-transition-all);
  width: 100%;
}

.settings-link-item:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-brand-100, #e5f6f8);
}

.settings-link-item:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.settings-link-item__icon {
  width: 32px;
  height: 32px;
  border-radius: var(--ui-radius-sm, 0.5rem);
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-600, #4f7c82);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.settings-link-item__icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.settings-link-item__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  min-width: 0;
}

.settings-link-item__title {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
  line-height: var(--ui-leading-tight, 1.25);
}

.settings-link-item__description {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-normal, 1.5);
}

.settings-link-item__arrow {
  color: var(--ui-text-muted, #64748b);
  font-weight: var(--ui-font-semibold, 600);
  flex-shrink: 0;
}
</style>
