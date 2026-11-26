import { Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import {
  BoardOption,
  BoardColumnDropPosition,
  BoardColumnOption,
  BoardWorkPackageCard,
  BoardLocation,
} from '../../interfaces/openproject.interface';
import { OpenprojectService } from './openproject.service';
import { WorkPackageApiService, isWorkPackageConflict } from './work-package-api.service';

/** Boards (grids), their columns (queries) and moving work packages between columns (cached). */
@Injectable({ providedIn: 'root' })
export class BoardApiService {
  private readonly openprojectService = inject(OpenprojectService);
  private readonly workPackageApi = inject(WorkPackageApiService);

  private readonly boardsCache = new Map<string, BoardOption[]>();

  private readonly boardColumnsCache = new Map<string, BoardColumnOption[]>();

  invalidateBoardCache(projectId?: string, gridId?: string): void {
    if (projectId) {
      this.boardsCache.delete(projectId);
    } else if (!gridId) {
      this.boardsCache.clear();
    }
    if (gridId) {
      this.boardColumnsCache.delete(gridId);
    } else if (!projectId) {
      this.boardColumnsCache.clear();
    }
  }

  async getProjectBoards(projectId: string, projectIdentifier?: string): Promise<BoardOption[]> {
    if (!projectId) return [];
    if (this.boardsCache.has(projectId)) {
      return this.boardsCache.get(projectId)!;
    }

    const token = this.openprojectService.getToken();
    if (!token) return [];
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        const res = await invoke<BoardOption[]>('fetch_project_boards', {
          url,
          token,
          projectId,
          projectIdentifier: projectIdentifier || null,
        });
        if (res && res.length) {
          this.boardsCache.set(projectId, res);
          return res;
        }
      } catch (err) {
        console.warn('Could not fetch project boards via Tauri:', err);
      }
    }

    try {
      const res = await fetch(`${url}/api/v3/grids`, {
        headers: this.openprojectService.buildAuthHeaders(token),
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data?._embedded?.elements) return [];

      const boards: BoardOption[] = data._embedded.elements
        .filter((g: Record<string, unknown>) => {
          const links = g['_links'] as Record<string, { href?: string; title?: string }> | undefined;
          const scope = links?.['scope']?.href ?? links?.['page']?.href ?? '';
          const isBoard =
            scope.endsWith('/boards') ||
            (Array.isArray((g as any).widgets) &&
              (g as any).widgets.some((w: any) => w.identifier === 'work_package_query'));
          const isSubtaskView = (g as any).options?.attribute === 'subtasks';
          if (!isBoard || isSubtaskView) return false;

          const projHref = links?.['project']?.href ?? '';
          const projId = projHref.split('/').pop() || '';
          const pid = String(projectId).trim();
          const matchesProject =
            projId === pid ||
            projHref.endsWith(`/${pid}`) ||
            scope.includes(`/${pid}/`) ||
            Boolean(projectIdentifier && scope.includes(`/${projectIdentifier}/`));

          return matchesProject;
        })
        .map((g: Record<string, unknown>) => {
          const links = g['_links'] as Record<string, { title?: string }> | undefined;
          return {
            id: String(g['id']),
            name:
              (g['name'] as string) ||
              links?.['scope']?.title ||
              links?.['page']?.title ||
              `Board ${g['id']}`,
            kind: ((g as any).options?.type as string | undefined) ?? null,
            attribute: ((g as any).options?.attribute as string | undefined) ?? null,
            createdAt: (g['createdAt'] as string | undefined) ?? null,
          };
        });

      this.boardsCache.set(projectId, boards);
      return boards;
    } catch (err) {
      console.warn('Boards fetch error:', err);
      return [];
    }
  }

  async getBoardColumns(gridId: string, forceRefresh = false): Promise<BoardColumnOption[]> {
    if (!gridId) return [];
    if (forceRefresh) {
      this.boardColumnsCache.delete(gridId);
    } else if (this.boardColumnsCache.has(gridId)) {
      return this.boardColumnsCache.get(gridId)!;
    }

    const token = this.openprojectService.getToken();
    if (!token) return [];
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        const res = await invoke<BoardColumnOption[]>('fetch_board_columns', {
          url,
          token,
          gridId,
        });
        if (res && res.length) {
          this.boardColumnsCache.set(gridId, res);
          return res;
        }
      } catch (err) {
        console.warn('Could not fetch board columns via Tauri:', err);
      }
    }

    try {
      const headers = this.openprojectService.buildAuthHeaders(token);
      const gridRes = await fetch(`${url}/api/v3/grids/${gridId}`, { headers });
      if (!gridRes.ok) return [];
      const gridData = await gridRes.json();
      const widgets: Array<{ id: number; startColumn: number; options?: { queryId?: string | number } }> =
        gridData.widgets ?? [];

      const columnResults = await Promise.all(
        widgets.map(async (widget) => {
          const queryId = String(widget.options?.queryId ?? '');
          if (!queryId) return null;

          try {
            const qRes = await fetch(`${url}/api/v3/queries/${queryId}`, { headers });
            if (!qRes.ok) return null;
            const qData = await qRes.json();
            const elements: Array<Record<string, any>> = qData._embedded?.results?._embedded?.elements ?? [];
            const workPackages: BoardWorkPackageCard[] = elements.map((el) => ({
              id: Number(el['id']),
              subject: String(el['subject'] || ''),
              typeName: el['_links']?.['type']?.['title'] || undefined,
              typeColor: el['_embedded']?.['type']?.['color'] || undefined,
              statusId: el['_links']?.['status']?.['href']?.split('/').pop() || undefined,
              statusName: el['_links']?.['status']?.['title'] || undefined,
              statusColor: el['_embedded']?.['status']?.['color'] || undefined,
              priorityName: el['_links']?.['priority']?.['title'] || undefined,
              assigneeName: el['_links']?.['assignee']?.['title'] || undefined,
              projectName: el['_links']?.['project']?.['title'] || undefined,
              startDate: el['startDate'] ?? null,
              dueDate: el['dueDate'] ?? null,
              lockVersion: typeof el['lockVersion'] === 'number' ? el['lockVersion'] : undefined,
            }));

            let statusId: string | undefined;
            let statusName: string | undefined;
            if (Array.isArray(qData.filters)) {
              const statusFilter = qData.filters.find((f: any) => {
                const href = f?._links?.filter?.href || '';
                const name = (f?.name || '').toLowerCase();
                return href.endsWith('/status') || href.endsWith('/status_id') || name === 'status' || name === 'estado';
              });
              if (statusFilter) {
                const valObj = statusFilter?._links?.values?.[0];
                if (valObj?.href) {
                  statusId = valObj.href.split('/').pop();
                  statusName = valObj.title;
                } else if (Array.isArray(statusFilter.values) && statusFilter.values.length > 0) {
                  const firstVal = statusFilter.values[0];
                  statusId = typeof firstVal === 'object' ? firstVal.id || firstVal.href?.split('/').pop() : String(firstVal);
                }
              }
            }

            return {
              queryId,
              name: qData.name ?? `Columna ${queryId}`,
              widgetId: widget.id,
              startColumn: widget.startColumn,
              workPackageIds: elements.map((e) => Number(e['id'])),
              workPackages,
              statusId,
              statusName,
            } as BoardColumnOption;
          } catch {
            return null;
          }
        })
      );

      const columns = columnResults
        .filter((c): c is BoardColumnOption => c !== null)
        .sort((a, b) => a.startColumn - b.startColumn);

      this.boardColumnsCache.set(gridId, columns);
      return columns;
    } catch (err) {
      console.warn('Columns fetch error:', err);
      return [];
    }
  }

  async findTicketBoardColumn(
    projectId: string,
    ticket: string,
    projectIdentifier?: string
  ): Promise<BoardLocation | null> {
    const ticketNum = parseInt(ticket.trim().replace(/^#/, ''), 10);
    if (isNaN(ticketNum)) return null;

    const boards = await this.getProjectBoards(projectId, projectIdentifier);
    if (!boards.length) return null;

    const results: Array<BoardLocation | null> = await Promise.all(
      boards.map(async (board): Promise<BoardLocation | null> => {
        const columns = await this.getBoardColumns(board.id);
        const col = columns.find((c) => c.workPackageIds.includes(ticketNum));
        if (!col) return null;
        return {
          boardId: board.id,
          boardName: board.name,
          boardColumnQueryId: col.queryId,
          boardColumnName: col.name,
          statusId: col.statusId,
          statusName: col.statusName,
        };
      })
    );

    return results.find((r): r is BoardLocation => r !== null) ?? null;
  }

  async moveWorkPackageToBoardColumn(
    ticket: string,
    targetQueryId: string,
    sourceQueryId?: string,
    targetStatusId?: string,
    dropPosition?: BoardColumnDropPosition,
    expectedLockVersion?: number
  ): Promise<{ ok: boolean; statusId?: string; error?: string; conflict?: boolean }> {
    const rawTicket = ticket.trim().replace(/^#/, '');
    const ticketNum = parseInt(rawTicket, 10);
    if (isNaN(ticketNum)) return { ok: false, error: 'Invalid ticket ID' };
    const token = this.openprojectService.getToken();
    if (!token) return { ok: false, error: 'No token' };
    const url = this.openprojectService.sanitizeUrl();

    if (this.openprojectService.isTauriApp()) {
      try {
        const res = await invoke<{ ok: boolean; statusId?: string; error?: string }>(
          'move_work_package_to_board_column',
          {
            url,
            token,
            ticket: rawTicket,
            targetQueryId,
            sourceQueryId: sourceQueryId || null,
            targetStatusId: targetStatusId || null,
            targetPositionIndex: dropPosition?.targetIndex ?? null,
            targetTicketIds: dropPosition?.targetTicketIds ?? null,
            expectedLockVersion: expectedLockVersion ?? null,
          }
        );

        if (res.ok) {
          this.boardColumnsCache.forEach((cols, gridId) => {
            if (cols.some((c) => c.queryId === targetQueryId || c.queryId === sourceQueryId)) {
              this.boardColumnsCache.delete(gridId);
            }
          });
        }
        return res.ok ? res : { ...res, conflict: isWorkPackageConflict(res.error || '') };
      } catch (err: any) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error, conflict: isWorkPackageConflict(error) };
      }
    }

    const headers = this.openprojectService.buildAuthHeaders(token);

    try {
      const workPackageEndpoint = `${url}/api/v3/work_packages/${rawTicket}`;
      const snapshotResponse = await fetch(workPackageEndpoint, { headers });
      if (!snapshotResponse.ok) return { ok: false, error: `HTTP ${snapshotResponse.status}` };
      const snapshot = await snapshotResponse.json();
      const currentLockVersion = Number(snapshot.lockVersion);
      if (
        expectedLockVersion !== undefined &&
        Number.isFinite(currentLockVersion) &&
        currentLockVersion !== expectedLockVersion
      ) {
        return {
          ok: false,
          conflict: true,
          error: 'The ticket changed in OpenProject. Refresh it before moving the card.',
        };
      }
      const patchLockVersion = expectedLockVersion ?? currentLockVersion;

      // 1. Resolve target status if not explicitly passed
      let effectiveStatusId = targetStatusId;
      if (!effectiveStatusId) {
        for (const cols of this.boardColumnsCache.values()) {
          const matched = cols.find((c) => c.queryId === targetQueryId);
          if (matched?.statusId) {
            effectiveStatusId = matched.statusId;
            break;
          }
        }
      }

      // 2. If it is an action board for status, update the ticket status in OpenProject
      let statusWasUpdated = false;
      if (effectiveStatusId && sourceQueryId !== targetQueryId) {
        const statusRes = await this.workPackageApi.updateWorkPackageStatus(rawTicket, effectiveStatusId, patchLockVersion);
        if (!statusRes.ok) {
          return { ok: false, error: statusRes.error || 'Could not update work package status.' };
        }
        statusWasUpdated = true;
      }

      // 3. Remove order from source query if distinct (-1 tells OpenProject to remove_order)
      if (sourceQueryId && sourceQueryId !== targetQueryId) {
        await fetch(`${url}/api/v3/queries/${sourceQueryId}/order`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ delta: { [String(ticketNum)]: -1 } }),
        }).catch((err) => console.warn('Could not remove previous order:', err));
      }

      // 4. Persist the requested drop position, or keep the legacy first-position behavior.
      let orderMap: Record<string, number> = {};
      try {
        const orderRes = await fetch(`${url}/api/v3/queries/${targetQueryId}/order`, {
          method: 'GET',
          headers,
        });
        if (!orderRes.ok) {
          if (dropPosition) {
            const error = await orderRes.text();
            return { ok: false, error: error || `HTTP ${orderRes.status}` };
          }
        } else {
          orderMap = await orderRes.json();
        }
      } catch (error) {
        if (dropPosition) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
        console.warn('Could not check existing query order:', error);
      }

      const orderDelta = buildQueryOrderDelta(ticketNum, orderMap, dropPosition);
      const putRes = await fetch(`${url}/api/v3/queries/${targetQueryId}/order`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ delta: orderDelta }),
      });

      if (!putRes.ok) {
        if (!statusWasUpdated) {
          const errData = await putRes.json().catch(() => null);
          return { ok: false, error: errData?.message || `HTTP ${putRes.status}` };
        }
      }

      // 5. Invalidate column cache for affected grids
      this.boardColumnsCache.forEach((cols, gridId) => {
        if (cols.some((c) => c.queryId === targetQueryId || c.queryId === sourceQueryId)) {
          this.boardColumnsCache.delete(gridId);
        }
      });

      return { ok: true, statusId: effectiveStatusId };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Returns the first board of the project with a column that contains the ticket (columns fetched in parallel). */
  async findBoardContainingTicket(
    projectId: string,
    identifier: string,
    ticketId: number
  ): Promise<string | null> {
    const boards = await this.getProjectBoards(projectId, identifier || undefined);
    const matches = await Promise.all(
      boards.map(async (board) => {
        try {
          const columns = await this.getBoardColumns(board.id);
          return columns.some(
            (column) =>
              column.workPackageIds.includes(ticketId) ||
              column.workPackages?.some((workPackage) => workPackage.id === ticketId)
          )
            ? board.id
            : null;
        } catch {
          return null;
        }
      })
    );
    return matches.find((boardId) => boardId !== null) ?? null;
  }
}

