import { Injectable } from '@angular/core';
import { DSONameService } from '@dspace/core/breadcrumbs/dso-name.service';
import { BitstreamDataService } from '@dspace/core/data/bitstream-data.service';
import { BundleDataService } from '@dspace/core/data/bundle-data.service';
import { FieldChangeType } from '@dspace/core/data/object-updates/field-change-type.model';
import { FieldUpdate } from '@dspace/core/data/object-updates/field-update.model';
import { FieldUpdates } from '@dspace/core/data/object-updates/field-updates.model';
import { ObjectUpdatesService } from '@dspace/core/data/object-updates/object-updates.service';
import { RemoteData } from '@dspace/core/data/remote-data';
import { RequestService } from '@dspace/core/data/request.service';
import { NotificationsService } from '@dspace/core/notification-system/notifications.service';
// FIXED: Removed the leading slash and used the standard pagination model path
import { PaginationComponentOptions } from '@dspace/core/pagination/pagination-component-options.model';
import { getBitstreamDownloadRoute } from '@dspace/core/router/utils/dso-route.utils';
import { Bitstream } from '@dspace/core/shared/bitstream.model';
import { BitstreamFormat } from '@dspace/core/shared/bitstream-format.model';
import { Bundle } from '@dspace/core/shared/bundle.model';
import { NoContent } from '@dspace/core/shared/NoContent.model';
import {
  getFirstCompletedRemoteData,
  getFirstSucceededRemoteDataPayload,
} from '@dspace/core/shared/operators';
import {
  hasNoValue,
  hasValue,
} from '@dspace/shared/utils/empty.util';
import { TranslateService } from '@ngx-translate/core';
import { Operation } from 'fast-json-patch';
import {
  BehaviorSubject,
  Observable,
  zip as observableZip,
} from 'rxjs';
import {
  map,
  switchMap,
  take,
  tap,
} from 'rxjs/operators';
import { LiveRegionService } from 'src/app/shared/live-region/live-region.service';
import { ResponsiveTableSizes } from 'src/app/shared/responsive-table-sizes/responsive-table-sizes';
import { ResponsiveColumnSizes } from 'src/app/shared/responsive-table-sizes/responsive-column-sizes';

export const MOVE_KEY = 'item.edit.bitstreams.notifications.move';

export interface BitstreamTableEntry {
  bitstream: Bitstream;
  id: string;
  name: string;
  nameStripped: string;
  
  // Legal Metadata Fields
  section: string;      // legal.document.section
  type: string;         // legal.document.type
  status: string;       // legal.document.status
  exhibitCode: string;  // legal.document.exhibitCode
  
  description: string;
  format: Observable<BitstreamFormat>;
  downloadUrl: string;
}

export interface SelectedBitstreamTableEntry {
  bitstream: BitstreamTableEntry;
  bundle: Bundle;
  bundleSize: number;
  originalPosition: number;
  currentPosition: number;
}

export interface SelectionAction {
  action: 'Selected' | 'Moved' | 'Cleared' | 'Cancelled';
  selectedEntry: SelectedBitstreamTableEntry;
}

@Injectable({ providedIn: 'root' })
export class ItemBitstreamsService {

  protected selectionAction$: BehaviorSubject<SelectionAction> = new BehaviorSubject(null);
  protected isPerformingMoveRequest: BehaviorSubject<boolean> = new BehaviorSubject(false);

  constructor(
    protected notificationsService: NotificationsService,
    protected translateService: TranslateService,
    protected objectUpdatesService: ObjectUpdatesService,
    protected bitstreamService: BitstreamDataService,
    protected bundleService: BundleDataService,
    protected dsoNameService: DSONameService,
    protected requestService: RequestService,
    protected liveRegionService: LiveRegionService,
  ) {}

  /**
   * Returns the initial pagination options for the bitstreams list
   * within a bundle.
   */
  getInitialBitstreamsPaginationOptions(id: string = 'bitstreams-pagination-options'): PaginationComponentOptions {
    return Object.assign(new PaginationComponentOptions(), {
      id: id,
      currentPage: 1,
      pageSize: 10
    });
  }

  getSelectionAction$(): Observable<SelectionAction> {
    return this.selectionAction$;
  }

  getSelectionAction(): SelectionAction {
    const action = this.selectionAction$.value;
    return hasNoValue(action) ? null : Object.assign({}, action);
  }

