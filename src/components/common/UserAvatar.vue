<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  src?: string | null
  name?: string | null
  size?: number | string
  alt?: string
}

const props = withDefaults(defineProps<Props>(), {
  src: null,
  name: '',
  size: 32,
  alt: 'User Avatar',
})

const initials = computed(() => {
  return (props.name || 'U').charAt(0).toUpperCase()
})

const style = computed(() => {
  const sizeVal = typeof props.size === 'number' ? `${props.size}px` : props.size
  return {
    width: sizeVal,
    height: sizeVal,
    fontSize: `calc(${sizeVal} * 0.4)`,
  }
})
</script>

<template>
  <div class="user-avatar" :style="style">
    <img v-if="src" :src="src" :alt="alt" class="avatar-image" />
    <span v-else class="avatar-initials">{{ initials }}</span>
  </div>
</template>

<style scoped>
.user-avatar {
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #b8e3e9 0%, #89c5cc 100%);
  color: #0b2e33;
  font-weight: 600;
  flex-shrink: 0;
  user-select: none;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initials {
  line-height: 1;
}
</style>
