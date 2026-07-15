import { CommonModule, NgClass } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DspaceRestService } from '@dspace/core/dspace-rest/dspace-rest.service';
import { RawRestResponse } from '@dspace/core/dspace-rest/raw-rest-response.model';
import { EPersonDataService } from '@dspace/core/eperson/eperson-data.service';
import { EPerson } from '@dspace/core/eperson/models/eperson.model';
import { getFirstCompletedRemoteData } from '@dspace/core/shared/operators';
import { RESTURLCombiner } from '@dspace/core/url-combiner/rest-url-combiner';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface BitstreamStatisticsResponse {
  totals: {
    bitstreams: number;
    pdfPages: number;
  };
  entityTypeBreakdown: Record<string, { bitstreams: number; pdfPages: number }>;
  itemStatusBreakdown: Record<string, { bitstreams: number; pdfPages: number }>;
  documentTypeBreakdown: Record<string, { bitstreams: number; pdfPages: number }>;
}

@Component({
  selector: 'ds-bitstream-statistics-dashboard',
  standalone: true,
  imports: [CommonModule, NgClass, ReactiveFormsModule, TranslateModule],
  templateUrl: './bitstream-statistics-page.component.html',
  styleUrls: ['./bitstream-statistics-page.component.scss'],
})
export class BitstreamStatisticsDashboardComponent implements OnInit {

  filtersForm = new FormGroup({
    submitter: new FormControl(''),
    date: new FormControl(''),
  });

  stats$: Observable<BitstreamStatisticsResponse | null>;
  suggestions$: Observable<EPerson[]>;
  showSuggestions = false;

  constructor(
    protected restService: DspaceRestService,
    protected epersonDataService: EPersonDataService,
  ) { }

  ngOnInit(): void {
    this.stats$ = this.filtersForm.valueChanges.pipe(
      startWith(this.filtersForm.value),
      debounceTime(300),
      distinctUntilChanged((previous, current) => JSON.stringify(previous) === JSON.stringify(current)),
      switchMap((values) => this.loadStatistics(values.submitter ?? '', values.date ?? '')),
      shareReplay(1),
    );

    this.suggestions$ = this.filtersForm.get('submitter')!.valueChanges.pipe(
      startWith(this.filtersForm.get('submitter')!.value ?? ''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query: string) => this.searchUsers(query)),
      shareReplay(1),
    );
  }

  private searchUsers(query: string): Observable<EPerson[]> {
    const value = (query ?? '').trim();
    if (!value) {
      return of([]);
    }

    return this.epersonDataService.searchByScope('metadata', value, { elementsPerPage: 5 }, true).pipe(
      getFirstCompletedRemoteData(),
      map((rd) => (rd.hasSucceeded && rd.payload?.page ? rd.payload.page : [])),
      catchError(() => of([])),
    );
  }

  selectUser(eperson: EPerson): void {
    this.filtersForm.patchValue({ submitter: eperson.email || eperson.uuid || eperson.name });
    this.showSuggestions = false;
  }

  clearFilters(): void {
    this.filtersForm.reset({ submitter: '', date: '' });
    this.showSuggestions = false;
  }

  hideSuggestions(): void {
    window.setTimeout(() => {
      this.showSuggestions = false;
    }, 150);
  }

  get hasActiveFilters(): boolean {
    return !!(this.filtersForm.get('submitter')?.value?.toString().trim() || this.filtersForm.get('date')?.value);
  }

  private loadStatistics(submitter: string, date: string): Observable<BitstreamStatisticsResponse | null> {
    const params = new URLSearchParams();

    if (submitter) {
      params.set('submitter', submitter);
    }
    if (date) {
      params.set('date', date);
    }

    const url = new RESTURLCombiner(
      environment.rest.baseUrl,
      'statistics',
      'bitstreamstatistics',
      'search',
      'getStatistics',
    ).toString();

    const finalUrl = params.toString().length > 0 ? `${url}?${params.toString()}` : url;

    return this.restService.get(finalUrl).pipe(
      map((response: RawRestResponse) => response.payload as BitstreamStatisticsResponse),
      catchError(() => of(null)),
    );
  }

  getBreakdownEntries(breakdown: Record<string, { bitstreams: number; pdfPages: number }> | undefined): Array<{ label: string; bitstreams: number; pdfPages: number }> {
    if (!breakdown) {
      return [];
    }

    return Object.entries(breakdown).map(([label, value]) => ({
      label,
      bitstreams: value?.bitstreams ?? 0,
      pdfPages: value?.pdfPages ?? 0,
    }));
  }
}
