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
        <!-- Dynamic Icon -->
        <div
          class="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10"
          :class="[
            variant === 'danger'
              ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
          ]"
        >
          <!-- Danger Icon -->
          <svg
            v-if="variant === 'danger'"
            class="h-6 w-6"
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
          <!-- Info Icon -->
          <svg
            v-else
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
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
          <BaseButton
            @click="$emit('cancel')"
            variant="secondary"
            class="flex-1"
            :label="cancelText"
          />
          <BaseButton
            @click="$emit('confirm')"
            :variant="confirmVariant as any"
            class="flex-1"
            :label="confirmText"
          />
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import BaseButton from "./shared/baseButton.vue";

defineProps({
  show: {
    type: Boolean,
    required: true,
  },
  variant: {
    type: String,
    default: "danger", // 'danger' | 'info'
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
  confirmVariant: {
    type: String,
    default: "danger",
  },
  cancelText: {
    type: String,
    default: "Cancelar",
  },
});

defineEmits(["confirm", "cancel"]);
</script>
