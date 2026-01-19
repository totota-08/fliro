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

/**
 * 複数要素のスタッガードアニメーション用のComposable
 */
export function useStaggeredAnimation(
  _itemCount: Ref<number>,
  options: ScrollAnimationOptions & { staggerDelay?: number } = {},
): {
  containerRef: Ref<HTMLElement | null>;
  isContainerVisible: Ref<boolean>;
  getItemDelay: (index: number) => string;
} {
  const { staggerDelay = 100 } = options;
  const { elementRef: containerRef, isVisible: isContainerVisible } =
    useScrollAnimation(options);

  const getItemDelay = (index: number): string => {
    return `${index * staggerDelay}ms`;
  };

  return { containerRef, isContainerVisible, getItemDelay };
}

/**
 * カウントアップアニメーション用のComposable
 */
export function useCountUp(
  targetValue: number,
  duration: number = 2000,
): {
  elementRef: Ref<HTMLElement | null>;
  currentValue: Ref<number>;
  isVisible: Ref<boolean>;
} {
  const { elementRef, isVisible } = useScrollAnimation({ once: true });
  const currentValue = ref(0);
  let animationFrame: number | null = null;

  const animate = () => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      currentValue.value = targetValue;
      return;
    }

    const startTime = performance.now();
    const startValue = 0;

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      currentValue.value = Math.floor(
        startValue + (targetValue - startValue) * eased,
      );

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        currentValue.value = targetValue;
      }
    };

    animationFrame = requestAnimationFrame(step);
  };

  onMounted(() => {
    const unwatch = watchEffect(() => {
      if (isVisible.value) {
        animate();
        unwatch();
      }
    });
  });

  onUnmounted(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });

  return { elementRef, currentValue, isVisible };
}

// watchEffectのimport追加
import { watchEffect } from "vue";
