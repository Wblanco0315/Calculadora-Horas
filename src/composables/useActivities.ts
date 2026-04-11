import { ref, computed } from "vue";
import { fetch } from "@tauri-apps/plugin-http";
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
  ticketTitle?: string;
}

// Singletons shared across all calls to useActivities()
const activities = ref<Activity[]>([]);
const projects = ref<Project[]>([]);

export function useActivities() {
  const { userConfig, maxDailyMinutes } = useUserConfig();

  const totalMinutes = computed(() => {
    return activities.value.reduce((total, act) => total + act.minutes, 0);
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

  function editActivity(id: string, updates: Partial<Activity>) {
    const act = activities.value.find((a) => a.id === id);
    if (act) {
      Object.assign(act, updates);
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

  return {
    activities,
    projects,
    totalMinutes,
    progressPercentage,
    addActivity,
    editActivity,
    addProject,
    removeActivity,
    fetchOpenProjectProjects,
    fetchTicketSubject,
  };
}
