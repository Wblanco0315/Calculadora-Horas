<template>
  <div
    class="flex-1 w-full bg-slate-50/95 dark:bg-[#0B1120]/95 backdrop-blur-sm flex flex-col items-center justify-center p-4"
  >
    <div
      class="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700"
    >
      <div
        class="p-6 text-center border-b border-slate-100 dark:border-slate-700 relative"
      >
        <button
          v-if="isModal"
          @click="$emit('close')"
          class="cursor-pointer absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div
          class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2
          class="text-xl font-display font-bold text-slate-800 dark:text-slate-100"
        >
          Configura tu jornada laboral
        </h2>
      </div>

      <div class="p-6 space-y-4">
        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >Hora de entrada</label
          >
          <input
            type="time"
            v-model="entryTime"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 transition-colors"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >Hora de salida</label
          >
          <input
            type="time"
            v-model="exitTime"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 transition-colors"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >Descanso / Almuerzo (minutos)</label
          >
          <input
            type="number"
            v-model="lunchMinutes"
            min="0"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 transition-colors"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >Token OpenProject (Opcional)</label
          >
          <input
            type="password"
            v-model="openProjectToken"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 transition-colors"
          />
        </div>

        <BaseButton
          @click="save"
          :disabled="!isValid"
          label="Guardar"
          class="w-full mt-2"
          size="md"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { UserConfig } from "../composables/useUserConfig";
import BaseButton from "./shared/baseButton.vue";

const props = defineProps<{
  userConfig: UserConfig;
  isModal?: boolean;
}>();

const emit = defineEmits<{
  (e: "save", config: Partial<UserConfig>): void;
  (e: "close"): void;
}>();

const entryTime = ref(props.userConfig.entryTime || "08:00");
const exitTime = ref(props.userConfig.exitTime || "17:00");
const lunchMinutes = ref(props.userConfig.lunchMinutes ?? 60);
const openProjectToken = ref(props.userConfig.openProjectToken || "");

const isValid = computed(() => {
  return entryTime.value && exitTime.value && lunchMinutes.value >= 0;
});

function save() {
  if (!isValid.value) return;
  emit("save", {
    entryTime: entryTime.value,
    exitTime: exitTime.value,
    lunchMinutes: lunchMinutes.value,
    openProjectToken: openProjectToken.value.trim(),
    isConfigured: true,
  });
}
</script>

<style scoped>
.dark input[type="time"]::-webkit-calendar-picker-indicator {
  filter: invert(0.8) brightness(1.2);
}
.dark input[type="time"]:focus::-webkit-calendar-picker-indicator {
  filter: invert(0.6) sepia(1) saturate(3) hue-rotate(200deg); /* Un tono indigo al hacer focus */
}
</style>
