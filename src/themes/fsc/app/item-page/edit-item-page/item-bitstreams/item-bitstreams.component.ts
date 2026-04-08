import {
  AsyncPipe,
  NgClass,
} from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  HostListener,
  NgZone,
  OnDestroy,
} from '@angular/core';
import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';
import { ObjectCacheService } from '@dspace/core/cache/object-cache.service';
import { BitstreamDataService } from '@dspace/core/data/bitstream-data.service';
import { BundleDataService } from '@dspace/core/data/bundle-data.service';
import { ItemDataService } from '@dspace/core/data/item-data.service';
import { ObjectUpdatesService } from '@dspace/core/data/object-updates/object-updates.service';
import { PaginatedList } from '@dspace/core/data/paginated-list.model';
import { RemoteData } from '@dspace/core/data/remote-data';
import { RequestService } from '@dspace/core/data/request.service';
import { NotificationsService } from '@dspace/core/notification-system/notifications.service';
import { PaginationComponentOptions } from '@dspace/core/pagination/pagination-component-options.model';
import { Bundle } from '@dspace/core/shared/bundle.model';
import { NoContent } from '@dspace/core/shared/NoContent.model';
import {
  getFirstSucceededRemoteData,
  getRemoteDataPayload,
} from '@dspace/core/shared/operators';// Ensure 'of' is imported
import { PaginatedSearchOptions } from '@dspace/core/shared/search/models/paginated-search-options.model';
import {
  hasValue,
  isNotEmpty,
} from '@dspace/shared/utils/empty.util';
import {
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { Operation } from 'fast-json-patch';
import {
  of,
  BehaviorSubject,
  combineLatest,
  Observable,
  Subscription,
} from 'rxjs';
import {
  filter,
  map,
  switchMap,
  take,
} from 'rxjs/operators';
import { AlertComponent } from 'src/app/shared/alert/alert.component';
import { AlertType } from 'src/app/shared/alert/alert-type';

import { ItemBitstreamsService } from './item-bitstreams.service';
import { ItemEditBitstreamBundleComponent } from './item-edit-bitstream-bundle/item-edit-bitstream-bundle.component';
import { BtnDisabledDirective } from 'src/app/shared/btn-disabled.directive';
import { ThemedLoadingComponent } from 'src/app/shared/loading/themed-loading.component';
import { VarDirective } from 'src/app/shared/utils/var.directive';
import { ObjectValuesPipe } from 'src/app/shared/utils/object-values-pipe';
import { AbstractItemUpdateComponent } from 'src/app/item-page/edit-item-page/abstract-item-update/abstract-item-update.component';
import { ResponsiveTableSizes } from 'src/app/shared/responsive-table-sizes/responsive-table-sizes';

/**
 * Component for displaying an item's bitstreams edit page, customized for Legal/Court Case metadata.
 */
@Component({
  selector: 'ds-item-bitstreams',
  styleUrls: ['../../../../../../app/item-page/edit-item-page/item-bitstreams/item-bitstreams.component.scss'],
  templateUrl: '../../../../../../app/item-page/edit-item-page/item-bitstreams/item-bitstreams.component.html',
  standalone: true,
  imports: [
    AlertComponent,
    AsyncPipe,
    BtnDisabledDirective,
    ItemEditBitstreamBundleComponent,
    NgClass,
    RouterLink,
    ThemedLoadingComponent,
    TranslateModule,
    VarDirective,
  ],
  providers: [ObjectValuesPipe],
})
export class ItemBitstreamsComponent extends AbstractItemUpdateComponent implements OnDestroy {

  // Declared for use in template
  protected readonly AlertType = AlertType;

  /**
   * All bundles for the current item
   */
  private bundlesSubject = new BehaviorSubject<Bundle[]>([]);

  /**
   * The page options to use for fetching the bundles
   */
  bundlesOptions: PaginationComponentOptions = Object.assign(new PaginationComponentOptions(), {
    id: 'bundles-pagination-options',
    currentPage: 1,
    pageSize: 10,
  });

  /**
   * The bootstrap sizes used for the columns within this table (configured for legal metadata)
   */
  columnSizes: ResponsiveTableSizes;

  /**
   * Are we currently submitting the changes?
   */
  submitting = false;

  /**
   * A subscription that checks when the item is deleted in cache and reloads the item
   */
  itemUpdateSubscription: Subscription;

  /**
   * The flag indicating to show the load more link
   */
  showLoadMoreLink$: BehaviorSubject<boolean> = new BehaviorSubject(true);

  /**
   * The list of bundles for the current item as an observable
   */
  get bundles$(): Observable<Bundle[]> {
    return this.bundlesSubject.asObservable();
  }

  /**
   * An observable which emits a boolean which represents whether the service is currently handling a 'move' request
   */
  isProcessingMoveRequest: Observable<boolean>;

  constructor(
    public itemService: ItemDataService,
    public objectUpdatesService: ObjectUpdatesService,
    public router: Router,
    public notificationsService: NotificationsService,
    public translateService: TranslateService,
    public route: ActivatedRoute,
    public bitstreamService: BitstreamDataService,
    public objectCache: ObjectCacheService,
    public requestService: RequestService,
    public cdRef: ChangeDetectorRef,
    public bundleService: BundleDataService,
    public zone: NgZone,
    public itemBitstreamsService: ItemBitstreamsService,
  ) {
    super(itemService, objectUpdatesService, router, notificationsService, translateService, route);

    // This retrieves the 8-column layout defined in the service (Name, Section, Type, Exhibit, Status, Desc, Format, Actions)
    this.columnSizes = this.itemBitstreamsService.getColumnSizes();
    this.isProcessingMoveRequest = this.itemBitstreamsService.getPerformingMoveRequest$();
  }

  /**
   * Actions to perform after the item has been initialized
   */
  postItemInit(): void {
    this.loadBundles(1);
  }

  /**
   * Handles keyboard events to move the currently selected bitstream up
   */
  @HostListener('document:keydown.arrowUp', ['$event'])
  moveUp(event: KeyboardEvent) {
    if (this.itemBitstreamsService.hasSelectedBitstream()) {
      event.preventDefault();
      this.itemBitstreamsService.moveSelectedBitstreamUp();
    }
  }

  /**
   * Handles keyboard events to move the currently selected bitstream down
   */
  @HostListener('document:keydown.arrowDown', ['$event'])
  moveDown(event: KeyboardEvent) {
    if (this.itemBitstreamsService.hasSelectedBitstream()) {
      event.preventDefault();
      this.itemBitstreamsService.moveSelectedBitstreamDown();
    }
  }

  /**
   * Handles keyboard events to cancel selection (return to original position)
   */
  @HostListener('document:keyup.escape', ['$event'])
  cancelSelection(event: KeyboardEvent) {
    if (this.itemBitstreamsService.hasSelectedBitstream()) {
      event.preventDefault();
      this.itemBitstreamsService.cancelSelection();
    }
  }

  /**
   * Handles keyboard events to clear selection (keep in current position)
   */
  @HostListener('document:keydown.enter', ['$event'])
  @HostListener('document:keydown.space', ['$event'])
  clearSelection(event: KeyboardEvent) {
    if (
      this.itemBitstreamsService.hasSelectedBitstream() &&
      event.target instanceof Element &&
      event.target.tagName === 'BODY'
    ) {
      event.preventDefault();
      this.itemBitstreamsService.clearSelection();
    }
  }

  /**
   * Initialize the notification messages prefix
   */
  initializeNotificationsPrefix(): void {
    this.notificationsPrefix = 'item.edit.bitstreams.notifications.';
  }

  /**
   * Load bundles for the current item
   * @param currentPage The current page to load
   */
  loadBundles(currentPage?: number) {
    this.bundlesOptions = Object.assign(new PaginationComponentOptions(), this.bundlesOptions, {
      currentPage: currentPage || this.bundlesOptions.currentPage + 1,
    });
    this.itemService.getBundles(this.item.id, new PaginatedSearchOptions({ pagination: this.bundlesOptions })).pipe(
      getFirstSucceededRemoteData(),
      getRemoteDataPayload(),
    ).subscribe((bundles: PaginatedList<Bundle>) => {
      this.updateBundles(bundles);
    });
  }

  /**
   * Update the subject containing the bundles
   */
  updateBundles(newBundlesPL: PaginatedList<Bundle>) {
    const currentBundles = this.bundlesSubject.getValue();
    const bundlesToAdd = newBundlesPL.page
      .filter(bundleToAdd => !currentBundles.some(currentBundle => currentBundle.id === bundleToAdd.id));

    const updatedBundles = [...currentBundles, ...bundlesToAdd];

    this.showLoadMoreLink$.next(updatedBundles.length < newBundlesPL.totalElements);
    this.bundlesSubject.next(updatedBundles);
  }

  /**
   * Submit changes (specifically removals)
   */
  submit() {
    this.submitting = true;

    const removedResponses$ = this.itemBitstreamsService.removeMarkedBitstreams(this.bundles$.pipe(take(1)));

    removedResponses$.subscribe((responses: RemoteData<NoContent>) => {
      this.itemBitstreamsService.displayNotifications('item.edit.bitstreams.notifications.remove', [responses]);
      this.submitting = false;
    });
  }

  /**
   * Handle drag-and-drop bitstream reordering
   */
  dropBitstream(bundle: Bundle, event: any) {
    this.zone.runOutsideAngular(() => {
      if (hasValue(event) && hasValue(event.fromIndex) && hasValue(event.toIndex) && hasValue(event.finish)) {
        const moveOperation = {
          op: 'move',
          from: `/_links/bitstreams/${event.fromIndex}/href`,
          path: `/_links/bitstreams/${event.toIndex}/href`,
        } as Operation;
        this.bundleService.patch(bundle, [moveOperation]).pipe(take(1)).subscribe((response: RemoteData<Bundle>) => {
          this.zone.run(() => {
            this.displayNotifications('item.edit.bitstreams.notifications.move', [response]);
            this.requestService.removeByHrefSubstring(bundle.self).pipe(
              filter((isCached) => isCached),
              take(1),
            ).subscribe(() => event.finish());
          });
        });
      }
    });
  }

  /**
   * Generic notification handler
   */
  displayNotifications(key: string, responses: RemoteData<any>[]) {
    if (isNotEmpty(responses)) {
      const failedResponses = responses.filter((response: RemoteData<Bundle>) => hasValue(response) && response.hasFailed);
      const successfulResponses = responses.filter((response: RemoteData<Bundle>) => hasValue(response) && response.hasSucceeded);

      failedResponses.forEach((response: RemoteData<Bundle>) => {
        this.notificationsService.error(this.translateService.instant(`${key}.failed.title`), response.errorMessage);
      });
      if (successfulResponses.length > 0) {
        this.notificationsService.success(this.translateService.instant(`${key}.saved.title`), this.translateService.instant(`${key}.saved.content`));
      }
    }
  }

  /**
   * Discard all current changes
   */
  discard() {
    const undoNotification = this.notificationsService.info(this.getNotificationTitle('discarded'), this.getNotificationContent('discarded'), { timeOut: this.discardTimeOut });
    this.objectUpdatesService.discardAllFieldUpdates(this.url, undoNotification);
  }

  /**
   * Undo discarding changes
   */
  reinstate() {
    this.bundles$.pipe(take(1)).subscribe((bundles: Bundle[]) => {
      bundles.forEach((bundle: Bundle) => {
        this.objectUpdatesService.reinstateFieldUpdates(bundle.self);
      });
    });
  }

  /**
   * Is the object reinstatable?
   */
/**
   * Checks whether or not the object is currently reinstatable
   */
  isReinstatable(): Observable<boolean> {
    return this.bundles$.pipe(
      switchMap((bundles: Bundle[]) => {
        if (bundles.length === 0) {
          return of([false]); // Use 'of' to return Observable<boolean[]>
        }
        return combineLatest(bundles.map((bundle: Bundle) => this.objectUpdatesService.isReinstatable(bundle.self)));
      }),
      map((reinstatable: boolean[]) => reinstatable.includes(true)),
    );
  }

  
  /**
   * Are there unsaved changes?
   */
hasChanges(): Observable<boolean> {
  return this.bundles$.pipe(
    switchMap((bundles: Bundle[]) => {
      if (bundles.length === 0) {
        // Wrap the array in 'of' so it emits the array itself as one value
        return of([false]); 
      }
      return combineLatest(
        bundles.map((bundle: Bundle) => this.objectUpdatesService.hasUpdates(bundle.self))
      );
    }),
    map((hasChanges: boolean[]) => hasChanges.includes(true)),
  );
}

  ngOnDestroy(): void {
    if (this.itemUpdateSubscription) {
      this.itemUpdateSubscription.unsubscribe();
    }
  }
}