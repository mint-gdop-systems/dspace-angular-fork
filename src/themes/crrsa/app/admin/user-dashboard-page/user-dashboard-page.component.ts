import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AuthService } from '@dspace/core/auth/auth.service';
import { DspaceRestService } from '@dspace/core/dspace-rest/dspace-rest.service';
import { RawRestResponse } from '@dspace/core/dspace-rest/raw-rest-response.model';
import { RESTURLCombiner } from '@dspace/core/url-combiner/rest-url-combiner';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { map, shareReplay, switchMap, take } from 'rxjs/operators';
import { ThousandsSeparatorPipe } from 'src/app/shared/utils/thousands-separator.pipe';
import { environment } from 'src/environments/environment';

export interface UserContentStats {
  mySubmission: {
    workspace: {
      total: number;
      rejected: number;
    };
    workflow: {
      total: number;
      reviewstep?: number;
      editstep?: number;
      finaleditstep: number;
    };
    archived: number;
    withdrawn: number;
  };
  myActions: {
    [step: string]: {
      [action: string]: number;
    };
  };
}

@Component({
  selector: 'ds-user-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule, ThousandsSeparatorPipe],
  templateUrl: './user-dashboard-page.component.html',
  styleUrls: ['./user-dashboard-page.component.scss']
})
export class UserDashboardComponent implements OnInit {

  stats$: Observable<UserContentStats>;

  constructor(
    protected authService: AuthService,
    protected restService: DspaceRestService
  ) { }

  ngOnInit(): void {
    this.stats$ = this.authService.getAuthenticatedUserIdFromStore().pipe(
      take(1),
      switchMap((userId: string) => {
        const url = new RESTURLCombiner(environment.rest.baseUrl, 'statistics', 'usercontentstats', userId).toString();
        return this.restService.get(url).pipe(
          map((response: RawRestResponse) => response.payload as UserContentStats)
        );
      }),
      shareReplay(1)
    );
  }

  /**
   * Helper to check if any submissions exist
   */
  hasSubmissions(stats: UserContentStats): boolean {
    const s = stats.mySubmission;
    return (s.workspace?.total > 0) || 
           (s.workflow?.total > 0) || 
           (s.workflow?.reviewstep > 0) || 
           (s.workflow?.editstep > 0) || 
           (s.workflow?.finaleditstep > 0) || 
           (s.archived > 0) || 
           (s.withdrawn > 0);
  }

  /**
   * Helper to convert myActions object to an array for *ngFor
   */
  getActionEntries(actions: { [step: string]: { [action: string]: number } }): any[] {
    if (!actions) {
      return [];
    }
    return Object.entries(actions).map(([step, actionCounts]) => ({
      step,
      details: Object.entries(actionCounts).map(([action, count]) => ({ action, count }))
    }));
  }

  /**
   * Helper to find a count for a specific action (e.g. 'Approved') from the details array
   */
  getActionCount(details: any[], actionName: string): number {
    const detail = details.find(d => d.action.toLowerCase() === actionName.toLowerCase());
    return detail ? detail.count : 0;
  }

  /**
   * Convert technical step names to readable labels
   */
  getStepLabel(step: string): string {
    const labels = {
      'editstep': 'Edit Step',
      'reviewstep': 'Review Step',
      'finaleditstep': 'Final Edit Step'
    };
    return labels[step] || step;
  }
}
