<template>
  <!-- Full Screen Transparent Wrapper -->
  <div
    class="h-screen w-screen bg-transparent p-0 overflow-hidden flex flex-col"
  >
    <!-- Main Compact Container -->
    <div
      class="w-full h-full bg-slate-50 dark:bg-slate-900 rounded-[12px] md:rounded-[18px] border border-slate-300 dark:border-slate-700/60 overflow-hidden flex flex-col shadow-2xl relative transition-colors duration-300"
    >
      <!-- Loading screen -->
      <transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-300"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isLoading"
          class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-[12px] md:rounded-[18px]"
        >
          <div
            class="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"
          />
          <span class="text-xs text-slate-400 dark:text-slate-500 font-medium"
            >Cargando...</span
          >
        </div>
      </transition>

      <Titlebar @open-settings="showSetupModal = true" />

      <InitialSetup
        v-if="!userConfig.isConfigured || showSetupModal"
        :user-config="userConfig"
        :is-modal="userConfig.isConfigured"
        @save="
          (config) => {
            updateUserConfig(config);
            showSetupModal = false;
          }
        "
        @close="showSetupModal = false"
      />

      <template v-else>
        <!-- Stats Area -->
        <div
          class="p-4 bg-linear-to-b from-indigo-500 to-indigo-600 dark:from-indigo-900 dark:to-slate-900 text-white shadow-inner shrink-0"
        >
          <div class="flex justify-between items-baseline mb-1">
            <span
              class="text-blue-100 text-xs font-medium uppercase tracking-wider"
              >Total Registrado</span
            >
            <span class="text-blue-100/80 text-xs"
              >Meta: {{ formatTime(maxDailyMinutes) }}</span
            >
          </div>
          <div class="flex justify-between items-end gap-2 mb-3">
            <span class="text-4xl font-bold font-mono tracking-tight">{{
              formatTime(totalMinutes)
            }}</span>
            <BaseButton
              @click="resetActivities"
              variant="danger-ghost"
              size="sm"
              class="mb-1 !px-2 !py-1"
              title="Borrar todas las actividades"
              label="Reiniciar"
            >
              <template #left-icon>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-3.5 h-3.5"
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
              </template>
            </BaseButton>
          </div>

          <!-- Progress Mini Bar -->
          <div class="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
            <div
              class="bg-white rounded-full h-1.5 transition-all duration-500"
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>
        </div>

        <!-- Greeting bar -->
        <div
          class="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 shrink-0"
        >
          <div>
            <p
              class="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold"
            >
              Registro del día
            </p>
            <h2
              class="text-sm font-display font-semibold text-slate-700 dark:text-slate-200 leading-tight"
            >
              Hola, {{ currentUserName || "Usuario" }} 👋
            </h2>
          </div>
          <div class="flex gap-2 items-center">
            <div class="relative flex items-center">
              <BaseButton
                @click="showAddModal = true"
                variant="primary"
                size="sm"
                class="scale-105 mr-1"
                label="Añadir"
              >
                <template #left-icon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </template>
              </BaseButton>
            </div>
          </div>
        </div>

        <!-- Add activity modal -->
        <HoursForm
          :show="showAddModal"
          :projects="projects"
          :addProject="addProject"
          :hasProjectToken="!!userConfig.openProjectToken"
          :fetchTicketSubject="fetchTicketSubject"
          @add="addActivity"
          @close="showAddModal = false"
        />

        <!-- Scrollable Activity List -->
        <div
          class="flex-1 overflow-y-auto w-full bg-slate-50 dark:bg-slate-900/50"
        >
          <div
            v-if="activities.length === 0"
            class="flex flex-col items-center justify-center h-full gap-3 select-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-10 w-10 text-slate-700 dark:text-slate-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="10" stroke-width="1.5" />
              <polyline
                points="12 6 12 12 16 14"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-600 text-center"
            >
              No hay más registros<br />por hoy
            </p>
          </div>

          <TransitionGroup
            name="list"
            tag="div"
            class="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 divide-y divide-slate-100 dark:divide-slate-700/60 shadow-sm relative overflow-hidden"
          >
            <Row
              v-for="activity in activities"
              :key="activity.id"
              :activity="activity"
              :projects="projects"
              :hasToken="!!userConfig.openProjectToken"
              :logTimeEntry="logTimeEntry"
              :timeEntryActivities="timeEntryActivities"
              @delete="removeActivity"
              @update="editActivity"
            />
          </TransitionGroup>
        </div>

        <!-- Bottom navigation -->
        <nav
          class="shrink-0 flex items-center justify-around px-4 py-2 border-t border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900"
        >
          <!-- Calculator (active) -->
          <button
            class="cursor-pointer flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-slate-900 dark:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>

          <!-- History (inactive) -->
          <button
            class="cursor-not-allowed flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-slate-400 dark:text-slate-600 opacity-40"
            disabled
            title="Próximamente"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
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
          </button>

          <!-- Settings -->
          <button
            @click="showSetupModal = true"
            class="cursor-pointer flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-slate-400 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
              />
            </svg>
          </button>
        </nav>
      </template>

      <!-- Custom Confirm Modal -->
      <ConfirmModal
        :show="showConfirmReset"
        title="Reiniciar Actividades"
        message="¿Seguro que deseas reiniciar el registro? Esta acción no se puede deshacer."
        confirmText="Sí, borrar"
        cancelText="Cancelar"
        @confirm="confirmReset"
        @cancel="showConfirmReset = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useActivities } from "../composables/useActivities";
import { useUserConfig } from "../composables/useUserConfig";
import { useAppStorage } from "../composables/useAppStorage";
import { useTheme } from "../composables/useTheme";
import { useSystemNotifications } from "../composables/useSystemNotifications";
import HoursForm from "./hoursForm.vue";
import Row from "./row.vue";
import Titlebar from "./Titlebar.vue";
import ConfirmModal from "./confirmModal.vue";
import InitialSetup from "./InitialSetup.vue";
import BaseButton from "./shared/baseButton.vue";

const showConfirmReset = ref(false);
const showSetupModal = ref(false);
const showAddModal = ref(false);
const isLoading = ref(true);

const {
  activities,
  projects,
  totalMinutes,
  progressPercentage,
  addActivity,
  editActivity,
  addProject,
  removeActivity,
  fetchTicketSubject,
  logTimeEntry,
  currentUserName,
  timeEntryActivities,
  fetchTimeEntryActivities,
  fetchCurrentUser,
} = useActivities();

const { maxDailyMinutes, userConfig, updateUserConfig } = useUserConfig();

const { initStorage } = useAppStorage();
const { initTheme } = useTheme();
const { startNotificationWatcher } = useSystemNotifications();

initStorage();
initTheme();
startNotificationWatcher();

onMounted(async () => {
  await Promise.all([fetchTimeEntryActivities(), fetchCurrentUser()]);
  isLoading.value = false;
});

function formatTime(totalMins: number) {
  if (totalMins <= 0) return "00:00";
  const hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;

  const h = hours.toString().padStart(2, "0");
  const m = minutes.toString().padStart(2, "0");

  return `${h}:${m}`;
}

function resetActivities() {
  showConfirmReset.value = true;
}

function confirmReset() {
  activities.value = [];
  showConfirmReset.value = false;
}
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(10px);
}
.list-leave-to {
  opacity: 0;
  transform: scale(0.9) translateX(20px);
}
.list-leave-active {
  position: absolute;
  width: 100%;
}
</style>
