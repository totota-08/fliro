<script setup lang="ts">
interface CommandItem {
  key: string;
  label: string;
  description?: string;
  insert?: string;
}

defineProps<{
  open: boolean;
  commands: CommandItem[];
}>();

const emit = defineEmits<{
  (e: "select", command: CommandItem): void;
}>();
</script>

<template>
  <div v-if="open && commands.length" class="command-dropdown">
    <button
      v-for="cmd in commands"
      :key="cmd.key"
      type="button"
      @click="emit('select', cmd)"
    >
      <strong>{{ cmd.label }}</strong>
      <span>{{ cmd.description }}</span>
    </button>
  </div>
</template>

<style scoped>
.command-dropdown {
  display: grid;
  gap: 0.35rem;
  padding: 0.5rem 0;
  margin-bottom: 0.35rem;
}

.command-dropdown button {
  border: 1px solid #d1dae8;
  background: #fff;
  border-radius: 0.85rem;
  padding: 0.5rem 0.65rem;
  cursor: pointer;
  text-align: left;
  display: grid;
  gap: 0.1rem;
}

.command-dropdown strong {
  color: #0b2e33;
}

.command-dropdown span {
  color: #64748b;
  font-size: 0.85rem;
}
</style>
