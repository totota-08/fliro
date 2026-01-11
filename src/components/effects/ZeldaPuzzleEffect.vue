<script setup lang="ts">
import { watch } from "vue";

interface Props {
  show: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  complete: [];
}>();

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      playSound();
    }
  },
);

function playSound() {
  try {
    const audioContext = new AudioContext();

    // ゼルダ風の謎解き完了音（上昇するアルペジオ）
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const noteDuration = 0.15;

    notes.forEach((freq, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = "sine";
      oscillator.frequency.value = freq;

      const startTime = audioContext.currentTime + i * noteDuration;
      const endTime = startTime + noteDuration * 1.5;

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

      oscillator.start(startTime);
      oscillator.stop(endTime);
    });

    // 最後の音が終わったら完了を通知
    setTimeout(
      () => {
        emit("complete");
      },
      notes.length * noteDuration * 1000 + 200,
    );
  } catch {
    // AudioContext が使えない場合は即座に完了
    emit("complete");
  }
}
</script>

<template>
  <!-- 音声のみ、視覚的な要素なし -->
</template>
