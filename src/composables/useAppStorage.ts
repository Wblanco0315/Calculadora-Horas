import { watch } from "vue";
import { useActivities } from "./useActivities";
import { useUserConfig } from "./useUserConfig";

const STORAGE_KEY = "calculadora_horas_data";

export function useAppStorage() {
  const { activities, projects, fetchOpenProjectProjects } = useActivities();
  const { userConfig, maxDailyMinutes } = useUserConfig();

  function initStorage() {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed.activities) activities.value = parsed.activities;
        if (parsed.projects) projects.value = parsed.projects;
        if (parsed.userConfig) userConfig.value = parsed.userConfig;
        if (parsed.maxDailyMinutes) maxDailyMinutes.value = parsed.maxDailyMinutes;
      } catch (e) {
        console.error("Failed to parse stored activities", e);
      }
    }

    // If there is a saved token, fetch fresh projects from OpenProject
    if (userConfig.value.openProjectToken) {
      fetchOpenProjectProjects();
    }

    // Set up global watcher to save anything that changes
    watch(
      [activities, projects, maxDailyMinutes, userConfig],
      () => {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            activities: activities.value,
            projects: projects.value,
            maxDailyMinutes: maxDailyMinutes.value,
            userConfig: userConfig.value,
          })
        );
      },
      { deep: true }
    );
  }

  return { initStorage };
}