function buildQueryOrderDelta(
  ticketId: number,
  orderMap: Record<string, number>,
  dropPosition?: BoardColumnDropPosition
): Record<string, number> {
  const orderGap = 8192;
  const orderedEntry = Object.entries(orderMap)
    .map(([id, value]) => ({ id: Number(id), position: Number(value) }))
    .filter((entry) => Number.isSafeInteger(entry.id) && entry.id !== ticketId && Number.isFinite(entry.position))
    .sort((first, second) => first.position - second.position || first.id - second.id);

  if (!dropPosition) {
    const firstPosition = orderedEntry[0]?.position;
    return { [String(ticketId)]: firstPosition === undefined ? 0 : firstPosition - orderGap };
  }

  const targetTicketIds = [...new Set(dropPosition.targetTicketIds)]
    .filter((id) => Number.isSafeInteger(id) && id > 0 && id !== ticketId);
  const targetIndex = Math.max(0, Math.min(dropPosition.targetIndex, targetTicketIds.length));
  const previousTicketId = targetTicketIds[targetIndex - 1];
  const nextTicketId = targetTicketIds[targetIndex];
  const positionById = new Map(orderedEntry.map((entry) => [entry.id, entry.position]));
  const orderedTicketIds = orderedEntry.map((entry) => entry.id);

  for (let index = 0; index < targetTicketIds.length; index += 1) {
    const targetTicketId = targetTicketIds[index];
    if (orderedTicketIds.includes(targetTicketId)) continue;

    const nextKnownId = targetTicketIds.slice(index + 1).find((id) => orderedTicketIds.includes(id));
    if (nextKnownId !== undefined) {
      orderedTicketIds.splice(orderedTicketIds.indexOf(nextKnownId), 0, targetTicketId);
      continue;
    }

    const previousKnownId = targetTicketIds
      .slice(0, index)
      .reverse()
      .find((id) => orderedTicketIds.includes(id));
    if (previousKnownId !== undefined) {
      orderedTicketIds.splice(orderedTicketIds.indexOf(previousKnownId) + 1, 0, targetTicketId);
      continue;
    }

    orderedTicketIds.splice(Math.min(index, orderedTicketIds.length), 0, targetTicketId);
  }

  const nextIndex = nextTicketId === undefined ? -1 : orderedTicketIds.indexOf(nextTicketId);
  const previousIndex = previousTicketId === undefined ? -1 : orderedTicketIds.indexOf(previousTicketId);
  const insertionIndex = nextIndex >= 0
    ? nextIndex
    : previousIndex >= 0
      ? previousIndex + 1
      : Math.min(targetIndex, orderedTicketIds.length);
  const previousPosition = insertionIndex > 0 ? positionById.get(orderedTicketIds[insertionIndex - 1]) : undefined;
  const nextPosition = insertionIndex < orderedTicketIds.length
    ? positionById.get(orderedTicketIds[insertionIndex])
    : undefined;

  if (previousPosition !== undefined && nextPosition !== undefined && nextPosition - previousPosition > 1) {
    return { [String(ticketId)]: previousPosition + Math.floor((nextPosition - previousPosition) / 2) };
  }
  if (previousPosition !== undefined && insertionIndex === orderedTicketIds.length) {
    return { [String(ticketId)]: previousPosition + orderGap };
  }
  if (nextPosition !== undefined && insertionIndex === 0) {
    return { [String(ticketId)]: nextPosition - orderGap };
  }
  if (orderedTicketIds.length === 0) {
    return { [String(ticketId)]: 0 };
  }

  orderedTicketIds.splice(insertionIndex, 0, ticketId);
  return Object.fromEntries(orderedTicketIds.map((id, index) => [String(id), index * orderGap]));
}
