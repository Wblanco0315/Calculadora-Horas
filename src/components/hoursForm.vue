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
                class="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20"
              >
                <svg
                  v-if="viewState === 'favorites'"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  class="h-4 w-4 text-yellow-600 dark:text-yellow-400"
                >
                  <path
                    fill="currentColor"
                    d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2L9.19 8.62L2 9.24l5.45 4.73L5.82 21z"
                  />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400"
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
                {{
                  viewState === "favorites" ? "Favoritos" : "Nueva Actividad"
                }}
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

          <!-- Favorites View -->
          <div v-if="viewState === 'favorites'" class="flex flex-col">
            <div
              v-if="filteredFavorites.length > 0"
              class="overflow-y-auto max-h-64 divide-y divide-slate-100 dark:divide-slate-700"
            >
              <div
                v-for="fav in filteredFavorites"
                :key="fav.ticket"
                class="relative group"
              >
                <button
                  type="button"
                  @click="selectFavorite(fav)"
                  class="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex flex-col gap-1 pr-12"
                >
                  <div class="flex items-center gap-2">
                    <span
                      class="text-xs font-bold text-yellow-600 dark:text-yellow-500 shrink-0"
                      >#{{ fav.ticket }}</span
                    >
                    <span
                      v-if="getProjectName(fav.projectId)"
                      class="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 px-1.5 py-0.5 rounded truncate max-w-full"
                      :title="getProjectName(fav.projectId)"
                    >
                      {{ getProjectName(fav.projectId) }}
                    </span>
                  </div>
                  <span
                    class="text-sm text-slate-700 dark:text-slate-200 line-clamp-2"
                    >{{ fav.title }}</span
                  >
                </button>
                <button
                  @click.stop="
                    toggleFavorite(fav.ticket, fav.title, fav.projectId)
                  "
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 cursor-pointer"
                  title="Eliminar de favoritos"
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
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path
                      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>
            <div
              v-else
              class="p-8 text-center flex flex-col items-center justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-10 h-10 text-slate-300 dark:text-slate-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Aún no tienes tickets favoritos.
              </p>
            </div>
            <div
              class="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"
            >
              <BaseButton
                type="button"
                @click="
                  props.initialView === 'favorites'
                    ? close()
                    : (viewState = 'form')
                "
                variant="secondary"
                class="w-full"
                label="Volver"
              />
            </div>
          </div>

          <!-- Form View -->
          <form
            v-if="viewState === 'form'"
            @submit.prevent="submitForm"
            class="flex flex-col gap-3 p-4"
          >
            <!-- Row 1: Project + Ticket -->
            <div class="flex items-center gap-2">
              <!-- Project Selector -->
              <div
                v-if="!isCreatingProject"
                class="flex-1 flex items-center gap-1 min-w-0"
              >
                <select
                  v-model="projectId"
                  class="flex-1 min-w-0 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
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
                  class="cursor-pointer p-1.5 text-indigo-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors shrink-0"
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
                  class="flex-1 min-w-0 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-indigo-400 dark:border-indigo-500 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                  @keyup.enter.prevent="createProject"
                />
                <button
                  type="button"
                  @click="createProject"
                  class="cursor-pointer p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg shrink-0"
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
              <div class="relative shrink-0 flex items-center gap-1">
                <div class="relative">
                  <input
                    type="text"
                    v-model="ticket"
                    @input="ticket = ticket.replace(/\D/g, '')"
                    @blur="onTicketBlur"
                    placeholder="#Ticket"
                    :class="[
                      'w-24 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 placeholder-slate-400',
                      isLoadingTicket ? 'opacity-50' : '',
                    ]"
                  />
                  <span
                    v-if="isLoadingTicket"
                    class="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"
                  />
                </div>

                <button
                  v-if="ticket"
                  type="button"
                  @click="toggleFavorite(ticket, ticketTitle, projectId)"
                  class="p-1.5 text-slate-400 hover:text-yellow-500 transition-colors"
                  :class="{ 'text-yellow-500': isFavorite(ticket) }"
                  title="Guardar como favorito"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4"
                    :fill="isFavorite(ticket) ? 'currentColor' : 'none'"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </button>
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
                class="inline-flex items-center w-max px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30"
                :title="ticketTitle"
              >
                {{ ticketTitle }}
              </span>
            </transition>

            <!-- Row 2: Time + Date -->
            <div class="flex items-center gap-2">
              <input
                type="date"
                v-model="date"
                required
                class="w-43 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 placeholder-slate-400"
              />
              <div
                class="flex justify-evenly gap-1 bg-slate-50 dark:bg-[#0f172b] border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 flex-1 py-0.5"
              >
                <div class="flex items-center">
                  <input
                    type="number"
                    v-model="hours"
                    min="0"
                    step="1"
                    placeholder="0"
                    class="w-10 text-xs text-center bg-transparent outline-none dark:text-slate-100 placeholder-slate-400 font-medium"
                  />
                  <span
                    class="text-[11px] font-bold text-slate-400 dark:text-slate-500 select-none"
                    >h</span
                  >
                </div>

                <span class="text-slate-300 dark:text-slate-600 font-bold mx-1"
                  >:</span
                >

                <div class="flex items-center">
                  <input
                    type="number"
                    v-model="minutes"
                    min="0"
                    max="59"
                    step="1"
                    placeholder="0"
                    class="w-10 px-1 text-xs text-center bg-transparent outline-none bg-[#0f172b] dark:text-slate-100 placeholder-slate-400 font-medium"
                  />
                  <span
                    class="text-[11px] font-bold text-slate-400 dark:text-slate-500 select-none"
                    >m</span
                  >
                </div>
              </div>
            </div>

            <!-- Row 3: Description-->
            <div class="flex items-center gap-2">
              <textarea
                v-model="name"
                placeholder="Descripción de la tarea..."
                required
                rows="4"
                class="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100 placeholder-slate-400 resize-none"
              ></textarea>
            </div>

            <!-- Footer actions -->
            <div class="flex gap-2 pt-1">
              <BaseButton
                type="submit"
                :disabled="!isValid"
                variant="primary"
                class="flex-1"
                label="Añadir"
              />
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
import { useActivities } from "../composables/useActivities";
import BaseButton from "./shared/baseButton.vue";

