<script setup lang="ts">
import { onMounted } from "vue";
import Calculator from "./components/calculator.vue";
import ConfirmModal from "./components/confirmModal.vue";
import { useUpdater } from "./composables/useUpdater";

const {
  updateAvailable,
  version,
  isUpdating,
  downloadProgress,
  checkForUpdates,
  installUpdate,
} = useUpdater();

onMounted(() => {
  checkForUpdates(true);
});
</script>

<template>
  <main class="h-relative h-screen w-screen p-0 bg-transparent overflow-hidden">
    <Calculator />

    <ConfirmModal
      :show="updateAvailable && !isUpdating"
      title="Actualización Disponible"
      :message="`Hay una nueva versión (${version}) disponible. ¿Deseas descargarla e instalarla ahora?`"
      confirmText="Actualizar"
      cancelText="Más tarde"
      variant="info"
      confirmVariant="primary"
      @confirm="installUpdate"
      @cancel="updateAvailable = false"
    />

    <div
      v-if="isUpdating"
      class="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div
        class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl flex flex-col items-center min-w-[280px] w-full max-w-sm"
      >
        <svg
          class="animate-spin h-8 w-8 text-indigo-600 dark:text-indigo-400 mb-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>

        <p class="text-slate-900 dark:text-white font-medium mb-4 text-center">
          Descargando actualización...
        </p>

        <!-- Progress bar container -->
        <div
          class="w-full bg-slate-100 dark:bg-slate-700/60 rounded-full h-2.5 mb-2 overflow-hidden shadow-inner border border-slate-200 dark:border-slate-700/50"
        >
          <div
            class="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-300 ease-out"
            :style="{ width: `${downloadProgress}%` }"
          ></div>
        </div>

        <!-- Percentage text -->
        <div class="w-full flex justify-end">
          <span
            class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wide font-mono"
          >
            {{ downloadProgress }}%
          </span>
        </div>
      </div>
    </div>
  </main>
</template>
