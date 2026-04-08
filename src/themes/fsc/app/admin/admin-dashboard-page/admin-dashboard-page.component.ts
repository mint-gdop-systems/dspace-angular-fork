import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BitstreamDataService } from '@dspace/core/data/bitstream-data.service';
import { CollectionDataService } from '@dspace/core/data/collection-data.service';
import { AuthorizationDataService } from '@dspace/core/data/feature-authorization/authorization-data.service';
import { FeatureID } from '@dspace/core/data/feature-authorization/feature-id';
import { PaginatedList } from '@dspace/core/data/paginated-list.model';
import { RemoteData } from '@dspace/core/data/remote-data';
import { PaginationComponentOptions } from '@dspace/core/pagination/pagination-component-options.model';
import { Collection } from '@dspace/core/shared/collection.model';
import { DSpaceObjectType } from '@dspace/core/shared/dspace-object-type.model';
import { DSpaceObject } from '@dspace/core/shared/dspace-object.model';
import { HALEndpointService } from '@dspace/core/shared/hal-endpoint.service';
import { getFirstCompletedRemoteData } from '@dspace/core/shared/operators';
import { PaginatedSearchOptions } from '@dspace/core/shared/search/models/paginated-search-options.model';
import { SearchObjects } from '@dspace/core/shared/search/models/search-objects.model';
import { WorkflowItemDataService } from '@dspace/core/submission/workflowitem-data.service';
import { WorkspaceitemDataService } from '@dspace/core/submission/workspaceitem-data.service';
import { ClaimedTaskDataService } from '@dspace/core/tasks/claimed-task-data.service';
import { PoolTaskDataService } from '@dspace/core/tasks/pool-task-data.service';
import { TranslateModule } from '@ngx-translate/core';
import { combineLatest, Observable, of } from 'rxjs';
import { map, shareReplay, startWith, switchMap, take } from 'rxjs/operators';
import { SearchService } from 'src/app/shared/search/search.service';
import { UserDashboardComponent } from 'src/themes/fsc/app/admin/user-dashboard-page/user-dashboard-page.component';

@Component({
  selector: 'ds-admin-dashboard-page',
  templateUrl: './admin-dashboard-page.component.html',
  styleUrls: ['./admin-dashboard-page.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    UserDashboardComponent,
  ],
})
export class AdminDashboardPageComponent implements OnInit {
  collectionsCount$: Observable<number>;
  archivedItemsCount$: Observable<number>;
  workflowItemsCount$: Observable<number>;
  collectionsStats$: Observable<any[]>;

  isAdmin$: Observable<boolean>;

  activeTab: 'admin' | 'user' = 'admin';

  constructor(
    protected searchService: SearchService,
    protected bitstreamDataService: BitstreamDataService,
    protected workspaceitemDataService: WorkspaceitemDataService,
    protected workflowItemDataService: WorkflowItemDataService,
    protected poolTaskDataService: PoolTaskDataService,
    protected claimedTaskDataService: ClaimedTaskDataService,
    protected collectionDataService: CollectionDataService,
    protected halService: HALEndpointService,
    protected authorizationService: AuthorizationDataService,
  ) {}

  ngOnInit(): void {
    this.isAdmin$ = this.authorizationService
      .isAuthorized(FeatureID.AdministratorOf)
      .pipe(shareReplay(1));

    this.isAdmin$.pipe(take(1)).subscribe((isAdmin) => {
      if (!isAdmin) {
        this.activeTab = 'user';
      }
    });

    this.refresh();
  }

  refresh(): void {
    const oneElementPagination = Object.assign(
      new PaginationComponentOptions(),
      { id: 'admin-stats-one', pageSize: 1 },
    );
    const manyElementsPagination = Object.assign(
      new PaginationComponentOptions(),
      { id: 'admin-stats-many', pageSize: 100 },
    );

    // 0. Collections count (Discovery is best for this)
    this.collectionsCount$ = this.searchService
      .search(
        new PaginatedSearchOptions({
          dsoTypes: [DSpaceObjectType.COLLECTION],
          pagination: oneElementPagination,
        }),
      )
      .pipe(
        getFirstCompletedRemoteData(),
        map((rs: RemoteData<SearchObjects<DSpaceObject>>) =>
          rs.hasSucceeded ? rs.payload.totalElements : 0,
        ),
        startWith(0),
        shareReplay(1),
      );

    this.archivedItemsCount$ = this.searchService
      .search(
        new PaginatedSearchOptions({
          dsoTypes: [DSpaceObjectType.ITEM],
          pagination: oneElementPagination,
        }),
      )
      .pipe(
        getFirstCompletedRemoteData(),
        map((rs: RemoteData<SearchObjects<DSpaceObject>>) =>
          rs.hasSucceeded ? rs.payload.totalElements : 0,
        ),
        startWith(0),
        shareReplay(1),
      );

    // 3. Workflow items count (Targeted Workflow Search to match table)
    this.workflowItemsCount$ = this.searchService
      .search(
        new PaginatedSearchOptions({
          configuration: 'workflow',
          pagination: oneElementPagination,
        }),
        undefined,
        false,
      )
      .pipe(
        getFirstCompletedRemoteData(),
        map((rs: RemoteData<SearchObjects<DSpaceObject>>) =>
          rs.hasSucceeded ? rs.payload.totalElements : 0,
        ),
        startWith(0),
        shareReplay(1),
      );

    // 5. Collection Statistics (List ALL collections with Discovery counts)
    this.collectionsStats$ = this.collectionDataService
      .findAll({ elementsPerPage: 100 }, false)
      .pipe(
        getFirstCompletedRemoteData(),
        switchMap((rd: RemoteData<PaginatedList<Collection>>) => {
          if (rd.hasSucceeded && rd.payload?.page?.length > 0) {
            const collections = rd.payload.page;
            const stats$ = collections.map((coll) => {
              // 5a. Archived count from Discovery for this bucket
              const archived$ = this.searchService
                .search(
                  new PaginatedSearchOptions({
                    scope: coll.id,
                    dsoTypes: [DSpaceObjectType.ITEM],
                    pagination: oneElementPagination,
                  }),
                  undefined,
                  false,
                )
                .pipe(getFirstCompletedRemoteData(), startWith(null));

              // 5b. Workflow count from Discovery for this bucket
              const workflow$ = this.searchService
                .search(
                  new PaginatedSearchOptions({
                    configuration: 'workflow',
                    scope: coll.id,
                    pagination: oneElementPagination,
                  }),
                  undefined,
                  false,
                )
                .pipe(getFirstCompletedRemoteData(), startWith(null));

              return combineLatest([archived$, workflow$]).pipe(
                map(([archivedRd, workflowRd]) => ({
                  label: coll.name,
                  archivedCount:
                    archivedRd && archivedRd.hasSucceeded
                      ? archivedRd.payload.totalElements
                      : 0,
                  workflowCount:
                    workflowRd && workflowRd.hasSucceeded
                      ? workflowRd.payload.totalElements
                      : 0,
                })),
              );
            });
            return combineLatest(stats$);
          }
          return of<any[]>([]);
        }),
        shareReplay(1),
      );
  }
}
