import { CommonModule } from '@angular/common';
import {
    Component,
    OnInit,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { BitstreamDataService } from '@dspace/core/data/bitstream-data.service';
import { CollectionDataService } from '@dspace/core/data/collection-data.service';
import { CommunityDataService } from '@dspace/core/data/community-data.service';
import { AuthorizationDataService } from '@dspace/core/data/feature-authorization/authorization-data.service';
import { FeatureID } from '@dspace/core/data/feature-authorization/feature-id';
import { PaginatedList } from '@dspace/core/data/paginated-list.model';
import { RemoteData } from '@dspace/core/data/remote-data';
import { DspaceRestService } from '@dspace/core/dspace-rest/dspace-rest.service';
import { RawRestResponse } from '@dspace/core/dspace-rest/raw-rest-response.model';
import { PaginationComponentOptions } from '@dspace/core/pagination/pagination-component-options.model';
import { Collection } from '@dspace/core/shared/collection.model';
import { Community } from '@dspace/core/shared/community.model';
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
import { RESTURLCombiner } from '@dspace/core/url-combiner/rest-url-combiner';
import { TranslateModule } from '@ngx-translate/core';
import {
    BehaviorSubject,
    combineLatest,
    Observable,
    of,
    Subscription,
} from 'rxjs';
import {
    catchError,
    finalize,
    map,
    shareReplay,
    startWith,
    switchMap,
    take,
} from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { SearchService } from 'src/app/shared/search/search.service';
import { BitstreamStatisticsDashboardComponent } from 'src/themes/crrsa/app/admin/bitstream-statistics-page/bitstream-statistics-page.component';
import { UserDashboardComponent } from 'src/themes/crrsa/app/admin/user-dashboard-page/user-dashboard-page.component';

interface BitstreamStatCounts {
    bitstreams: number;
    pages: number;
}

interface CollectionBitstreamStats {
    collectionId: string;
    collectionName: string;
    approved: BitstreamStatCounts;
    draft: BitstreamStatCounts;
    pending: BitstreamStatCounts;
}

interface CommunityBitstreamStatsResponse {
    id: string | null;
    communityId: string;
    communityName: string;
    collections: CollectionBitstreamStats[];
    totals: {
        approved: BitstreamStatCounts;
        draft: BitstreamStatCounts;
        pending: BitstreamStatCounts;
    };
    type: string;
}

@Component({
    selector: 'ds-admin-dashboard-page',
    templateUrl: './admin-dashboard-page.component.html',
    styleUrls: ['./admin-dashboard-page.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        TranslateModule,
        BitstreamStatisticsDashboardComponent,
        UserDashboardComponent,
    ],
})
export class AdminDashboardPageComponent implements OnInit {

    collectionsCount$: Observable<number>;
    archivedItemsCount$: Observable<number>;
    workflowItemsCount$: Observable<number>;
    collectionsStats$: Observable<{ label: string; archivedCount: number; workflowCount: number; bitstreamApproved: number; bitstreamDraft: number; bitstreamPending: number; bitstreamCount: number; pageApproved: number; pageDraft: number; pagePending: number; pageCount: number }[]>;
    totals$: Observable<{ archivedCount: number; workflowCount: number; bitstreamApproved: number; bitstreamDraft: number; bitstreamPending: number; bitstreamCount: number; pageApproved: number; pageDraft: number; pagePending: number; pageCount: number }>;
    communities$: Observable<Community[]>;
    selectedCommunityId$: Observable<string>;

    loading$ = new BehaviorSubject<boolean>(false);
    private loadingSubscription?: Subscription;

    isAdmin$: Observable<boolean>;

    activeTab: 'admin' | 'user' | 'bitstream' = 'admin';

    constructor(
        protected searchService: SearchService,
        protected bitstreamDataService: BitstreamDataService,
        protected workspaceitemDataService: WorkspaceitemDataService,
        protected workflowItemDataService: WorkflowItemDataService,
        protected poolTaskDataService: PoolTaskDataService,
        protected claimedTaskDataService: ClaimedTaskDataService,
        protected collectionDataService: CollectionDataService,
        protected communityDataService: CommunityDataService,
        protected halService: HALEndpointService,
        protected authorizationService: AuthorizationDataService,
        protected restService: DspaceRestService,
    ) { }

    ngOnInit(): void {
        this.isAdmin$ = this.authorizationService.isAuthorized(FeatureID.AdministratorOf).pipe(
            shareReplay(1)
        );

        this.isAdmin$.pipe(take(1)).subscribe((isAdmin) => {
            if (!isAdmin) {
                this.activeTab = 'user';
            }
        });

        // Initialize communities list  
        this.communities$ = this.communityDataService.findAll({ elementsPerPage: 100 }).pipe(
            getFirstCompletedRemoteData(),
            map((rd: RemoteData<PaginatedList<Community>>) => rd.hasSucceeded ? rd.payload.page : []),
            shareReplay(1)
        );

        // Set default selected community (first one or 'all')  
        this.selectedCommunityId$ = this.communities$.pipe(
            map((communities) => communities.length > 0 ? communities[0].id : 'all'),
            shareReplay(1)
        );

        this.refresh();
    }

    refresh(): void {
        const oneElementPagination = Object.assign(new PaginationComponentOptions(), { id: 'admin-stats-one', pageSize: 1 });
        const manyElementsPagination = Object.assign(new PaginationComponentOptions(), { id: 'admin-stats-many', pageSize: 100 });

        // 0. Collections count (Discovery is best for this)
        this.collectionsCount$ = this.searchService.search(new PaginatedSearchOptions({
            dsoTypes: [DSpaceObjectType.COLLECTION],
            pagination: oneElementPagination,
        })).pipe(
            getFirstCompletedRemoteData(),
            map((rs: RemoteData<SearchObjects<DSpaceObject>>) => rs.hasSucceeded ? rs.payload.totalElements : 0),
            startWith(0),
            shareReplay(1),
        );

        this.archivedItemsCount$ = this.searchService.search(new PaginatedSearchOptions({
            dsoTypes: [DSpaceObjectType.ITEM],
            pagination: oneElementPagination,
        })).pipe(
            getFirstCompletedRemoteData(),
            map((rs: RemoteData<SearchObjects<DSpaceObject>>) => rs.hasSucceeded ? rs.payload.totalElements : 0),
            startWith(0),
            shareReplay(1),
        );


        // 3. Workflow items count (Targeted Workflow Search to match table)
        this.workflowItemsCount$ = this.searchService.search(new PaginatedSearchOptions({
            configuration: 'workflowAdmin',
            pagination: oneElementPagination,
        }), undefined, false).pipe(
            getFirstCompletedRemoteData(),
            map((rs: RemoteData<SearchObjects<DSpaceObject>>) => rs.hasSucceeded ? rs.payload.totalElements : 0),
            startWith(0),
            shareReplay(1),
        );

        // 5. Collection Statistics (List ALL collections with Discovery counts + bitstream stats)
        this.collectionsStats$ = this.selectedCommunityId$.pipe(
            switchMap((selectedCommunityId) => {
                const bitstreamStats$ = this.loadCommunityBitstreamStats(selectedCommunityId);
                return this.collectionDataService.findByParent(
                    selectedCommunityId,
                    { elementsPerPage: 100 },
                ).pipe(
                    getFirstCompletedRemoteData(),
                    switchMap((rd: RemoteData<PaginatedList<Collection>>) => {
                        return bitstreamStats$.pipe(
                            map((bitstreamStats) => ({ rd, bitstreamStats })),
                        );
                    }),
                );
            }),
            switchMap(({ rd, bitstreamStats }: { rd: RemoteData<PaginatedList<Collection>>; bitstreamStats: CommunityBitstreamStatsResponse | null }) => {
                const zero = { approved: 0, draft: 0, pending: 0 };
                const bitstreamMap = new Map<string, { bitstreams: typeof zero; pages: typeof zero }>();
                if (bitstreamStats?.collections) {
                    for (const coll of bitstreamStats.collections) {
                        const approved = coll.approved || { bitstreams: 0, pages: 0 };
                        const draft = coll.draft || { bitstreams: 0, pages: 0 };
                        const pending = coll.pending || { bitstreams: 0, pages: 0 };
                        bitstreamMap.set(coll.collectionId, {
                            bitstreams: { approved: approved.bitstreams, draft: draft.bitstreams, pending: pending.bitstreams },
                            pages: { approved: approved.pages, draft: draft.pages, pending: pending.pages },
                        });
                    }
                }

                if (rd.hasSucceeded && rd.payload?.page?.length > 0) {
                    const collections = rd.payload.page;
                    const stats$ = collections.map((coll) => {
                        const archived$ = this.searchService.search(new PaginatedSearchOptions({
                            scope: coll.id,
                            dsoTypes: [DSpaceObjectType.ITEM],
                            pagination: oneElementPagination,
                        }), undefined, false).pipe(getFirstCompletedRemoteData(), startWith(null));

                        const workflow$ = this.searchService.search(new PaginatedSearchOptions({
                            configuration: 'workflowAdmin',
                            scope: coll.id,
                            pagination: oneElementPagination,
                        }), undefined, false).pipe(getFirstCompletedRemoteData(), startWith(null));

                        return combineLatest([archived$, workflow$]).pipe(
                            map(([archivedRd, workflowRd]) => {
                                const bs = bitstreamMap.get(coll.id) || { bitstreams: zero, pages: zero };
                                return {
                                    label: coll.name,
                                    archivedCount: (archivedRd && archivedRd.hasSucceeded) ? archivedRd.payload.totalElements : 0,
                                    workflowCount: (workflowRd && workflowRd.hasSucceeded) ? workflowRd.payload.totalElements : 0,
                                    bitstreamApproved: bs.bitstreams.approved,
                                    bitstreamDraft: bs.bitstreams.draft,
                                    bitstreamPending: bs.bitstreams.pending,
                                    bitstreamCount: bs.bitstreams.approved + bs.bitstreams.draft + bs.bitstreams.pending,
                                    pageApproved: bs.pages.approved,
                                    pageDraft: bs.pages.draft,
                                    pagePending: bs.pages.pending,
                                    pageCount: bs.pages.approved + bs.pages.draft + bs.pages.pending,
                                };
                            }),
                        );
                    });
                    return combineLatest(stats$);
                }
                return of<any[]>([]);
            }),
            shareReplay(1),
        );

        this.totals$ = this.collectionsStats$.pipe(
            map((stats) => {
                if (!stats || stats.length === 0) {
                    return { archivedCount: 0, workflowCount: 0, bitstreamApproved: 0, bitstreamDraft: 0, bitstreamPending: 0, bitstreamCount: 0, pageApproved: 0, pageDraft: 0, pagePending: 0, pageCount: 0 };
                }
                return {
                    archivedCount: stats.reduce((sum, s) => sum + s.archivedCount, 0),
                    workflowCount: stats.reduce((sum, s) => sum + s.workflowCount, 0),
                    bitstreamApproved: stats.reduce((sum, s) => sum + s.bitstreamApproved, 0),
                    bitstreamDraft: stats.reduce((sum, s) => sum + s.bitstreamDraft, 0),
                    bitstreamPending: stats.reduce((sum, s) => sum + s.bitstreamPending, 0),
                    bitstreamCount: stats.reduce((sum, s) => sum + s.bitstreamCount, 0),
                    pageApproved: stats.reduce((sum, s) => sum + s.pageApproved, 0),
                    pageDraft: stats.reduce((sum, s) => sum + s.pageDraft, 0),
                    pagePending: stats.reduce((sum, s) => sum + s.pagePending, 0),
                    pageCount: stats.reduce((sum, s) => sum + s.pageCount, 0),
                };
            }),
            shareReplay(1),
        );

        this.loadingSubscription?.unsubscribe();
        this.loading$.next(true);
        this.loadingSubscription = this.collectionsStats$.pipe(
            take(1),
            finalize(() => this.loading$.next(false)),
        ).subscribe();
    }

    private loadCommunityBitstreamStats(communityId: string): Observable<CommunityBitstreamStatsResponse | null> {
        if (!communityId || communityId === 'all') {
            return of(null);
        }
        const url = new RESTURLCombiner(
            environment.rest.baseUrl,
            'statistics',
            'communitybitstreamstats',
            'search',
            'byCommunity',
        ).toString();
        return this.restService.get(`${url}?communityId=${encodeURIComponent(communityId)}`).pipe(
            map((response: RawRestResponse) => response.payload as CommunityBitstreamStatsResponse),
            catchError(() => of(null)),
        );
    }

    onCommunityChange(event: Event): void {
        const communityId = (event.target as HTMLSelectElement).value;
        this.selectedCommunityId$ = of(communityId).pipe(shareReplay(1));
        this.loading$.next(true);
        this.refresh();
    }
}
