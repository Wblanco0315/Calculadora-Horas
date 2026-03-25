import { ref, computed, watch, onMounted } from 'vue';

export interface Activity {
  id: string;
  name: string;
  minutes: number;
}

const STORAGE_KEY = 'calculadora_horas_data';
const THEME_KEY = 'calculadora_horas_theme';

export function useActivities() {
  const activities = ref<Activity[]>([]);
  const maxDailyMinutes = ref<number>(480); // Default to 8 hours
  const isDark = ref<boolean>(false);

  // Load from local storage
  onMounted(() => {
    // Load Activities
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        activities.value = parsed.activities || [];
        maxDailyMinutes.value = parsed.maxDailyMinutes || 480;
      } catch (e) {
        console.error("Failed to parse stored activities", e);
      }
    }

    // Load Theme
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      isDark.value = true;
      document.documentElement.classList.add('dark');
    } else {
      isDark.value = false;
      document.documentElement.classList.remove('dark');
    }
  });

  // Watch for changes and save to local storage
  watch([activities, maxDailyMinutes], () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      activities: activities.value,
      maxDailyMinutes: maxDailyMinutes.value
    }));
  }, { deep: true });

  const totalMinutes = computed(() => {
    return activities.value.reduce((total, act) => total + act.minutes, 0);
  });

  const remainingMinutes = computed(() => {
    return Math.max(0, maxDailyMinutes.value - totalMinutes.value);
  });

  const progressPercentage = computed(() => {
    if (maxDailyMinutes.value === 0) return 0;
    const p = (totalMinutes.value / maxDailyMinutes.value) * 100;
    return Math.min(100, p);
  });

  function addActivity(name: string, minutes: number) {
    activities.value.push({
      id: crypto.randomUUID(),
      name,
      minutes
    });
  }

  function removeActivity(id: string) {
    const index = activities.value.findIndex(a => a.id === id);
    if (index !== -1) {
      activities.value.splice(index, 1);
    }
  }

  function toggleDarkMode() {
    isDark.value = !isDark.value;
    if (isDark.value) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }

  function setMaxDailyMinutes(minutes: number) {
    maxDailyMinutes.value = minutes;
  }

  return {
    activities,
    maxDailyMinutes,
    isDark,
    totalMinutes,
    remainingMinutes,
    progressPercentage,
    addActivity,
    removeActivity,
    toggleDarkMode,
    setMaxDailyMinutes
  };
}
