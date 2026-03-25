<template>
  <div class="relative w-full">
    <!-- Main Compact Form -->
    <form @submit.prevent="submitForm" class="flex flex-col gap-2 relative">
      <div class="flex items-center justify-between px-1">
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Añadir Actividad</label>
        <!-- Settings Toggle Component -->
        <button 
          type="button"
          @click="showSettings = !showSettings"
          class="text-xs text-blue-500 hover:text-blue-600 hover:underline dark:hover:text-blue-400 focus:outline-none"
        >
          Meta: {{ Math.floor(props.currentGoalMinutes / 60) }}h
        </button>
      </div>

      <!-- Settings Dropdown -->
      <transition 
        enter-active-class="transition duration-200 ease-out absolute z-50 top-6 right-0 w-48 shadow-lg" 
        enter-from-class="transform scale-95 opacity-0 -translate-y-2" 
        enter-to-class="transform scale-100 opacity-100 translate-y-0" 
        leave-active-class="transition duration-150 ease-in absolute z-50 top-6 right-0 w-48 shadow-lg" 
        leave-from-class="transform scale-100 opacity-100 translate-y-0" 
        leave-to-class="transform scale-95 opacity-0 -translate-y-2"
      >
        <div v-if="showSettings" class="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-3">
          <label class="block text-xs text-slate-500 dark:text-slate-300 mb-1">Max horas diarias</label>
          <div class="flex gap-2">
            <input 
              type="number" 
              v-model="goalHours"
              min="1"
              max="24"
              class="flex-1 w-full px-2 py-1 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-slate-100"
            />
            <button 
              type="button"
              @click="saveGoal"
              class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
            >
              Ok
            </button>
          </div>
        </div>
      </transition>

      <div class="flex items-center gap-2">
        <input 
          type="text" 
          v-model="name"
          placeholder="Tarea..."
          required
          class="flex-1 min-w-0 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-slate-100 placeholder-slate-400 transition-colors"
        />
        
        <div class="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-colors">
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
          class="p-2 aspect-square bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-all active:scale-95 flex items-center justify-center shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  currentGoalMinutes: number;
}>();

const emit = defineEmits<{
  (e: 'add', name: string, minutes: number): void;
  (e: 'update-goal', minutes: number): void;
}>();

const name = ref('');
const hours = ref<number | ''>('');
const minutes = ref<number | ''>('');

const showSettings = ref(false);
const goalHours = ref(Math.floor(props.currentGoalMinutes / 60));

const isValid = computed(() => {
  if (!name.value.trim()) return false;
  const h = typeof hours.value === 'number' ? hours.value : 0;
  const m = typeof minutes.value === 'number' ? minutes.value : 0;
  return h > 0 || m > 0;
});

function submitForm() {
  if (!isValid.value) return;
  
  const h = typeof hours.value === 'number' ? hours.value : 0;
  const m = typeof minutes.value === 'number' ? minutes.value : 0;
  const totalMins = (h * 60) + m;
  
  emit('add', name.value.trim(), totalMins);
  
  // reset
  name.value = '';
  hours.value = '';
  minutes.value = '';
}

function saveGoal() {
  if (goalHours.value > 0) {
    emit('update-goal', goalHours.value * 60);
    showSettings.value = false;
  }
}
</script>