const props = defineProps<{
  show: boolean;
  projects: Project[];
  addProject: (name: string) => string;
  hasProjectToken?: boolean;
  initialTicket?: string;
  initialTicketTitle?: string;
  initialProjectId?: string;
  initialView?: "form" | "favorites";
  fetchTicketSubject?: (id: string) => Promise<{
    subject: string;
    projectId: string;
    statusId?: string;
    statusName?: string;
    statusColor?: string;
    availableStatuses?: import("../composables/useActivities").StatusOption[];
  } | null>;
}>();

const emit = defineEmits<{
  (
    e: "add",
    name: string,
    minutes: number,
    date: string,
    projectId?: string,
    ticket?: string,
    ticketTitle?: string,
    statusId?: string,
    statusName?: string,
    statusColor?: string,
    availableStatuses?: import("../composables/useActivities").StatusOption[],
  ): void;
  (e: "close"): void;
}>();

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const name = ref("");
const date = ref(todayISO());
const hours = ref<number | "">("");
const minutes = ref<number | "">("");
const projectId = ref<string>("");
const statusId = ref<string>("");
const statusName = ref<string>("");
const statusColor = ref<string>("");
const availableStatuses = ref<
  import("../composables/useActivities").StatusOption[]
>([]);
const ticket = ref("");

const isCreatingProject = ref(false);
const newProjectName = ref("");
const isLoadingTicket = ref(false);
const ticketTitle = ref("");

const { favoriteTickets, toggleFavorite, isFavorite } = useActivities();
const viewState = ref<"selection" | "form" | "favorites">("selection");
const searchFavoriteQuery = ref("");

const filteredFavorites = computed(() => {
  if (!searchFavoriteQuery.value) return favoriteTickets.value;
  const q = searchFavoriteQuery.value.toLowerCase();
  return favoriteTickets.value.filter(
    (f) =>
      f.ticket.toLowerCase().includes(q) ||
      (f.title && f.title.toLowerCase().includes(q)),
  );
});

