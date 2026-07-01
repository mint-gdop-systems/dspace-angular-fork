import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EPersonDataService } from '@dspace/core/eperson/eperson-data.service';
import { EPerson } from '@dspace/core/eperson/models/eperson.model';
import { PaginationComponentOptions } from '@dspace/core/pagination/pagination-component-options.model';
import { FindListOptions } from 'src/app/core/data/find-list-options.model';
import { RemoteData } from 'src/app/core/data/remote-data';
import { PaginatedList } from 'src/app/core/data/paginated-list.model';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, Observable, of, merge } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, shareReplay, startWith, switchMap, take } from 'rxjs/operators';
import { PaginationComponent } from 'src/app/shared/pagination/pagination.component';
import { PaginationService } from '@dspace/core/pagination/pagination.service';
import { UserItemStatsResponse, UserItemStatsService } from './user-item-stats.service';
import { getFirstCompletedRemoteData } from '@dspace/core/shared/operators';

@Component({
  selector: 'ds-user-item-stats',
  standalone: true,
  imports: [CommonModule, TranslateModule, ReactiveFormsModule, PaginationComponent],
  templateUrl: './user-item-stats.component.html',
  styleUrls: ['./user-item-stats.component.scss']
})
export class UserItemStatsComponent implements OnInit {

  stats$: BehaviorSubject<UserItemStatsResponse | null> = new BehaviorSubject<UserItemStatsResponse | null>(null);
  loading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  exporting$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  filtersForm = new FormGroup({
    submitterDisplay: new FormControl(''),
    submitterId: new FormControl(''),
    status: new FormControl(''),
    startDate: new FormControl(''),
    endDate: new FormControl(''),
  });

  suggestions$: Observable<EPerson[]>;
  showSuggestions = false;

  paginationOptions: PaginationComponentOptions;
  page: number = 1;
  pageSize: number = 10;

  constructor(
    private statsService: UserItemStatsService,
    private epersonService: EPersonDataService,
    private paginationService: PaginationService
  ) {
    this.paginationOptions = new PaginationComponentOptions();
    this.paginationOptions.id = 'user-item-stats-pagination';
    this.paginationOptions.pageSize = this.pageSize;
    this.paginationOptions.currentPage = this.page;
  }

  ngOnInit(): void {
    // Setup typeahead suggestions
    this.suggestions$ = this.filtersForm.get('submitterDisplay')!.valueChanges.pipe(
      startWith(this.filtersForm.get('submitterDisplay')!.value ?? ''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query: string) => this.searchUsers(query)),
      shareReplay(1),
    );

    // Setup auto-reload on filter changes
    merge(
      this.filtersForm.get('submitterId')!.valueChanges,
      this.filtersForm.get('status')!.valueChanges,
      this.filtersForm.get('startDate')!.valueChanges,
      this.filtersForm.get('endDate')!.valueChanges
    ).pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      // If we are not on page 1, reset to page 1. The paginationService will trigger loadStats.
      if (this.page !== 1) {
        this.paginationService.updateRoute(this.paginationOptions.id, { page: 1 });
      } else {
        // If we are already on page 1, paginationService won't trigger, so we manually loadStats.
        this.loadStats();
      }
    });

    this.paginationService.getCurrentPagination(this.paginationOptions.id, this.paginationOptions).subscribe((currentPagination) => {
      this.page = currentPagination.currentPage;
      this.paginationOptions.currentPage = this.page;
      this.loadStats();
    });
  }

  private searchUsers(query: string): Observable<EPerson[]> {
    const value = (query ?? '').trim();
    if (!value) {
      return of([]);
    }

    return this.epersonService.searchByScope('metadata', value, { elementsPerPage: 5 }, true).pipe(
      getFirstCompletedRemoteData(),
      map((rd: RemoteData<PaginatedList<EPerson>>) => (rd.hasSucceeded && rd.payload?.page ? rd.payload.page : [])),
      catchError(() => of([])),
    );
  }

  selectUser(eperson: EPerson): void {
    this.filtersForm.patchValue({
      submitterDisplay: eperson.name || eperson.email || eperson.uuid,
      submitterId: eperson.uuid
    });
    this.showSuggestions = false;
  }

  onUserBlur(): void {
    window.setTimeout(() => {
      this.showSuggestions = false;
      const display = this.filtersForm.get('submitterDisplay')?.value?.trim();
      if (!display) {
        // If they cleared the box, clear the hidden ID too
        this.filtersForm.patchValue({ submitterId: '' }, { emitEvent: true });
      }
    }, 150);
  }

  loadStats() {
    this.loading$.next(true);
    const formVals = this.filtersForm.value;
    // Page is 0-indexed for backend, 1-indexed for frontend pagination component
    this.statsService.getStats(formVals.submitterId, formVals.startDate, formVals.endDate, formVals.status, this.page - 1, this.pageSize)
      .pipe(take(1))
      .subscribe((response: UserItemStatsResponse) => {
        this.stats$.next(response);
        this.loading$.next(false);
      }, err => {
        console.error(err);
        this.loading$.next(false);
      });
  }

  exportToExcel() {
    this.exporting$.next(true);
    const formVals = this.filtersForm.value;
    this.statsService.exportStats(formVals.submitterId, formVals.startDate, formVals.endDate, formVals.status)
      .pipe(take(1))
      .subscribe((blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'user_item_stats.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.exporting$.next(false);
      }, err => {
        console.error('Export failed', err);
        this.exporting$.next(false);
      });
  }
}
