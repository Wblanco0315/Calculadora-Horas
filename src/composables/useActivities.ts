import { ref, computed } from "vue";
import { useUserConfig } from "./useUserConfig";

export interface Project {
  id: string;
  name: string;
}

export interface Activity {
  id: string;
  name: string;
  minutes: number;
  projectId?: string;
  ticket?: string;
}

// Global state outside the composable to act as a singleton
const activities = ref<Activity[]>([]);
const projects = ref<Project[]>([]);

export function useActivities() {
  const { maxDailyMinutes } = useUserConfig();

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

  function addActivity(
    name: string,
    minutes: number,
    projectId?: string,
    ticket?: string,
  ) {
    activities.value.push({
      id: crypto.randomUUID(),
      name,
      minutes,
      projectId,
      ticket,
    });
  }

  function addProject(name: string) {
    const id = crypto.randomUUID();
    projects.value.push({ id, name });
    return id;
  }

  function removeActivity(id: string) {
    const index = activities.value.findIndex((a) => a.id === id);
    if (index !== -1) {
      activities.value.splice(index, 1);
    }
  }

  function editActivity(id: string, updates: Partial<Activity>) {
    const act = activities.value.find((a) => a.id === id);
    if (act) {
      Object.assign(act, updates);
    }
  }

  return {
    activities,
    projects,
    totalMinutes,
    remainingMinutes,
    progressPercentage,
    addActivity,
    editActivity,
    removeActivity,
    addProject,
  };
}