  hasSelectedBitstream(): boolean {
    const selectionAction = this.getSelectionAction();
    if (hasNoValue(selectionAction)) { return false; }
    return selectionAction.action === 'Selected' || selectionAction.action === 'Moved';
  }

  getSelectedBitstream(): SelectedBitstreamTableEntry {
    if (!this.hasSelectedBitstream()) { return null; }
    return Object.assign({}, this.getSelectionAction().selectedEntry);
  }

  selectBitstreamEntry(entry: SelectedBitstreamTableEntry) {
    if (hasValue(entry) && entry.bitstream !== this.getSelectedBitstream()?.bitstream) {
      this.announceSelect(entry.bitstream.name);
      this.updateSelectionAction({ action: 'Selected', selectedEntry: entry });
    }
  }

  protected updateSelectionAction(action: SelectionAction) {
    this.selectionAction$.next(action);
  }

  clearSelection() {
    const selected = this.getSelectedBitstream();
    if (hasValue(selected)) {
      this.updateSelectionAction({ action: 'Cleared', selectedEntry: selected });
      this.announceClear(selected.bitstream.name);
      if (selected.currentPosition !== selected.originalPosition) {
        this.displaySuccessNotification(MOVE_KEY);
      }
    }
  }

  cancelSelection() {
    const selected = this.getSelectedBitstream();
    if (hasNoValue(selected) || this.getPerformingMoveRequest()) { return; }
    const originalPosition = selected.originalPosition;
    const currentPosition = selected.currentPosition;
    if (currentPosition === originalPosition) {
      this.announceClear(selected.bitstream.name);
      this.updateSelectionAction({ action: 'Cleared', selectedEntry: selected });
    } else {
      this.announceCancel(selected.bitstream.name, originalPosition);
      this.performBitstreamMoveRequest(selected.bundle, currentPosition, originalPosition);
      this.updateSelectionAction({ action: 'Cancelled', selectedEntry: selected });
    }
  }

  moveSelectedBitstreamUp() {
    const selected = this.getSelectedBitstream();
    if (hasNoValue(selected) || this.getPerformingMoveRequest()) { return; }
    const originalPosition = selected.currentPosition;
    if (originalPosition > 0) {
      const newPosition = originalPosition - 1;
      selected.currentPosition = newPosition;
      this.performBitstreamMoveRequest(selected.bundle, originalPosition, newPosition, () => {
        this.announceMove(selected.bitstream.name, newPosition);
      });
      this.updateSelectionAction({ action: 'Moved', selectedEntry: selected });
    }
  }

  moveSelectedBitstreamDown() {
    const selected = this.getSelectedBitstream();
    if (hasNoValue(selected) || this.getPerformingMoveRequest()) { return; }
    const originalPosition = selected.currentPosition;
    if (originalPosition < selected.bundleSize - 1) {
      const newPosition = originalPosition + 1;
      selected.currentPosition = newPosition;
      this.performBitstreamMoveRequest(selected.bundle, originalPosition, newPosition, () => {
        this.announceMove(selected.bitstream.name, newPosition);
      });
      this.updateSelectionAction({ action: 'Moved', selectedEntry: selected });
    }
  }

  performBitstreamMoveRequest(bundle: Bundle, fromIndex: number, toIndex: number, finish?: () => void) {
    if (this.getPerformingMoveRequest()) { return; }
    const moveOperation: Operation = {
      op: 'move',
      from: `/_links/bitstreams/${fromIndex}/href`,
      path: `/_links/bitstreams/${toIndex}/href`,
    };
    this.announceLoading();
    this.isPerformingMoveRequest.next(true);
    this.bundleService.patch(bundle, [moveOperation]).pipe(
      getFirstCompletedRemoteData(),
      tap((response: RemoteData<Bundle>) => this.displayFailedResponseNotifications(MOVE_KEY, [response])),
      switchMap(() => this.requestService.setStaleByHrefSubstring(bundle.self)),
      take(1),
    ).subscribe(() => {
      this.isPerformingMoveRequest.next(false);
      finish?.();
    });
  }

  getPerformingMoveRequest(): boolean { return this.isPerformingMoveRequest.value; }
  getPerformingMoveRequest$(): Observable<boolean> { return this.isPerformingMoveRequest; }

