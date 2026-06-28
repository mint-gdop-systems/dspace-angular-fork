import { Injectable } from '@angular/core';
import { DspaceRestService } from '@dspace/core/dspace-rest/dspace-rest.service';
import { RawRestResponse } from '@dspace/core/dspace-rest/raw-rest-response.model';
import { RESTURLCombiner } from '@dspace/core/url-combiner/rest-url-combiner';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { HttpParams } from '@angular/common/http';

export interface UserItemStatSummary {
  totalItems: number;
  approvedCount: number;
  pendingCount: number;
  judgePageCount: number;
  miscPageCount: number;
  otherPageCount: number;
  totalPageCount: number;
}

export interface UserItemStatRecord {
  itemId: string;
  caseNumber: string;
  status: string;
  submissionDate: string;
  fileCount: number;
  judgePageCount: number;
  miscPageCount: number;
  otherPageCount: number;
  totalPageCount: number;
}

export interface UserItemStatsResponse {
  summary: UserItemStatSummary;
  items: UserItemStatRecord[];
  totalElements: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserItemStatsService {

  constructor(protected restService: DspaceRestService) { }

  getStats(userId?: string, startDate?: string, endDate?: string, status?: string, page: number = 0, size: number = 10): Observable<UserItemStatsResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (userId) {
      params = params.set('userId', userId);
    }
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }
    if (status) {
      params = params.set('filterStatus', status);
    }

    const url = new RESTURLCombiner(environment.rest.baseUrl, 'statistics', `useritemstats?${params.toString()}`).toString();

    return this.restService.get(url).pipe(
      map((response: RawRestResponse) => response.payload as UserItemStatsResponse)
    );
  }
}
