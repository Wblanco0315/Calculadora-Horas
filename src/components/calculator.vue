<template>
  <!-- Full Screen Transparent Wrapper -->
  <div
    class="h-screen w-screen bg-transparent p-0 overflow-hidden flex flex-col"
  >
    <!-- Main Compact Container -->
    <div
      class="w-full h-full bg-slate-50 dark:bg-slate-900 rounded-[12px] md:rounded-[18px] border border-slate-300 dark:border-slate-700/60 overflow-hidden flex flex-col shadow-2xl relative transition-colors duration-300"
    >
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
          class="p-4 bg-linear-to-b from-blue-500 to-blue-600 dark:from-blue-800 dark:to-blue-900 text-white shadow-inner shrink-0"
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
            <button
              @click="resetActivities"
              class="cursor-pointer px-2 py-1 mb-1 text-xs font-medium text-blue-100 bg-blue-900/30 hover:bg-red-500 hover:text-white rounded flex items-center gap-1 transition-all"
              title="Borrar todas las actividades"
            >
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
              Reiniciar
            </button>
          </div>

          <!-- Progress Mini Bar -->
          <div class="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
            <div
              class="bg-white rounded-full h-1.5 transition-all duration-500"
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>
        </div>

        <div
          class="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] z-10 shrink-0"
        >
          <HoursForm
            :projects="projects"
            :addProject="addProject"
            @add="addActivity"
            @open-settings="showSetupModal = true"
          />
        </div>

        <!-- Scrollable Activity List -->
        <div
          class="flex-1 overflow-y-auto w-full p-4 bg-slate-50 dark:bg-slate-900/50"
        >
          <div
            v-if="activities.length === 0"
            class="text-center py-8 opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-8 w-8 mx-auto mb-2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p class="text-sm">Sin actividades hoy</p>
          </div>

          <TransitionGroup name="list" tag="div" class="space-y-2 relative">
            <Row
              v-for="activity in activities"
              :key="activity.id"
              :activity="activity"
              :projects="projects"
              @delete="removeActivity"
              @update="editActivity"
            />
          </TransitionGroup>
        </div>
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
import { ref } from "vue";
import { useActivities } from "../composables/useActivities";
import HoursForm from "./hoursForm.vue";
import Row from "./row.vue";
import Titlebar from "./Titlebar.vue";
import ConfirmModal from "./confirmModal.vue";
import InitialSetup from "./InitialSetup.vue";

const showConfirmReset = ref(false);
const showSetupModal = ref(false);

const {
  activities,
  projects,
  maxDailyMinutes,
  userConfig,
  totalMinutes,
  progressPercentage,
  addActivity,
  editActivity,
  addProject,
  removeActivity,
  updateUserConfig,
} = useActivities();

function formatTime(totalMins: number) {
  if (totalMins <= 0) return "00h 00m";
  const hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;

  const h = hours.toString().padStart(2, "0");
  const m = minutes.toString().padStart(2, "0");

  return `${h}h ${m}m`;
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
