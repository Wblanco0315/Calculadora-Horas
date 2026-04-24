import { ref, computed } from "vue";
import { fetch } from "@tauri-apps/plugin-http";
import { useUserConfig } from "./useUserConfig";

export interface Project {
  id: string;
  name: string;
  identifier?: string;
}

export interface StatusOption {
  id: string;
  name: string;
  color?: string;
}

export interface Version {
  id: string;
  name: string;
  status?: string;
}

export interface Board {
  id: string;
  name: string;
}

export interface BoardColumn {
  queryId: string;
  name: string;
  widgetId: number;
  startColumn: number;
  workPackageIds: number[];
}

export interface Activity {
  id: string;
  name: string;
  minutes: number;
  date: string;
  projectId?: string;
  ticket?: string;
  ticketTitle?: string;
  statusId?: string;
  statusName?: string;
  statusColor?: string;
  availableStatuses?: StatusOption[];
  versionId?: string;
  versionName?: string;
  boardId?: string;
  boardColumnQueryId?: string;
  boardColumnName?: string;
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
const statuses = ref<StatusOption[]>([]);
const versionsCache = ref<Map<string, Version[]>>(new Map());
const boardsCache = ref<Map<string, Board[]>>(new Map());
const boardColumnsCache = ref<Map<string, BoardColumn[]>>(new Map());
const BASE_URL = "https://openproject.wposs.com/openproject/api/v3";

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
    date: string,
    projectId?: string,
    ticket?: string,
    ticketTitle?: string,
    statusId?: string,
    statusName?: string,
    statusColor?: string,
    availableStatuses?: StatusOption[],
    versionId?: string,
    versionName?: string,
  ) {
    activities.value.push({
      id: crypto.randomUUID(),
      name,
      minutes,
      date,
      projectId,
      ticket,
      ticketTitle,
      statusId,
      statusName,
      statusColor,
      availableStatuses,
      versionId,
      versionName,
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
      const pageSize = 100;
      let offset = 1;
      let total = Infinity;
      const allProjects: { id: string; name: string; identifier?: string }[] = [];

      while (allProjects.length < total) {
        const response = await fetch(
          `${BASE_URL}/projects?pageSize=${pageSize}&offset=${offset}`,
          {
            headers: {
              Authorization: `Bearer ${userConfig.value.openProjectToken}`,
            },
          },
        );
        if (!response.ok) throw new Error("Failed to fetch projects");
        const data = await response.json();
        if (!data?._embedded?.elements) break;

        total = data.total ?? 0;
        const elements = data._embedded.elements;
        allProjects.push(
          ...elements.map((p: any) => ({
            id: String(p.id),
            name: p.name,
            identifier: p.identifier ?? undefined,
          })),
        );

        if (elements.length < pageSize) break;
        offset += pageSize;
      }

      projects.value = allProjects;
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

  async function fetchStatuses() {
    if (!userConfig.value.openProjectToken) return;
    try {
      const response = await fetch(`${BASE_URL}/statuses`, {
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
        },
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data?._embedded?.elements) {
        statuses.value = data._embedded.elements.map((s: any) => ({
          id: String(s.id),
          name: s.name,
          color: s.color ?? undefined,
        }));
      }
    } catch (error) {
      console.error("OpenProject statuses error:", error);
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
      workPackage: { href: `/api/v3/work_packages/${act.ticket}` },
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

    try {
      const response = await fetch(`${BASE_URL}/time_entries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

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

  async function fetchTicketSubject(ticketId: string): Promise<{
    subject: string;
    projectId: string;
    statusId?: string;
    statusName?: string;
    statusColor?: string;
    availableStatuses?: StatusOption[];
    versionId?: string;
    versionName?: string;
  } | null> {
    if (!userConfig.value.openProjectToken || !ticketId) return null;
    try {
      const [wpResponse, formResponse] = await Promise.all([
        fetch(`${BASE_URL}/work_packages/${ticketId}`, {
          headers: {
            Authorization: `Bearer ${userConfig.value.openProjectToken}`,
          },
        }),
        fetch(`${BASE_URL}/work_packages/${ticketId}/form`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${userConfig.value.openProjectToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      ]);

      if (!wpResponse.ok) return null;
      const data = await wpResponse.json();
      const subject = data.subject || null;
      if (!subject) return null;

      const projectId = data._embedded?.project?.id
        ? String(data._embedded.project.id)
        : null;
      const statusHref: string = data._links?.status?.href ?? "";
      const statusId = statusHref ? statusHref.split("/").pop() : undefined;
      const statusName: string = data._links?.status?.title ?? "";
      const statusColor: string = data._embedded?.status?.color ?? "";

      // Extract available statuses for this work package from the form schema
      let availableStatuses: StatusOption[] | undefined;
      if (formResponse.ok) {
        const formData = await formResponse.json();
        console.debug(
          "[OP] form schema status:",
          JSON.stringify(formData?._embedded?.schema?.status),
        );

        // allowedValues can be an inline array or a HAL _links array
        const allowedRaw =
          formData?._embedded?.schema?.status?.allowedValues ??
          formData?._embedded?.schema?.status?._links?.allowedValues;

        const allowedArray: any[] = Array.isArray(allowedRaw) ? allowedRaw : [];

        if (allowedArray.length) {
          // Build a set of allowed IDs (extracted from href or id field)
          const allowedIds = new Set<string>(
            allowedArray.map((s: any) =>
              s.id ? String(s.id) : ((s.href ?? "").split("/").pop() ?? ""),
            ),
          );

          // Prefer the global statuses list (has colors); fall back to link data
          availableStatuses = statuses.value.length
            ? statuses.value.filter((s) => allowedIds.has(s.id))
            : allowedArray.map((s: any) => ({
                id: s.id
                  ? String(s.id)
                  : ((s.href ?? "").split("/").pop() ?? ""),
                name: s.name ?? s.title ?? "",
                color: s.color ?? undefined,
              }));
        }
      }

      const versionHref: string = data._links?.version?.href ?? "";
      const versionId = versionHref ? versionHref.split("/").pop() : undefined;
      const versionName: string = data._links?.version?.title ?? "";

      return {
        subject,
        projectId: projectId ?? "",
        statusId: statusId || undefined,
        statusName: statusName || undefined,
        statusColor: statusColor || undefined,
        availableStatuses,
        versionId: versionId || undefined,
        versionName: versionName || undefined,
      };
    } catch (error) {
      console.error("OpenProject ticket error:", error);
      return null;
    }
  }

  async function updateWorkPackageStatus(
    activityId: string,
    newStatusId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const act = activities.value.find((a) => a.id === activityId);
    if (!act?.ticket) return { ok: false, error: "No ticket ID" };
    if (!userConfig.value.openProjectToken)
      return { ok: false, error: "No token" };

    try {
      // Fetch current lockVersion (required by OpenProject for all PATCH requests)
      const wpRes = await fetch(`${BASE_URL}/work_packages/${act.ticket}`, {
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
        },
      });
      if (!wpRes.ok) return { ok: false, error: `HTTP ${wpRes.status}` };
      const wpData = await wpRes.json();
      const lockVersion: number = wpData.lockVersion;

      // PATCH with new status
      const patchRes = await fetch(`${BASE_URL}/work_packages/${act.ticket}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lockVersion,
          _links: {
            status: { href: `/api/v3/statuses/${newStatusId}` },
          },
        }),
      });

      if (!patchRes.ok) {
        const errData = await patchRes.json().catch(() => ({}));
        return {
          ok: false,
          error: errData?.message ?? `HTTP ${patchRes.status}`,
        };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  async function fetchProjectVersions(projectId: string): Promise<Version[]> {
    if (!userConfig.value.openProjectToken || !projectId) return [];
    if (versionsCache.value.has(projectId))
      return versionsCache.value.get(projectId)!;
    try {
      const response = await fetch(
        `${BASE_URL}/projects/${projectId}/versions`,
        {
          headers: {
            Authorization: `Bearer ${userConfig.value.openProjectToken}`,
          },
        },
      );
      if (!response.ok) return [];
      const data = await response.json();
      if (!data?._embedded?.elements) return [];
      const versions: Version[] = data._embedded.elements.map((v: any) => ({
        id: String(v.id),
        name: v.name,
        status: v.status ?? undefined,
      }));
      versionsCache.value.set(projectId, versions);
      return versions;
    } catch {
      return [];
    }
  }

  async function updateWorkPackageVersion(
    activityId: string,
    newVersionId: string | null,
  ): Promise<{ ok: boolean; error?: string }> {
    const act = activities.value.find((a) => a.id === activityId);
    if (!act?.ticket) return { ok: false, error: "No ticket ID" };
    if (!userConfig.value.openProjectToken)
      return { ok: false, error: "No token" };

    try {
      const wpRes = await fetch(`${BASE_URL}/work_packages/${act.ticket}`, {
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
        },
      });
      if (!wpRes.ok) return { ok: false, error: `HTTP ${wpRes.status}` };
      const wpData = await wpRes.json();
      const lockVersion: number = wpData.lockVersion;

      const patchRes = await fetch(`${BASE_URL}/work_packages/${act.ticket}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lockVersion,
          _links: {
            version: newVersionId
              ? { href: `/api/v3/versions/${newVersionId}` }
              : { href: null },
          },
        }),
      });

      if (!patchRes.ok) {
        const errData = await patchRes.json().catch(() => ({}));
        return {
          ok: false,
          error: errData?.message ?? `HTTP ${patchRes.status}`,
        };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  async function fetchProjectBoards(projectId: string): Promise<Board[]> {
    if (!userConfig.value.openProjectToken || !projectId) return [];
    if (boardsCache.value.has(projectId))
      return boardsCache.value.get(projectId)!;
    try {
      // Use the project identifier to build the scope URL for the grids filter
      const project = projects.value.find((p) => p.id === projectId);
      let url: string;
      if (project?.identifier) {
        const scopeUrl = `/openproject/projects/${project.identifier}/boards`;
        const filters = encodeURIComponent(
          JSON.stringify([{ scope: { operator: "=", values: [scopeUrl] } }]),
        );
        url = `${BASE_URL}/grids?filters=${filters}`;
      } else {
        // Fallback: filter by project ID (may not work on all OP versions)
        const filters = encodeURIComponent(
          JSON.stringify([
            { project: { operator: "=", values: [projectId] } },
          ]),
        );
        url = `${BASE_URL}/grids?filters=${filters}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
        },
      });
      if (!response.ok) return [];
      const data = await response.json();
      if (!data?._embedded?.elements) return [];
      const boards: Board[] = data._embedded.elements.map((g: any) => ({
        id: String(g.id),
        name: g.name ?? `Board ${g.id}`,
      }));
      boardsCache.value.set(projectId, boards);
      return boards;
    } catch {
      return [];
    }
  }

  async function fetchBoardColumns(gridId: string): Promise<BoardColumn[]> {
    if (!userConfig.value.openProjectToken || !gridId) return [];
    if (boardColumnsCache.value.has(gridId))
      return boardColumnsCache.value.get(gridId)!;
    try {
      const gridRes = await fetch(`${BASE_URL}/grids/${gridId}`, {
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
        },
      });
      if (!gridRes.ok) return [];
      const gridData = await gridRes.json();
      const widgets: any[] = gridData.widgets ?? [];

      const columnResults = await Promise.all(
        widgets.map(async (widget: any) => {
          const queryId = String(widget.options?.queryId ?? "");
          if (!queryId) return null;
          try {
            const qRes = await fetch(`${BASE_URL}/queries/${queryId}`, {
              headers: {
                Authorization: `Bearer ${userConfig.value.openProjectToken}`,
              },
            });
            if (!qRes.ok) return null;
            const qData = await qRes.json();
            const elements: any[] =
              qData._embedded?.results?._embedded?.elements ?? [];
            return {
              queryId,
              name: qData.name ?? `Columna ${queryId}`,
              widgetId: widget.id,
              startColumn: widget.startColumn,
              workPackageIds: elements.map((e: any) => e.id as number),
            } as BoardColumn;
          } catch {
            return null;
          }
        }),
      );

      const columns = columnResults
        .filter((c): c is BoardColumn => c !== null)
        .sort((a, b) => a.startColumn - b.startColumn);

      boardColumnsCache.value.set(gridId, columns);
      return columns;
    } catch {
      return [];
    }
  }

  // Searches all boards of a project to find which board+column contains a ticket.
  async function findTicketBoardColumn(
    projectId: string,
    ticketId: string,
  ): Promise<{
    boardId: string;
    boardName: string;
    boardColumnQueryId: string;
    boardColumnName: string;
  } | null> {
    const ticketNum = parseInt(ticketId, 10);
    if (isNaN(ticketNum)) return null;

    const boards = await fetchProjectBoards(projectId);
    if (!boards.length) return null;

    const results = await Promise.all(
      boards.map(async (board) => {
        const columns = await fetchBoardColumns(board.id);
        const col = columns.find((c) => c.workPackageIds.includes(ticketNum));
        return col
          ? {
              boardId: board.id,
              boardName: board.name,
              boardColumnQueryId: col.queryId,
              boardColumnName: col.name,
            }
          : null;
      }),
    );

    return results.find((r) => r !== null) ?? null;
  }

  async function moveWorkPackageToBoardColumn(
    activityId: string,
    targetQueryId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const act = activities.value.find((a) => a.id === activityId);
    if (!act?.ticket) return { ok: false, error: "No ticket ID" };
    if (!userConfig.value.openProjectToken)
      return { ok: false, error: "No token" };

    try {
      // Fetch target column's current ordered work packages
      const qRes = await fetch(`${BASE_URL}/queries/${targetQueryId}`, {
        headers: {
          Authorization: `Bearer ${userConfig.value.openProjectToken}`,
        },
      });
      if (!qRes.ok) return { ok: false, error: `HTTP ${qRes.status}` };
      const qData = await qRes.json();

      const elements: any[] =
        qData._embedded?.results?._embedded?.elements ?? [];
      const sortedIds: number[] = elements
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((e: any) => e.id as number);

      const ticketNum = parseInt(act.ticket, 10);
      if (!isNaN(ticketNum) && !sortedIds.includes(ticketNum)) {
        sortedIds.push(ticketNum);
      }

      // Build position map { "wpId": index } for the PUT /order endpoint
      const orderBody: Record<string, number> = {};
      sortedIds.forEach((id, idx) => {
        orderBody[String(id)] = idx;
      });

      const putRes = await fetch(
        `${BASE_URL}/queries/${targetQueryId}/order`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${userConfig.value.openProjectToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderBody),
        },
      );

      if (!putRes.ok) {
        const errData = await putRes.json().catch(() => ({}));
        return {
          ok: false,
          error: errData?.message ?? `HTTP ${putRes.status}`,
        };
      }
      // Invalidate the cache for the target column's board so next open re-fetches
      boardColumnsCache.value.forEach((cols, gridId) => {
        if (cols.some((c) => c.queryId === targetQueryId)) {
          boardColumnsCache.value.delete(gridId);
        }
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  return {
    activities,
    projects,
    statuses,
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
    fetchStatuses,
    fetchTicketSubject,
    logTimeEntry,
    updateWorkPackageStatus,
    fetchProjectVersions,
    updateWorkPackageVersion,
    fetchProjectBoards,
    fetchBoardColumns,
    findTicketBoardColumn,
    moveWorkPackageToBoardColumn,
    favoriteTickets,
    toggleFavorite,
    isFavorite,
  };
}
