<template>
  <div
    class="group relative flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-200"
  >
    <!-- View Mode -->
    <template v-if="!isEditing">
      <div class="flex items-center gap-3 overflow-hidden flex-1">
        <div class="flex flex-col min-w-0 pr-2">
          <h3
            class="font-medium text-sm text-slate-800 dark:text-slate-200 truncate"
            :title="activity.name"
          >
            {{ activity.name }}
          </h3>
          <!-- Tags -->
          <div
            v-if="projectName || activity.ticket"
            class="flex items-center gap-1.5 mt-0.5"
          >
            <span
              v-if="projectName"
              class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 truncate max-w-[120px]"
              :title="projectName"
            >
              {{ projectName }}
            </span>
            <span
              v-if="activity.ticket"
              class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 font-mono"
              :title="activity.ticket"
            >
              {{ activity.ticket }}
            </span>
            <span
              v-if="activity.ticketTitle"
              class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 truncate max-w-[150px]"
              :title="activity.ticketTitle"
            >
              {{ activity.ticketTitle }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3 shrink-0">
        <div class="flex items-center gap-1.5">
          <div
            class="text-sm font-semibold font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded"
          >
            {{ formatDecimal(activity.minutes) }}h
          </div>
        </div>

        <!-- Actions -->
        <div
          class="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 -ml-1"
        >
          <button
            @click="copyTaskName"
            class="cursor-pointer p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors"
            aria-label="Copiar nombre de la tarea"
            :title="isCopied ? '¡Copiado!' : 'Copiar nombre'"
          >
            <svg
              v-if="isCopied"
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 text-green-500 dark:text-green-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path
                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
              ></path>
            </svg>
          </button>

          <button
            @click="startEdit"
            class="cursor-pointer p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Edit activity"
            title="Editar"
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
              <path
                d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
              />
            </svg>
          </button>

          <button
            @click="$emit('delete', activity.id)"
            class="cursor-pointer p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label="Remove activity"
            title="Eliminar"
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

    <!-- Edit Mode -->
    <template v-else>
      <div class="flex flex-col gap-2 w-full">
        <!-- Top Row: Name and Time -->
        <div class="flex items-center gap-2">
          <input
            type="text"
            v-model="editName"
            placeholder="Tarea..."
            class="flex-1 min-w-0 px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-slate-100"
          />
          <div
            class="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shrink-0 focus-within:ring-2 focus-within:ring-blue-500"
          >
            <input
              type="number"
              v-model="editHours"
              min="0"
              class="w-10 px-1 py-1.5 text-sm text-center bg-transparent outline-none dark:text-slate-100 placeholder-slate-400"
            />
            <span class="text-slate-300 dark:text-slate-600">:</span>
            <input
              type="number"
              v-model="editMinutes"
              min="0"
              max="59"
              class="w-10 px-1 py-1.5 text-sm text-center bg-transparent outline-none dark:text-slate-100 placeholder-slate-400"
            />
          </div>
        </div>

        <!-- Bottom Row: Project and Ticket + Actions -->
        <div class="flex items-center gap-2">
          <select
            v-model="editProjectId"
            class="flex-1 min-w-0 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none dark:text-slate-100"
          >
            <option value="">Sin proyecto</option>
            <option v-for="p in projects" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
          <input
            type="text"
            v-model="editTicket"
            placeholder="Ticket (opc)"
            class="w-24 px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none dark:text-slate-100"
          />

          <div class="flex gap-1 shrink-0 ml-1">
            <button
              @click="saveEdit"
              :disabled="!isValid"
              class="cursor-pointer p-1.5 text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
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
              @click="cancelEdit"
              class="cursor-pointer p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
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
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { Activity, Project } from "../composables/useActivities";

const props = defineProps<{
  activity: Activity;
  projects?: Project[];
}>();

const emit = defineEmits<{
  (e: "delete", id: string): void;
  (e: "update", id: string, updates: Partial<Activity>): void;
}>();

const isEditing = ref(false);
const isCopied = ref(false);
const editName = ref("");
const editHours = ref<number | "">("");
const editMinutes = ref<number | "">("");
const editProjectId = ref("");
const editTicket = ref("");

async function copyTaskName() {
  try {
    await navigator.clipboard.writeText(props.activity.name);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error("Error al copiar el nombre de la tarea: ", err);
  }
}

function startEdit() {
  editName.value = props.activity.name;
  editHours.value = Math.floor(props.activity.minutes / 60);
  editMinutes.value = props.activity.minutes % 60;
  editProjectId.value = props.activity.projectId || "";
  editTicket.value = props.activity.ticket || "";
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
}

const isValid = computed(() => {
  if (!editName.value.trim()) return false;
  const h = typeof editHours.value === "number" ? editHours.value : 0;
  const m = typeof editMinutes.value === "number" ? editMinutes.value : 0;
  return h > 0 || m > 0;
});

function saveEdit() {
  if (!isValid.value) return;
  const h = typeof editHours.value === "number" ? editHours.value : 0;
  const m = typeof editMinutes.value === "number" ? editMinutes.value : 0;

  emit("update", props.activity.id, {
    name: editName.value.trim(),
    minutes: h * 60 + m,
    projectId: editProjectId.value || undefined,
    ticket: editTicket.value.trim() || undefined,
  });

  isEditing.value = false;
}

const projectName = computed(() => {
  if (!props.activity.projectId || !props.projects) return "";
  const p = props.projects.find((pr) => pr.id === props.activity.projectId);
  return p ? p.name : "";
});

function formatDecimal(totalMinutes: number) {
  // Convertimos a base 10 y limpiamos ceros arrastrados (e.g. 1.50 -> 1.5)
  return parseFloat((totalMinutes / 60).toFixed(2));
}
</script>
