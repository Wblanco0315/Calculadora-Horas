<script setup lang="ts">
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { useTheme } from "../composables/useTheme";
import { ref, onMounted } from "vue";
import AppLogo from "./shared/appLogo.vue";

const { isDark, toggleDarkMode } = useTheme();

const appVersion = ref("");

onMounted(async () => {
  appVersion.value = await getVersion();
});

const minimize = () => getCurrentWindow().minimize();
const close = () => getCurrentWindow().close();
const startDragging = () => getCurrentWindow().startDragging();

defineEmits<{
  (e: "open-settings"): void;
}>();
</script>

<template>
  <div
    class="flex z-99 justify-between items-center h-8 bg-[#f3f3f3] dark:bg-[#202020] text-[#1a1a1a] dark:text-[#ffffff] select-none transition-colors shrink-0 overflow-hidden"
  >
    <!-- Drag Region (Title and flex space) -->
    <div
      data-tauri-drag-region
      @mousedown="startDragging"
      class="flex items-center px-3 gap-3 h-full flex-1 cursor-default"
    >
      <!-- App Icon (PocketProject style) -->
      <AppLogo class="h-4.5 w-4.5 drop-shadow-sm pointer-events-none" />
      <span class="text-xs font-bold text-slate-700 dark:text-slate-200 pointer-events-none">
        PocketProject
      </span>
      <span v-if="appVersion" class="text-[10px] font-medium text-slate-500 dark:text-slate-400 pointer-events-none">
        v{{ appVersion }}
      </span>
    </div>

    <!-- Window Controls -->
    <div class="flex h-full items-center">
      <!-- Theme Toggle (Custom App Button) -->
      <button
        @click="toggleDarkMode"
        class="inline-flex items-center justify-center w-[46px] h-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
        title="Tema"
      >
        <svg
          v-if="!isDark"
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      </button>

      <!-- Windows Native Minimize -->
      <button
        @click="minimize"
        class="inline-flex items-center justify-center w-[46px] h-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path
            d="M 0,5 H 10"
            stroke="currentColor"
            stroke-width="1"
            fill="none"
          />
        </svg>
      </button>

      <!-- Windows Native Close -->
      <button
        @click="close"
        class="inline-flex items-center justify-center w-[46px] h-full hover:bg-[#E81123] hover:text-white transition-colors cursor-pointer"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path
            d="M 0,0 L 10,10 M 10,0 L 0,10"
            stroke="currentColor"
            stroke-width="1"
            fill="none"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
