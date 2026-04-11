<template>
  <div
    class="group relative transition-all duration-300 border"
    :class="[
      !isEditing && isOpen
        ? 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/5 rounded-2xl'
        : 'border-transparent hover:bg-slate-50/60 dark:hover:bg-white/[0.02] rounded-xl',
    ]"
  >
    <!-- ── View Mode ─────────────────────────────────────────── -->
    <template v-if="!isEditing">
      <div class="flex items-center gap-3 px-3 py-3">
        <!-- Accent bar -->
        <div
          class="flex-shrink-0 w-1 h-9 rounded-full transition-colors duration-300"
          :class="
            isOpen
              ? 'bg-purple-500'
              : 'bg-slate-200 dark:bg-slate-700 group-hover:bg-purple-400/50'
          "
        />

        <!-- Body -->
        <div class="flex-grow min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <h3
              class="text-[11px] font-bold uppercase tracking-wider truncate transition-colors duration-200"
              :class="
                isOpen
                  ? 'text-purple-500 dark:text-purple-400'
                  : 'text-slate-500 dark:text-slate-400 group-hover:text-purple-500 dark:group-hover:text-purple-400'
              "
              :title="displayTitle"
            >
              {{ displayTitle }}
            </h3>
            <span
              v-if="activity.ticket"
              class="shrink-0 text-[10px] font-mono text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800"
            >
              #{{ activity.ticket }}
            </span>
          </div>
          <div v-if="projectName" class="flex items-center gap-1.5">
            <!-- Briefcase icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-3 h-3 text-blue-400 dark:text-blue-500/70 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <span
              class="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate"
              >{{ projectName }}</span
            >
          </div>
        </div>

        <!-- Time -->
        <div
          class="flex-shrink-0 flex items-center gap-1.5 font-mono font-bold text-sm transition-colors duration-200"
          :class="
            isOpen
              ? 'text-purple-500 dark:text-purple-400'
              : 'text-slate-500 dark:text-slate-400 group-hover:text-purple-500 dark:group-hover:text-purple-400'
          "
        >
          <!-- Clock icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-3.5 h-3.5 opacity-60"
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
          {{ formatDecimal(activity.minutes) }}h
        </div>

        <!-- Actions + chevron -->
        <div class="flex items-center gap-0.5 shrink-0">
          <!-- Hidden actions -->
          <div
            class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-200 mr-1"
          >
            <!-- Copy -->
            <button
              @click="copyTaskName"
              class="cursor-pointer p-1.5 rounded-lg transition-all text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
              :title="isCopied ? '¡Copiado!' : 'Copiar nombre'"
            >
              <svg
                v-if="isCopied"
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4 text-green-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
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
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                />
              </svg>
            </button>

            <!-- Sync -->
            <button
              v-if="activity.ticket && hasToken && logTimeEntry"
              @click="syncTimeEntry"
              :disabled="isSyncing"
              class="cursor-pointer p-1.5 rounded-lg transition-all"
              :class="[
                syncSuccess
                  ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10'
                  : syncError
                    ? 'text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5',
                isSyncing ? 'opacity-50 cursor-not-allowed' : '',
              ]"
              :title="
                syncSuccess
                  ? '¡Enviado!'
                  : syncError
                    ? 'Error al enviar'
                    : 'Enviar a OpenProject'
              "
            >
              <span
                v-if="isSyncing"
                class="block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
              />
              <svg
                v-else-if="syncSuccess"
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <svg
                v-else-if="syncError"
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
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
            </button>

            <!-- Edit -->
            <button
              @click="startEdit"
              class="cursor-pointer p-1.5 rounded-lg transition-all text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10"
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

            <!-- Delete -->
            <button
              @click="$emit('delete', activity.id)"
              class="cursor-pointer p-1.5 rounded-lg transition-all text-slate-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
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

          <!-- Chevron toggle -->
          <button
            @click="isOpen = !isOpen"
            class="cursor-pointer p-1.5 rounded-full transition-all"
            :class="
              isOpen
                ? 'bg-purple-500 text-white'
                : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
            "
          >
            <svg
              v-if="isOpen"
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Expanded panel -->
      <div
        class="overflow-hidden transition-all duration-300 ease-in-out"
        :class="isOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'"
      >
        <div class="px-7 pb-4">
          <div
            class="p-3 bg-slate-100 dark:bg-black/20 rounded-xl border border-slate-200/60 dark:border-white/[0.03]"
          >
            <p
              class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed italic"
            >
              {{ activity.name }}
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Edit Mode ──────────────────────────────────────────── -->
    <template v-else>
      <div class="flex flex-col gap-2 w-full p-3">
        <div class="flex items-center gap-2">
          <input
            type="text"
            v-model="editName"
            placeholder="Tarea..."
            class="flex-1 min-w-0 px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none dark:text-slate-100"
          />
          <div
            class="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shrink-0 focus-within:ring-2 focus-within:ring-purple-500"
          >
            <input
              type="number"
              v-model="editHours"
              min="0"
              class="w-10 px-1 py-1.5 text-sm text-center bg-transparent outline-none dark:text-slate-100"
            />
            <span class="text-slate-300 dark:text-slate-600">:</span>
            <input
              type="number"
              v-model="editMinutes"
              min="0"
              max="59"
              class="w-10 px-1 py-1.5 text-sm text-center bg-transparent outline-none dark:text-slate-100"
            />
          </div>
        </div>
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
          <div class="flex gap-1 shrink-0">
            <button
              @click="saveEdit"
              :disabled="!isValid"
              class="cursor-pointer p-1.5 text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
              class="cursor-pointer p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
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

    <!-- Time Entry Modal -->
    <TimeEntryModal
      :show="showTimeEntryModal"
      :initialComment="activity.name"
      :timeEntryActivities="timeEntryActivities ?? []"
      @confirm="onTimeEntryConfirm"
      @cancel="showTimeEntryModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type {
  Activity,
  Project,
  TimeEntryActivity,
} from "../composables/useActivities";
import TimeEntryModal from "./TimeEntryModal.vue";

