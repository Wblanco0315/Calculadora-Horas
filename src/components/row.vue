<template>
  <div
    class="group relative flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-200"
  >
    <div class="flex items-center gap-3 overflow-hidden">
      <!-- Icon Indicator -->
      <div
        class="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.5"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
      <div class="min-w-0 pr-2">
        <h3
          class="font-medium text-sm text-slate-800 dark:text-slate-200 truncate"
        >
          {{ activity.name }}
        </h3>
      </div>
    </div>

    <div class="flex items-center gap-3 shrink-0">
      <div class="flex items-center gap-1.5">
        <span
          class="text-xs font-medium text-slate-400 dark:text-slate-500"
        >
          {{ formatDecimal(activity.minutes) }}h
        </span>
        <div
          class="text-sm font-semibold font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded"
        >
          {{ formatTime(activity.minutes) }}
        </div>
      </div>
      <button
        @click="$emit('delete', activity.id)"
        class="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 -ml-1"
        aria-label="Remove activity"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Activity } from "../composables/useActivities";

defineProps<{
  activity: Activity;
}>();

defineEmits<{
  (e: "delete", id: string): void;
}>();

function formatTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const h = hours.toString().padStart(2, "0");
  const m = minutes.toString().padStart(2, "0");
  return `${h}h ${m}m`;
}

function formatDecimal(totalMinutes: number) {
  // Convertimos a base 10 y limpiamos ceros arrastrados (e.g. 1.50 -> 1.5)
  return parseFloat((totalMinutes / 60).toFixed(2));
}
</script>
