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
  date: string;
  projectId?: string;
  ticket?: string;
  ticketTitle?: string;
  synced?: boolean;
  selected?: boolean;
}

export interface TimeEntryActivity {
  id: string;
  name: string;
}

export interface FavoriteTicket {
  ticket: string;
  title: string;
  projectId?: string;
}

// Singletons shared across all calls to useActivities()
const activities = ref<Activity[]>([]);
const projects = ref<Project[]>([]);
const timeEntryActivities = ref<TimeEntryActivity[]>([]);
const currentUserName = ref<string>("");
const favoriteTickets = ref<FavoriteTicket[]>([]);
const BASE_URL = "https://openproject.wposs.com/openproject/api/v3";

export function useActivities() {
  const { userConfig, maxDailyMinutes } = useUserConfig();

  const unsyncedActivities = computed(() => {
    return activities.value.filter((a) => a.ticket && !a.synced);
  });

  const manuallySelectedActivities = computed(() => {
    return unsyncedActivities.value.filter((a) => a.selected);
  });

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
    date: string,
    projectId?: string,
    ticket?: string,
    ticketTitle?: string,
  ) {
    activities.value.push({
      id: crypto.randomUUID(),
      name,
      minutes,
      date,
      projectId,
      ticket,
      ticketTitle,
      selected: false,
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
      const response = await fetch(`${BASE_URL}/projects`, {
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
        },
      });
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

  async function fetchCurrentUser() {
    if (!userConfig.value.openProjectToken) return;
    try {
      const response = await fetch(`${BASE_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
        },
      });
      if (!response.ok) return;
      const data = await response.json();
      currentUserName.value = data.name ?? data.login ?? "";
    } catch {
      // silently ignore
    }
  }

  async function fetchTimeEntryActivities() {
    if (!userConfig.value.openProjectToken) return;
    try {
      const response = await fetch(`${BASE_URL}/time_entries/activities`, {
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
        },
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data?._embedded?.elements) {
        timeEntryActivities.value = data._embedded.elements.map((a: any) => ({
          id: String(a.id),
          name: a.name,
        }));
      }
    } catch (error) {
      console.error("OpenProject activities error:", error);
    }
  }

  function minutesToISO(minutes: number): string {
    const hours = parseFloat((minutes / 60).toFixed(2));
    return `PT${hours}H`;
  }

  async function logTimeEntry(
    activityId: string,
    activityTypeId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const act = activities.value.find((a) => a.id === activityId);
    if (!act?.ticket) return { ok: false, error: "No ticket ID" };
    if (!userConfig.value.openProjectToken)
      return { ok: false, error: "No token" };

    const links: Record<string, { href: string }> = {
      entity: { href: `/api/v3/work_packages/${act.ticket}` },
      user: { href: `/api/v3/users/me` },
    };
    if (act.projectId) {
      links.project = { href: `/api/v3/projects/${act.projectId}` };
    }
    if (activityTypeId) {
      links.activity = {
        href: `/api/v3/time_entries/activities/${activityTypeId}`,
      };
    }

    const body = {
      comment: { format: "plain", raw: act.name },
      spentOn: act.date,
      hours: minutesToISO(act.minutes),
      _links: links,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${BASE_URL}/time_entries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return {
          ok: false,
          error: errData?.message ?? `HTTP ${response.status}`,
        };
      }
      // Mark the activity as synced
      const syncedAct = activities.value.find((a) => a.id === activityId);
      if (syncedAct) {
        syncedAct.synced = true;
        syncedAct.selected = false;
      }
      return { ok: true };
    } catch (error) {
      clearTimeout(timeoutId);
      return { ok: false, error: String(error) };
    }
  }

  function toggleFavorite(ticket: string, title: string, projectId?: string) {
    const index = favoriteTickets.value.findIndex((t) => t.ticket === ticket);
    if (index === -1) {
      favoriteTickets.value.push({ ticket, title, projectId });
    } else {
      favoriteTickets.value.splice(index, 1);
    }
  }

  function isFavorite(ticketId: string) {
    return favoriteTickets.value.some((t) => t.ticket === ticketId);
  }

  async function fetchTicketSubject(
    ticketId: string,
  ): Promise<{ subject: string; projectId: string } | null> {
    if (!userConfig.value.openProjectToken || !ticketId) return null;
    try {
      const response = await fetch(`${BASE_URL}/work_packages/${ticketId}`, {
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
        },
      });
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
    currentUserName,
    timeEntryActivities,
    fetchOpenProjectProjects,
    fetchCurrentUser,
    fetchTimeEntryActivities,
    fetchTicketSubject,
    logTimeEntry,
    favoriteTickets,
    toggleFavorite,
    isFavorite,
  };
}