const props = defineProps<{
  activity: Activity;
  projects?: Project[];
  hasToken?: boolean;
  timeEntryActivities?: TimeEntryActivity[];
  logTimeEntry?: (
    activityId: string,
    comment: string,
    spentOn: string,
    activityTypeId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}>();

const emit = defineEmits<{
  (e: "delete", id: string): void;
  (e: "update", id: string, updates: Partial<Activity>): void;
}>();

// ── State ──────────────────────────────────────────────────────
const isOpen = ref(false);
const isEditing = ref(false);
const isCopied = ref(false);
const isSyncing = ref(false);
const syncSuccess = ref(false);
const syncError = ref(false);
const showTimeEntryModal = ref(false);

const editName = ref("");
const editHours = ref<number | "">("");
const editMinutes = ref<number | "">("");
const editProjectId = ref("");
const editTicket = ref("");

// ── Computed ───────────────────────────────────────────────────
const displayTitle = computed(
  () => props.activity.ticketTitle || props.activity.name,
);

const projectName = computed(() => {
  if (!props.activity.projectId || !props.projects) return "";
  return (
    props.projects.find((p) => p.id === props.activity.projectId)?.name ?? ""
  );
});

const isValid = computed(() => {
  if (!editName.value.trim()) return false;
  const h = typeof editHours.value === "number" ? editHours.value : 0;
  const m = typeof editMinutes.value === "number" ? editMinutes.value : 0;
  return h > 0 || m > 0;
});

// ── Actions ────────────────────────────────────────────────────
async function copyTaskName() {
  try {
    await navigator.clipboard.writeText(props.activity.name);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error("Error al copiar:", err);
  }
}

function syncTimeEntry() {
  if (!props.logTimeEntry || isSyncing.value) return;
  showTimeEntryModal.value = true;
}

async function onTimeEntryConfirm(
  comment: string,
  spentOn: string,
  activityTypeId: string,
) {
  showTimeEntryModal.value = false;
  if (!props.logTimeEntry) return;
  isSyncing.value = true;
  syncSuccess.value = false;
  syncError.value = false;
  const result = await props.logTimeEntry(
    props.activity.id,
    comment,
    spentOn,
    activityTypeId,
  );
  isSyncing.value = false;
  if (result.ok) {
    syncSuccess.value = true;
    setTimeout(() => {
      syncSuccess.value = false;
    }, 2000);
  } else {
    syncError.value = true;
    setTimeout(() => {
      syncError.value = false;
    }, 2000);
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

function formatDecimal(totalMinutes: number) {
  return parseFloat((totalMinutes / 60).toFixed(2));
}
</script>
