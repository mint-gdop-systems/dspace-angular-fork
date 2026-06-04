import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';

import { BtnDisabledDirective } from '../../../../../../app/shared/btn-disabled.directive';
import { BrowserOnlyPipe } from '../../../../../../app/shared/utils/browser-only.pipe';
import { SubmissionFormFooterComponent as BaseComponent } from '../../../../../../app/submission/form/footer/submission-form-footer.component';
import { ClaimedTaskDataService } from '@dspace/core/tasks/claimed-task-data.service';
import { NotificationsService } from '@dspace/core/notification-system/notifications.service';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SubmissionRestService } from '@dspace/core/submission/submission-rest.service';
import { SubmissionService } from '../../../../../../app/submission/submission.service';
import { getFirstCompletedRemoteData } from '@dspace/core/shared/operators';

@Component({
  selector: 'ds-themed-submission-form-footer',
  styleUrls: ['../../../../../../app/submission/form/footer/submission-form-footer.component.scss'],
  templateUrl: './submission-form-footer.component.html',
  standalone: true,
  imports: [
    AsyncPipe,
    CommonModule,
    BrowserOnlyPipe,
    BtnDisabledDirective,
    TranslatePipe,
  ],
})
export class SubmissionFormFooterComponent extends BaseComponent implements OnChanges {
  
  public hasApproveTask$ = new BehaviorSubject<boolean>(false);
  public processingApproveStatus$ = new BehaviorSubject<boolean>(false);
  private taskId: string;

  constructor(
    modalService: NgbModal,
    protected submissionRestService: SubmissionRestService,
    submissionService: SubmissionService,
    private claimedTaskDataService: ClaimedTaskDataService,
    private notificationsService: NotificationsService,
    private translate: TranslateService,
    private router: Router
  ) {
    super(modalService, submissionRestService, submissionService);
  }

  ngOnChanges(changes: SimpleChanges) {
    super.ngOnChanges(changes);
    if (changes.submissionId && this.submissionId) {
      console.log('SubmissionFormFooter: checking submissionId', this.submissionId);
      this.submissionRestService.getDataById('workflowitems', this.submissionId).pipe(
        filter((submissionObjects: any) => submissionObjects !== undefined && submissionObjects !== null),
        switchMap((submissionObjects: any) => {
          const submissionObject = Array.isArray(submissionObjects) ? submissionObjects[0] : submissionObjects;
          const itemUuid = submissionObject?.item?.uuid || submissionObject?.item?.id;
          if (itemUuid) {
             return this.claimedTaskDataService.findByItem(itemUuid).pipe(
               getFirstCompletedRemoteData()
             );
          }
          return of(null);
        })
      ).subscribe((rd: any) => {
        if (rd && rd.hasSucceeded && rd.payload) {
          this.taskId = rd.payload.id;
          this.hasApproveTask$.next(true);
        }
      });
    }
  }

  approve(event: Event) {
    event.preventDefault();
    if (this.taskId) {
       this.processingApproveStatus$.next(true);
       this.claimedTaskDataService.submitTask(this.taskId, { submit_approve: true }).subscribe((response) => {
         this.processingApproveStatus$.next(false);
         if (response.hasSucceeded) {
            this.notificationsService.success(null, this.translate.get('submission.workflow.tasks.generic.success'));
            this.router.navigate(['/mydspace']);
         } else {
            this.notificationsService.error(null, this.translate.get('submission.workflow.tasks.generic.error'));
         }
       });
    }
  }
}
