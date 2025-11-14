<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'outline'
    loading?: boolean
    to?: RouteLocationRaw
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
  }>(),
  {
    variant: 'primary',
    loading: false,
    type: 'button',
    block: false,
  },
)

const attrs = useAttrs()

const isLink = computed(() => Boolean(props.to))
const classes = computed(() => [
  'app-button',
  `app-button--${props.variant}`,
  { 'is-loading': props.loading, 'is-block': props.block },
])
</script>

<template>
  <component
    :is="isLink ? RouterLink : 'button'"
    :to="isLink ? to : undefined"
    :type="!isLink ? type : undefined"
    v-bind="attrs"
    :class="classes"
    :aria-busy="loading ? 'true' : undefined"
  >
    <span v-if="loading" class="app-button__spinner" aria-hidden="true" />
    <slot />
  </component>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 0.95rem;
  padding: 0.85rem 1.6rem;
  font-weight: 600;
  font-size: 1rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
  text-decoration: none;
}

.app-button--primary {
  background: #4f7c82;
  border-color: #4f7c82;
  color: #fff;
  box-shadow: 0 12px 28px rgba(79, 124, 130, 0.35);
}

.app-button--primary:not(:disabled):hover {
  background: #0b2e33;
  border-color: #0b2e33;
  transform: translateY(-1px);
}

.app-button--secondary {
  background: transparent;
  border-color: rgba(11, 46, 51, 0.2);
  color: #0b2e33;
}

.app-button--secondary:not(:disabled):hover {
  border-color: #4f7c82;
  color: #4f7c82;
  transform: translateY(-1px);
}

.app-button--outline {
  background: transparent;
  border-color: #4f7c82;
  color: #4f7c82;
}

.app-button--outline:not(:disabled):hover {
  background: rgba(79, 124, 130, 0.08);
}

.app-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.app-button.is-block {
  display: inline-flex;
  width: 100%;
}

.app-button__spinner {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  animation: spin 1s linear infinite;
}

.app-button--secondary .app-button__spinner,
.app-button--outline .app-button__spinner {
  border-color: rgba(11, 46, 51, 0.2);
  border-top-color: #0b2e33;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
