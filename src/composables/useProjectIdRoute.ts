import { ref, watch } from "vue";
import { useRoute } from "vue-router";

export function useProjectIdRoute() {
  const route = useRoute();
  const projectId = ref(String(route.params.projectId ?? ""));

  watch(
    () => route.params.projectId,
    (value) => {
      projectId.value = value ? String(value) : "";
    },
  );

  return { projectId };
}
