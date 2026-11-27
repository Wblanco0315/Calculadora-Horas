import { Injectable, inject } from '@angular/core';
import { WorkPackageApiService } from './openproject/work-package-api.service';

export interface WorkPackageChangeCheck {
  changed: boolean;
  canVerify: boolean;
  streamAvailable: boolean;
  currentLockVersion: number | null;
  currentUpdatedAt: string | null;
  checkedAt: string;
}

@Injectable({ providedIn: 'root' })
export class WorkPackageChangeService {
  private readonly workPackageApi = inject(WorkPackageApiService);

  async checkForChanges(
    ticket: string,
    expectedLockVersion: number,
    updateCursor: string,
    expectedUpdatedAt?: string | null
  ): Promise<WorkPackageChangeCheck> {
    const checkedAt = new Date().toISOString();
    const [revisionList, stream] = await Promise.all([
      this.workPackageApi.getWorkPackageRevisions([ticket]),
      this.workPackageApi.getWorkPackageUpdateStream(ticket, updateCursor),
    ]);
    const ticketId = ticket.trim().replace(/^#/, '');
    const revision = revisionList.find((item) => item.id === ticketId);
    const currentLockVersion = revision?.lockVersion ?? null;
    const currentUpdatedAt = revision?.updatedAt ?? null;
    const versionChanged = currentLockVersion !== null && currentLockVersion !== expectedLockVersion;
    const timestampChanged = Boolean(expectedUpdatedAt && currentUpdatedAt && expectedUpdatedAt !== currentUpdatedAt);

    return {
      changed: versionChanged || timestampChanged || stream.hasUpdates,
      canVerify: revision !== undefined || stream.available,
      streamAvailable: stream.available,
      currentLockVersion,
      currentUpdatedAt,
      checkedAt,
    };
  }
}
