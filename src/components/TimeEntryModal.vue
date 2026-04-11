<template>
  <transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    >
      <div
        class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full overflow-hidden flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Enviar tiempo a OpenProject
          </h3>
        </div>

        <!-- Body -->
        <div class="p-4 flex flex-col gap-3">
          <!-- Date -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-400">Fecha</label>
            <input
              type="date"
              v-model="localDate"
              class="w-full px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
            />
          </div>

          <!-- Activity type -->
          <div v-if="timeEntryActivities?.length" class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-400">Tipo de actividad</label>
            <select
              v-model="localActivityId"
              class="w-full px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
            >
              <option value="">Sin tipo</option>
              <option v-for="a in timeEntryActivities" :key="a.id" :value="a.id">
                {{ a.name }}
              </option>
            </select>
          </div>

          <!-- Comment -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-400">Comentario</label>
            <textarea
              v-model="localComment"
              rows="3"
              placeholder="Comentario..."
              class="w-full px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 resize-none"
            />
          </div>
        </div>

        <!-- Actions -->
        <div class="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-between gap-3">
          <button
            @click="$emit('cancel')"
            class="cursor-pointer flex-1 py-1.5 px-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            @click="confirm"
            :disabled="!localComment.trim() || !localDate"
            class="cursor-pointer flex-1 py-1.5 px-3 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:outline-none focus:ring-indigo-500/50 transition-colors shadow-sm"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { TimeEntryActivity } from "../composables/useActivities";

const props = defineProps<{
  show: boolean;
  initialComment?: string;
  timeEntryActivities?: TimeEntryActivity[];
}>();

const emit = defineEmits<{
  (e: "confirm", comment: string, spentOn: string, activityTypeId: string): void;
  (e: "cancel"): void;
}>();

const localComment = ref("");
const localDate = ref("");
const localActivityId = ref("");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      localComment.value = props.initialComment ?? "";
      localDate.value = todayISO();
      localActivityId.value = "";
    }
  },
);

function confirm() {
  if (!localComment.value.trim() || !localDate.value) return;
  emit("confirm", localComment.value.trim(), localDate.value, localActivityId.value);
}
</script>
