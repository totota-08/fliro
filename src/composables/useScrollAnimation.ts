import { ref, onMounted, onUnmounted, type Ref } from "vue";

export interface ScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

/**
 * スクロールアニメーション用のComposable
 * Intersection Observerを使用して要素がビューポートに入ったときにアニメーションを発火
 */
export function useScrollAnimation(options: ScrollAnimationOptions = {}): {
  elementRef: Ref<HTMLElement | null>;
  isVisible: Ref<boolean>;
} {
  const { threshold = 0.1, rootMargin = "0px", once = true } = options;

  const elementRef = ref<HTMLElement | null>(null);
  const isVisible = ref(false);
  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    // prefers-reduced-motionを尊重
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      isVisible.value = true;
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisible.value = true;
            if (once && observer && elementRef.value) {
              observer.unobserve(elementRef.value);
            }
          } else if (!once) {
            isVisible.value = false;
          }
        });
      },
      { threshold, rootMargin },
    );

    if (elementRef.value) {
      observer.observe(elementRef.value);
    }
  });

  onUnmounted(() => {
    if (observer) {
      observer.disconnect();
    }
  });

  return { elementRef, isVisible };
}
