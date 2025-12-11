<script setup lang="ts">
import { useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

const model = defineModel<string | number | undefined>();

const props = defineProps<{
  label: string;
  hint?: string;
}>();

const attrs = useAttrs();
</script>

<template>
  <label class="auth-field">
    <span>{{ props.label }}</span>
    <input v-model="model" v-bind="attrs" />
    <small v-if="props.hint">{{ props.hint }}</small>
  </label>
</template>

<style scoped>
.auth-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
  color: #0b2e33;
}

.auth-field input {
  border: 1px solid #93b1b5;
  border-radius: 0.85rem;
  padding: 0.85rem 1rem;
  font-size: 1rem;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
  background: #fdfefe;
}

.auth-field input:focus {
  outline: none;
  border-color: #4f7c82;
  box-shadow: 0 0 0 3px rgba(79, 124, 130, 0.2);
}

.auth-field small {
  color: #93b1b5;
  font-weight: 400;
}
</style>
