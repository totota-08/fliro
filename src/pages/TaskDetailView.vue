<script setup lang="ts">
import AttachmentsPanel from "@/components/task/AttachmentsPanel.vue";
import ChecklistPanel from "@/components/task/ChecklistPanel.vue";
import CommentsPanel from "@/components/task/CommentsPanel.vue";
import LinksPanel from "@/components/task/LinksPanel.vue";
import ActivityPanel from "@/components/task/ActivityPanel.vue";
import TaskDescription from "@/components/task/TaskDescription.vue";
import TaskHeader from "@/components/task/TaskHeader.vue";
import TaskSidebar from "@/components/task/TaskSidebar.vue";
import "@/styles/taskDetail.css";
import { useTaskDetailStore } from "@/stores/taskDetail";
import type { CommentType } from "@/types/task";
import { onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const taskId = computed(() => String(route.params.taskId));
const store = useTaskDetailStore();

const isLoading = computed(() => store.loading);
const hasError = computed(() => store.error);

onMounted(() => {
  store.load(taskId.value);
});

const postComment = async (payload: { type: CommentType; body: string }) => {
  await store.postComment(taskId.value, {
    type: payload.type,
    body: payload.body,
    authorId: "me",
  });
};

const addChecklist = async (body: string) => {
  await store.addChecklist(taskId.value, body);
};

const toggleChecklist = async (id: string, done: boolean) => {
  await store.toggleChecklistItem(taskId.value, id, done);
};

const addLink = async (link: { title: string; url: string }) => {
  // UI only
  // In a real app this would call a Firestore addDoc
  void link;
};

const uploadAttachment = async (file: File) => {
  await store.uploadAttachment(taskId.value, file);
};

const resolveQuestion = async (id: string, resolved: boolean) => {
  await store.setQuestionResolved(taskId.value, id, resolved);
};
</script>

<template>
  <div class="task-shell">
    <nav class="task-nav">
      <button aria-label="戻る" @click="router.back()">←</button>
      <button aria-label="次へ">↓</button>
    </nav>

    <main class="task-main">
      <div class="task-main__inner">
        <TaskHeader
          class="sticky-header"
          :task="store.task"
          @update:title="(val) => store.updateTaskField(taskId, { title: val })"
          @update:state="(val) => store.updateTaskField(taskId, { state: val })"
          @update:assignee="() => {}"
          @update:priority="() => {}"
          @update:due="() => {}"
        />

        <div v-if="hasError" class="section-card">
          <p>読み込みに失敗しました: {{ hasError }}</p>
          <button class="btn primary" @click="store.load(taskId)">リトライ</button>
        </div>

        <div v-else-if="isLoading || !store.task" class="section-card">
          <p>読み込み中...</p>
        </div>

        <template v-else>
          <TaskDescription :task="store.task" @save="(val) => store.updateTaskField(taskId, { description: val })" />

          <div class="two-column">
            <ChecklistPanel
              :task-id="taskId"
              :items="store.checklist"
              @add="addChecklist"
              @toggle="toggleChecklist"
            />
            <AttachmentsPanel :attachments="store.attachments" @upload="uploadAttachment" @open="() => {}" />
          </div>

          <LinksPanel :links="store.links" @add="addLink" />

          <CommentsPanel
            :comments="store.comments"
            @post="postComment"
            @resolve-question="resolveQuestion"
            @subtaskify="() => {}"
          />

          <ActivityPanel :events="store.events" />
        </template>
      </div>
    </main>

    <aside class="task-sidebar">
      <TaskSidebar
        :task="store.task"
        :decisions="store.decisions"
        :open-questions="store.openQuestions"
        :open-checklist="store.openChecklist"
        :watchers="store.task?.watcherIds || []"
      />
    </aside>
  </div>
</template>
