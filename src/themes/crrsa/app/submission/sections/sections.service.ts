import { Injectable } from '@angular/core';
import { NotificationsService } from '@dspace/core/notification-system/notifications.service';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { ScrollToService } from '@nicky-lenaers/ngx-scroll-to';
import { FormService } from 'src/app/shared/form/form.service';
import {
  DisableSectionAction,
  EnableSectionAction,
} from 'src/app/submission/objects/submission-objects.actions';
import { SectionsService } from 'src/app/submission/sections/sections.service';
import { SubmissionState } from 'src/app/submission/submission.reducers';
import { SubmissionService } from 'src/app/submission/submission.service';

/**
 * CRRSA section service extensions for local theme-only section state changes.
 */
@Injectable()
export class CrrsaSectionsService extends SectionsService {

  constructor(formService: FormService,
              notificationsService: NotificationsService,
              scrollToService: ScrollToService,
              submissionService: SubmissionService,
              private crrsaStore: Store<SubmissionState>,
              translate: TranslateService) {
    super(
      formService,
      notificationsService,
      scrollToService,
      submissionService,
      crrsaStore,
      translate,
    );
  }

  /**
   * Dispatch a new [EnableSectionAction] without scrolling to the section.
   *
   * @param submissionId
   *    The submission id
   * @param sectionId
   *    The section id
   */
  public enableSection(submissionId: string, sectionId: string) {
    this.crrsaStore.dispatch(new EnableSectionAction(submissionId, sectionId));
  }

  /**
   * Dispatch a new [DisableSectionAction].
   *
   * @param submissionId
   *    The submission id
   * @param sectionId
   *    The section id
   */
  public disableSection(submissionId: string, sectionId: string) {
    this.crrsaStore.dispatch(new DisableSectionAction(submissionId, sectionId));
  }
}