  /**
   * Defines the 8-column responsive layout for the Legal Metadata view.
   */
  getColumnSizes(): ResponsiveTableSizes {
    return new ResponsiveTableSizes([
      new ResponsiveColumnSizes(2, 2, 2, 2, 2), // Name
      new ResponsiveColumnSizes(1, 1, 1, 1, 1), // Section
      new ResponsiveColumnSizes(1, 1, 1, 1, 1), // Type
      new ResponsiveColumnSizes(1, 1, 1, 1, 1), // Exhibit
      new ResponsiveColumnSizes(1, 1, 1, 1, 1), // Status
      new ResponsiveColumnSizes(2, 2, 2, 3, 3), // Description
      new ResponsiveColumnSizes(1, 1, 1, 1, 1), // Format
      new ResponsiveColumnSizes(3, 3, 3, 2, 2), // Actions
    ]);
  }

  mapBitstreamsToTableEntries(bitstreams: Bitstream[]): BitstreamTableEntry[] {
    return bitstreams.map((bitstream) => {
      const name = this.dsoNameService.getName(bitstream);
      return {
        bitstream: bitstream,
        id: bitstream.uuid,
        name: name,
        nameStripped: this.stripWhiteSpace(name),
        section: bitstream.firstMetadataValue('legal.document.section'),
        type: bitstream.firstMetadataValue('legal.document.type'),
        status: bitstream.firstMetadataValue('legal.document.status'),
        exhibitCode: bitstream.firstMetadataValue('legal.document.exhibitCode'),
        description: bitstream.firstMetadataValue('dc.description'),
        format: bitstream.format.pipe(getFirstSucceededRemoteDataPayload()),
        downloadUrl: getBitstreamDownloadRoute(bitstream),
      };
    });
  }

  stripWhiteSpace(str: string): string { return str.replace(/\s+/g, ''); }

  displayNotifications(key: string, responses: RemoteData<any>[]) {
    this.displayFailedResponseNotifications(key, responses);
    this.displaySuccessFulResponseNotifications(key, responses);
  }
  displayFailedResponseNotifications(key: string, responses: RemoteData<any>[]) {
    responses.filter(r => hasValue(r) && r.hasFailed).forEach(r => this.displayErrorNotification(key, r.errorMessage));
  }
  displayErrorNotification(key: string, errorMessage: string) {
    this.notificationsService.error(this.translateService.instant(`${key}.failed.title`), errorMessage);
  }
  displaySuccessFulResponseNotifications(key: string, responses: RemoteData<any>[]) {
    if (responses.some(r => hasValue(r) && r.hasSucceeded)) { this.displaySuccessNotification(key); }
  }
  displaySuccessNotification(key: string) {
    this.notificationsService.success(this.translateService.instant(`${key}.saved.title`), this.translateService.instant(`${key}.saved.content`));
  }

  removeMarkedBitstreams(bundles$: Observable<Bundle[]>): Observable<RemoteData<NoContent>> {
    return bundles$.pipe(
      take(1),
      switchMap(bundles => observableZip(...bundles.map(b => this.objectUpdatesService.getFieldUpdates(b.self, [], true)))),
      map(updates => ([] as FieldUpdate[]).concat(...updates.map(u => Object.values(u).filter(f => f.changeType === FieldChangeType.REMOVE)))),
      map(fields => fields.map(f => f.field as Bitstream)),
      switchMap(removed => this.bitstreamService.removeMultiple(removed))
    );
  }

  announceSelect(name: string) { this.liveRegionService.addMessage(this.translateService.instant('item.edit.bitstreams.edit.live.select', { bitstream: name })); }
  announceMove(name: string, pos: number) { this.liveRegionService.addMessage(this.translateService.instant('item.edit.bitstreams.edit.live.move', { bitstream: name, toIndex: pos + 1 })); }
  announceCancel(name: string, pos: number) { this.liveRegionService.addMessage(this.translateService.instant('item.edit.bitstreams.edit.live.cancel', { bitstream: name, toIndex: pos + 1 })); }
  announceClear(name: string) { this.liveRegionService.addMessage(this.translateService.instant('item.edit.bitstreams.edit.live.clear', { bitstream: name })); }
  announceLoading() { this.liveRegionService.addMessage(this.translateService.instant('item.edit.bitstreams.edit.live.loading')); }
}