function resetForm() {
  name.value = "";
  date.value = todayISO();
  hours.value = "";
  minutes.value = "";
  ticket.value = "";
  ticketTitle.value = "";
  projectId.value = "";
  statusId.value = "";
  statusName.value = "";
  statusColor.value = "";
  availableStatuses.value = [];
  isCreatingProject.value = false;
  newProjectName.value = "";
  searchFavoriteQuery.value = "";
  isLoadingTicket.value = false;
}

// Reset form when modal opens or closes
watch(
  () => props.show,
  (val) => {
    if (val) {
      viewState.value = props.initialView ?? "selection";
      resetForm();
    } else {
      setTimeout(() => {
        resetForm();
      }, 200); // Reset after close animation
    }
  },
);

function selectFavorite(fav: any) {
  ticket.value = fav.ticket;
  ticketTitle.value = fav.title;
  if (fav.projectId) projectId.value = fav.projectId;
  viewState.value = "form";
}

function getProjectName(id?: string) {
  if (!id) return "";
  const proj = props.projects.find((p) => p.id === id);
  return proj ? proj.name : "";
}

let currentSearchId = 0;

async function onTicketBlur() {
  const raw = ticket.value.trim().replace(/^#/, "");
  if (!raw || !props.fetchTicketSubject) return;

  const searchId = ++currentSearchId;
  isLoadingTicket.value = true;
  ticketTitle.value = "";
  try {
    const result = await props.fetchTicketSubject(raw);

    // Ignore stale responses or if modal is closed
    if (searchId !== currentSearchId || !props.show) return;

    if (result) {
      ticketTitle.value = result.subject;
      if (result.projectId) {
        projectId.value = result.projectId;
        // If this ticket was already saved as favorite, update its projectId
        const existing = favoriteTickets.value.find((f) => f.ticket === raw);
        if (existing) existing.projectId = result.projectId;
      }
      if (result.statusId) statusId.value = result.statusId;
      if (result.statusName) statusName.value = result.statusName;
      if (result.statusColor) statusColor.value = result.statusColor;
      if (result.availableStatuses?.length)
        availableStatuses.value = result.availableStatuses;
    }
  } finally {
    if (searchId === currentSearchId) {
      isLoadingTicket.value = false;
    }
  }
}

const isValid = computed(() => {
  if (!name.value.trim() || !date.value) return false;
  const h = typeof hours.value === "number" ? hours.value : 0;
  const m = typeof minutes.value === "number" ? minutes.value : 0;
  return h > 0 || m > 0;
});

function submitForm() {
  if (!isValid.value) return;
  const h = typeof hours.value === "number" ? hours.value : 0;
  const m = typeof minutes.value === "number" ? minutes.value : 0;
  const finalTicket = ticket.value.trim();

  // Actualizar metadatos en favoritos si existe,
  // para corregir si el usuario le dio a la estrella antes de que se cargara.
  if (finalTicket && isFavorite(finalTicket)) {
    const existing = favoriteTickets.value.find(
      (f) => f.ticket === finalTicket,
    );
    if (existing) {
      if (projectId.value) existing.projectId = projectId.value;
      if (ticketTitle.value) existing.title = ticketTitle.value;
    }
  }

  emit(
    "add",
    name.value.trim(),
    h * 60 + m,
    date.value,
    projectId.value || undefined,
    finalTicket || undefined,
    ticketTitle.value.trim() || undefined,
    statusId.value || undefined,
    statusName.value || undefined,
    statusColor.value || undefined,
    availableStatuses.value.length ? availableStatuses.value : undefined,
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

<style>
.dark input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(0.5) sepia(1) saturate(5) hue-rotate(200deg);
  cursor: pointer;
}

.dark input[type="number"]::-webkit-inner-spin-button,
.dark input[type="number"]::-webkit-outer-spin-button {
  filter: invert(1);
  margin-left: 5px;
}
</style>
