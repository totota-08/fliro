import { ref, onMounted, onUnmounted, type Ref } from "vue";

export function useInView(
  target: Ref<HTMLElement | null>,
  options: IntersectionObserverInit = { threshold: 0.15 },
) {
  const isInView = ref(false);
  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    if (!target.value) return;
    observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting) {
        isInView.value = true;
        observer?.unobserve(entry.target); // 一度だけ発火
      }
    }, options);
    observer.observe(target.value);
  });

  onUnmounted(() => observer?.disconnect());

  return { isInView };
}
