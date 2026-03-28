import { ref, computed, watch, onMounted } from "vue";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { fetch } from "@tauri-apps/plugin-http";

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
  ticketTitle?: string;
}

export interface UserConfig {
  isConfigured: boolean;
  entryTime: string;
  exitTime: string;
  lunchMinutes: number;
  lastNotifiedDate?: string;
  openProjectToken?: string;
}

const STORAGE_KEY = "calculadora_horas_data";
const THEME_KEY = "calculadora_horas_theme";

const defaultUserConfig: UserConfig = {
  isConfigured: false,
  entryTime: "08:00",
  exitTime: "17:00",
  lunchMinutes: 60,
  openProjectToken: "",
};

export function useActivities() {
  const activities = ref<Activity[]>([]);
  const projects = ref<Project[]>([]);
  const userConfig = ref<UserConfig>({ ...defaultUserConfig });
  const maxDailyMinutes = ref<number>(480); // Default to 8 hours
  const isDark = ref<boolean>(false);

  // Load from local storage
  onMounted(() => {
    // Load Activities & Projects
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        activities.value = parsed.activities || [];
        projects.value = parsed.projects || [];
        if (parsed.userConfig) {
          userConfig.value = parsed.userConfig;
        }
        maxDailyMinutes.value = parsed.maxDailyMinutes || 480;
      } catch (e) {
        console.error("Failed to parse stored activities", e);
      }
    }

    // Load Theme
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (
      storedTheme === "dark" ||
      (!storedTheme &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      isDark.value = true;
      document.documentElement.classList.add("dark");
    } else {
      isDark.value = false;
      document.documentElement.classList.remove("dark");
    }

    // Set up continuous notification check
    setInterval(() => {
      checkWorkdayEnd();
    }, 60000); // every minute

    // Optional: run once immediately on load
    checkWorkdayEnd();
    fetchOpenProjectProjects();
  });

  // Watch for changes and save to local storage
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
        }),
      );
    },
    { deep: true },
  );

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
    ticketTitle?: string,
  ) {
    activities.value.push({
      id: crypto.randomUUID(),
      name,
      minutes,
      projectId,
      ticket,
      ticketTitle,
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

  function toggleDarkMode() {
    isDark.value = !isDark.value;
    if (isDark.value) {
      document.documentElement.classList.add("dark");
      localStorage.setItem(THEME_KEY, "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem(THEME_KEY, "light");
    }
  }

  function setMaxDailyMinutes(minutes: number) {
    maxDailyMinutes.value = minutes;
  }

  function updateUserConfig(config: Partial<UserConfig>) {
    userConfig.value = { ...userConfig.value, ...config };

    // Auto calculate daily minutes based on entry/exit and lunch
    if (userConfig.value.entryTime && userConfig.value.exitTime) {
      const [entryH, entryM] = userConfig.value.entryTime
        .split(":")
        .map(Number);
      const [exitH, exitM] = userConfig.value.exitTime.split(":").map(Number);

      let entryTotal = entryH * 60 + entryM;
      let exitTotal = exitH * 60 + exitM;

      let diffMins = exitTotal - entryTotal;
      if (diffMins < 0) {
        diffMins += 24 * 60; // Handle overnight shifts
      }

      diffMins -= userConfig.value.lunchMinutes || 0;
      maxDailyMinutes.value = Math.max(0, diffMins);
    }

    if (config.openProjectToken !== undefined) {
      fetchOpenProjectProjects();
    }
  }

  async function fetchOpenProjectProjects() {
    if (!userConfig.value.openProjectToken) return;
    try {
      const response = await fetch(
        "https://openproject.wposs.com/openproject/api/v3/projects",
        {
          headers: {
            Authorization: `Bearer ${userConfig.value.openProjectToken}`,
          },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch projects");
      const data = await response.json();
      if (data && data._embedded && data._embedded.elements) {
        projects.value = data._embedded.elements.map((p: any) => ({
          id: String(p.id),
          name: p.name,
        }));
      }
    } catch (error) {
      console.error("OpenProject error:", error);
    }
  }

  async function fetchTicketSubject(
    ticketId: string,
  ): Promise<{ subject: string; projectId: string } | null> {
    if (!userConfig.value.openProjectToken || !ticketId) return null;
    try {
      const response = await fetch(
        `https://openproject.wposs.com/openproject/api/v3/work_packages/${ticketId}`,
        {
          headers: {
            Authorization: `Bearer ${userConfig.value.openProjectToken}`,
          },
        },
      );
      if (!response.ok) return null;
      const data = await response.json();
      const subject = data.subject || null;
      const projectId = data._embedded?.project?.id
        ? String(data._embedded.project.id)
        : null;
      if (!subject) return null;
      return { subject, projectId: projectId ?? "" };
    } catch (error) {
      console.error("OpenProject ticket error:", error);
      return null;
    }
  }

  async function checkWorkdayEnd() {
    if (!userConfig.value.isConfigured || !userConfig.value.exitTime) return;

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // "YYYY-MM-DD"

    if (userConfig.value.lastNotifiedDate === todayStr) {
      return; // Already notified today
    }

    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTotalMins = currentH * 60 + currentM;

    const [exitH, exitM] = userConfig.value.exitTime.split(":").map(Number);
    let exitTotalMins = exitH * 60 + exitM;

    // Handle overnight shifts logic for notification checking
    if (exitTotalMins < currentTotalMins && exitTotalMins < 12 * 60) {
      exitTotalMins += 24 * 60;
    }

    const diffMins = exitTotalMins - currentTotalMins;

    // If within the last 15 minutes of the shift
    if (diffMins <= 15 && diffMins >= 0) {
      try {
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === "granted";
        }

        if (permissionGranted) {
          sendNotification({
            title: "Calculadora de Horas",
            body: "¡Atención! Faltan 15 minutos o menos para finalizar tu jornada laboral.",
          });

          userConfig.value.lastNotifiedDate = todayStr;
        }
      } catch (err) {
        console.error("Error sending notification", err);
      }
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
    maxDailyMinutes,
    userConfig,
    isDark,
    totalMinutes,
    remainingMinutes,
    progressPercentage,
    addActivity,
    editActivity,
    addProject,
    removeActivity,
    toggleDarkMode,
    setMaxDailyMinutes,
    updateUserConfig,
    fetchOpenProjectProjects,
    fetchTicketSubject,
  };
}
