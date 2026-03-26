<template>
  <div class="relative w-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-1 mb-2">
      <button
        type="button"
        @click="isFormOpen = !isFormOpen"
        class="cursor-pointer flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors focus:outline-none"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4 transition-transform duration-200"
          :class="{ 'rotate-90': isFormOpen }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        Añadir Actividad
      </button>
    </div>

    <!-- Collapsible Form Body -->
    <transition
      enter-active-class="transition-all duration-300 ease-in-out overflow-hidden"
      enter-from-class="max-h-0 opacity-0"
      enter-to-class="max-h-96 opacity-100"
      leave-active-class="transition-all duration-200 ease-in-out overflow-hidden"
      leave-from-class="max-h-96 opacity-100"
      leave-to-class="max-h-0 opacity-0"
    >
      <div v-show="isFormOpen">
        <form
          @submit.prevent="submitForm"
          class="flex flex-col gap-2 relative min-h-0 pt-1"
        >
          <div class="flex items-center gap-2 mb-2">
            <!-- Project Selector -->
            <div
              v-if="!isCreatingProject"
              class="flex-1 flex items-center gap-1"
            >
              <select
                v-model="projectId"
                class="flex-1 min-w-0 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-slate-100 transition-colors"
              >
                <option value="">Sin proyecto</option>
                <option v-for="p in projects" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select>
              <button
                type="button"
                @click="isCreatingProject = true"
                class="cursor-pointer p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors shrink-0"
                title="Nuevo proyecto"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>

            <!-- Create Project Inline -->
            <div v-else class="flex-1 flex items-center gap-1">
              <input
                type="text"
                v-model="newProjectName"
                placeholder="Nombre..."
                class="flex-1 min-w-0 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-blue-400 dark:border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-slate-100 transition-colors"
                @keyup.enter.prevent="createProject"
              />
              <button
                type="button"
                @click="createProject"
                class="cursor-pointer p-1.5 text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors shrink-0"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </button>
              <button
                type="button"
                @click="isCreatingProject = false"
                class="cursor-pointer p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4"
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
            </div>

            <!-- Ticket Input -->
            <input
              type="text"
              v-model="ticket"
              placeholder="Ticket ej. #123"
              class="w-28 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-slate-100 placeholder-slate-400 transition-colors"
            />
          </div>

          <div class="flex items-center gap-2">
            <input
              type="text"
              v-model="name"
              placeholder="Tarea..."
              required
              class="flex-1 min-w-0 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-slate-100 placeholder-slate-400 transition-colors"
            />

            <div
              class="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-colors"
            >
              <input
                type="number"
                v-model="hours"
                min="0"
                step="1"
                placeholder="0h"
                class="w-12 px-2 py-2 text-sm text-center bg-transparent outline-none dark:text-slate-100 placeholder-slate-400"
              />
              <span class="text-slate-300 dark:text-slate-600">:</span>
              <input
                type="number"
                v-model="minutes"
                min="0"
                max="59"
                step="1"
                placeholder="0m"
                class="w-12 px-2 py-2 text-sm text-center bg-transparent outline-none dark:text-slate-100 placeholder-slate-400"
              />
            </div>

            <button
              type="submit"
              :disabled="!isValid"
              :class="{
                'cursor-not-allowed': !isValid,
                'cursor-pointer': isValid,
              }"
              :title="
                !isValid ? 'Por favor, ingrese una tarea y un tiempo' : ''
              "
              class="p-2 aspect-square bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-all active:scale-95 flex items-center justify-center shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { Project } from "../composables/useActivities";

const props = defineProps<{
  projects: Project[];
  addProject: (name: string) => string;
}>();

const emit = defineEmits<{
  (
    e: "add",
    name: string,
    minutes: number,
    projectId?: string,
    ticket?: string,
  ): void;
}>();

const name = ref("");
const hours = ref<number | "">("");
const minutes = ref<number | "">("");
const projectId = ref<string>("");
const ticket = ref("");

const isFormOpen = ref(false);
const isCreatingProject = ref(false);
const newProjectName = ref("");

const isValid = computed(() => {
  if (!name.value.trim()) return false;
  const h = typeof hours.value === "number" ? hours.value : 0;
  const m = typeof minutes.value === "number" ? minutes.value : 0;
  return h > 0 || m > 0;
});

function submitForm() {
  if (!isValid.value) return;

  const h = typeof hours.value === "number" ? hours.value : 0;
  const m = typeof minutes.value === "number" ? minutes.value : 0;
  const totalMins = h * 60 + m;

  emit(
    "add",
    name.value.trim(),
    totalMins,
    projectId.value || undefined,
    ticket.value.trim() || undefined,
  );

  // reset
  name.value = "";
  hours.value = "";
  minutes.value = "";
  ticket.value = "";
  isFormOpen.value = false;
}

function createProject() {
  if (newProjectName.value.trim()) {
    const newId = props.addProject(newProjectName.value.trim());
    projectId.value = newId;
    newProjectName.value = "";
    isCreatingProject.value = false;
  }
}
</script>
