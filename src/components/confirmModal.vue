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
      class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    >
      <div
        class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full overflow-hidden flex flex-col items-center pt-5"
      >
        <!-- Warning Icon -->
        <div
          class="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/20 sm:mx-0 sm:h-10 sm:w-10"
        >
          <svg
            class="h-6 w-6 text-rose-600 dark:text-rose-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div class="p-4 text-center">
          <h3
            class="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            {{ title }}
          </h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {{ message }}
          </p>
        </div>

        <!-- Modal Actions -->
        <div
          class="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-t border-slate-100 dark:border-slate-700 w-full flex justify-between gap-3 items-center"
        >
          <button
            @click="$emit('cancel')"
            class="cursor-pointer flex-1 py-1.5 px-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
          >
            {{ cancelText }}
          </button>
          <button
            @click="$emit('confirm')"
            class="cursor-pointer flex-1 py-1.5 px-3 text-sm font-medium text-white bg-rose-600 border border-transparent rounded-lg hover:bg-rose-700 focus:ring-2 focus:outline-none focus:ring-rose-500/50 transition-colors shadow-sm"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
defineProps({
  show: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    default: "Atención",
  },
  message: {
    type: String,
    default: "¿Estás seguro de continuar con esta acción?",
  },
  confirmText: {
    type: String,
    default: "Aceptar",
  },
  cancelText: {
    type: String,
    default: "Cancelar",
  },
});

defineEmits(["confirm", "cancel"]);
</script>
