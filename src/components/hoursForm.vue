<template>
  <transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 pb-3 sm:px-4 sm:pb-0"
      @click.self="close"
    >
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95"
        enter-to-class="translate-y-0 opacity-100 sm:scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100 sm:scale-100"
        leave-to-class="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95"
      >
        <div
          v-if="show"
          class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm overflow-hidden"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700"
          >
            <div class="flex items-center gap-2">
              <div
                class="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-500/20"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3.5 w-3.5 text-purple-600 dark:text-purple-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <h3
                class="text-sm font-semibold text-slate-800 dark:text-slate-100"
              >
                Nueva Actividad
              </h3>
            </div>
            <button
              @click="close"
              class="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
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

          <!-- Body -->
          <form @submit.prevent="submitForm" class="flex flex-col gap-3 p-4">
            <!-- Row 1: Project + Ticket -->
            <div class="flex items-center gap-2">
              <!-- Project Selector -->
              <div
                v-if="!isCreatingProject"
                class="flex-1 flex items-center gap-1 min-w-0"
              >
                <select
                  v-model="projectId"
                  class="flex-1 min-w-0 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none dark:text-slate-100"
                >
                  <option value="">Sin proyecto</option>
                  <option v-for="p in projects" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </select>
                <button
                  v-if="!hasProjectToken"
                  type="button"
                  @click="isCreatingProject = true"
                  class="cursor-pointer p-1.5 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors shrink-0"
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
              <div v-else class="flex-1 flex items-center gap-1 min-w-0">
                <input
                  type="text"
                  v-model="newProjectName"
                  placeholder="Nombre del proyecto..."
                  class="flex-1 min-w-0 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-purple-400 dark:border-purple-500 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none dark:text-slate-100"
                  @keyup.enter.prevent="createProject"
                />
                <button
                  type="button"
                  @click="createProject"
                  class="cursor-pointer p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg shrink-0"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </button>
                <button
                  type="button"
                  @click="isCreatingProject = false"
                  class="cursor-pointer p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg shrink-0"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Ticket Input -->
              <div class="relative shrink-0">
                <input
                  type="text"
                  v-model="ticket"
                  @blur="onTicketBlur"
                  placeholder="#Ticket"
                  :class="[
                    'w-24 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none dark:text-slate-100 placeholder-slate-400',
                    isLoadingTicket ? 'opacity-50' : '',
                  ]"
                />
                <span
                  v-if="isLoadingTicket"
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"
                />
              </div>
            </div>

            <!-- Ticket title badge -->
            <transition
              enter-active-class="transition-all duration-200"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
            >
              <span
                v-if="ticketTitle"
                class="inline-flex items-center w-max px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30"
                :title="ticketTitle"
              >
                {{ ticketTitle }}
              </span>
            </transition>

            <!-- Row 2: Task name -->
            <input
              type="text"
              v-model="name"
              placeholder="Descripción de la tarea..."
              required
              class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none dark:text-slate-100 placeholder-slate-400"
            />

            <!-- Row 3: Time -->
            <div class="flex items-center gap-2">
              <div
                class="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500 flex-1"
              >
                <span
                  class="pl-3 pr-1 text-xs text-slate-400 dark:text-slate-500 select-none"
                  >h</span
                >
                <input
                  type="number"
                  v-model="hours"
                  min="0"
                  step="1"
                  placeholder="0"
                  class="w-full px-1 py-2 text-sm text-center bg-transparent outline-none dark:text-slate-100 placeholder-slate-400"
                />
                <span class="text-slate-300 dark:text-slate-600 px-1">:</span>
                <span
                  class="pr-1 text-xs text-slate-400 dark:text-slate-500 select-none"
                  >m</span
                >
                <input
                  type="number"
                  v-model="minutes"
                  min="0"
                  max="59"
                  step="1"
                  placeholder="0"
                  class="w-full px-1 py-2 text-sm text-center bg-transparent outline-none dark:text-slate-100 placeholder-slate-400"
                />
              </div>
            </div>

            <!-- Footer actions -->
            <div class="flex gap-2 pt-1">
              <button
                type="button"
                @click="close"
                class="cursor-pointer flex-1 py-2 px-3 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="!isValid"
                class="cursor-pointer flex-1 py-2 px-3 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
              >
                Añadir
              </button>
            </div>
          </form>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Project } from "../composables/useActivities";

const props = defineProps<{
  show: boolean;
  projects: Project[];
  addProject: (name: string) => string;
  hasProjectToken?: boolean;
  fetchTicketSubject?: (
    id: string,
  ) => Promise<{ subject: string; projectId: string } | null>;
}>();

const emit = defineEmits<{
  (
    e: "add",
    name: string,
    minutes: number,
    projectId?: string,
    ticket?: string,
    ticketTitle?: string,
  ): void;
  (e: "close"): void;
}>();

const name = ref("");
const hours = ref<number | "">("");
const minutes = ref<number | "">("");
const projectId = ref<string>("");
const ticket = ref("");

const isCreatingProject = ref(false);
const newProjectName = ref("");
const isLoadingTicket = ref(false);
const ticketTitle = ref("");

// Reset form when modal opens
watch(
  () => props.show,
  (val) => {
    if (val) {
      name.value = "";
      hours.value = "";
      minutes.value = "";
      ticket.value = "";
      ticketTitle.value = "";
      projectId.value = "";
      isCreatingProject.value = false;
      newProjectName.value = "";
    }
  },
);

async function onTicketBlur() {
  const raw = ticket.value.trim().replace(/^#/, "");
  if (!raw || !props.fetchTicketSubject) return;
  isLoadingTicket.value = true;
  ticketTitle.value = "";
  try {
    const result = await props.fetchTicketSubject(raw);
    if (result) {
      ticketTitle.value = result.subject;
      if (result.projectId) projectId.value = result.projectId;
    }
  } finally {
    isLoadingTicket.value = false;
  }
}

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
  emit(
    "add",
    name.value.trim(),
    h * 60 + m,
    projectId.value || undefined,
    ticket.value.trim() || undefined,
    ticketTitle.value.trim() || undefined,
  );
  emit("close");
}

function createProject() {
  if (newProjectName.value.trim()) {
    const newId = props.addProject(newProjectName.value.trim());
    projectId.value = newId;
    newProjectName.value = "";
    isCreatingProject.value = false;
  }
}

function close() {
  emit("close");
}
</script>
