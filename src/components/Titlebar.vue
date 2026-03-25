<script setup lang="ts">
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useActivities } from "../composables/useActivities";

const { isDark, toggleDarkMode } = useActivities();

const minimize = () => getCurrentWindow().minimize();
const close = () => getCurrentWindow().close();
const startDragging = () => getCurrentWindow().startDragging();
</script>

<template>
  <div
    class="flex justify-between items-center h-10 bg-slate-200 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 select-none border-b border-slate-300 dark:border-zinc-800 transition-colors shrink-0 rounded-t-[12px] md:rounded-t-[18px] overflow-hidden"
  >
    <!-- Drag Region solo para el título y el espacio flexible restante -->
    <div
      data-tauri-drag-region
      @mousedown="startDragging"
      class="flex items-center px-4 gap-2 h-full flex-1 cursor-move"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 text-blue-500 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span
        class="text-xs font-semibold tracking-wider uppercase text-slate-700 dark:text-zinc-300 pointer-events-none"
      >
        Calculadora de horas
      </span>
    </div>

    <!-- Botones interactivos (Fuera del drag-region) -->
    <div class="flex h-full">
      <button
        @click="toggleDarkMode"
        class="inline-flex items-center justify-center w-11 h-full hover:bg-slate-300 dark:hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
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
            stroke-width="2"
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
            stroke-width="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      </button>

      <button
        @click="minimize"
        class="inline-flex items-center justify-center w-11 h-full hover:bg-slate-300 dark:hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24">
          <path fill="currentColor" d="M20 14H4v-4h16v4Z" />
        </svg>
      </button>

      <button
        @click="close"
        class="inline-flex items-center justify-center w-11 h-full hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
