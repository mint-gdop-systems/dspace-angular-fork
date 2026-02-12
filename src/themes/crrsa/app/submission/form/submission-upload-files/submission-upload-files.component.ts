
import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { NotificationsService } from '@dspace/core/notification-system/notifications.service';
import { WorkspaceitemSectionUploadObject } from '@dspace/core/submission/models/workspaceitem-section-upload.model';
import { WorkspaceItem } from '@dspace/core/submission/models/workspaceitem.model';
import { SectionsType } from '@dspace/core/submission/sections-type';
import { SubmissionJsonPatchOperationsService } from '@dspace/core/submission/submission-json-patch-operations.service';
import { normalizeSectionData } from '@dspace/core/submission/submission-response-parsing.service';
import { hasValue, isEmpty, isNotEmpty } from '@dspace/shared/utils/empty.util';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  Observable,
  of,
  Subscription,
} from 'rxjs';
import {
  first,
  take,
} from 'rxjs/operators';
import { UploaderOptions } from 'src/app/shared/upload/uploader/uploader-options.model';
import { SectionsService } from 'src/app/submission/sections/sections.service';
import { SectionUploadService } from 'src/app/submission/sections/upload/section-upload.service';
import { SubmissionService } from 'src/app/submission/submission.service';
import parseSectionErrors from 'src/app/submission/utils/parseSectionErrors';
import { FilePreviewPanelComponent } from 'src/themes/crrsa/app/shared/upload/file-preview-panel/file-preview-panel.component';
import { UploaderComponent } from 'src/themes/crrsa/app/shared/upload/uploader/uploader.component';

/**
 * This component represents the drop zone that provides to add files to the submission.
 */
@Component({
  selector: 'ds-base-submission-upload-files',
  templateUrl: './submission-upload-files.component.html',
  styleUrls: ['./submission-upload-files.component.scss'],
  imports: [
    UploaderComponent,
    FilePreviewPanelComponent,
    CommonModule,
    TranslateModule
  ],
  standalone: true,
})
export class SubmissionUploadFilesComponent implements OnInit, OnChanges, OnDestroy {
  public fileList: any[] = [];
  public selectedFile: any = null;

  /**
   * The collection id this submission belonging to
   * @type {string}
   */
  @Input() collectionId: string;

  /**
   * The submission id
   * @type {string}
   */
  @Input() submissionId: string;

  /**
   * The uploader configuration options
   * @type {UploaderOptions}
   */
  @Input() uploadFilesOptions: UploaderOptions;

  /**
   * A boolean representing if is possible to active drop zone over the document page
   * @type {boolean}
   */
  public enableDragOverDocument = true;

  /**
   * i18n message label
   * @type {string}
   */
  public dropOverDocumentMsg = 'submission.sections.upload.drop-message';

  /**
   * i18n message label
   * @type {string}
   */
  public dropMsg = 'submission.sections.upload.drop-message';

  /**
   * Array to track all subscriptions and unsubscribe them onDestroy
   * @type {Array}
   */
  private subs: Subscription[] = [];

  /**
   * A boolean representing if upload functionality is enabled
   * @type {boolean}
   */
  private uploadEnabled: Observable<boolean> = of(false);

  /**
   * Save submission before to upload a file
   */
  public onBeforeUpload = () => {
    const sub: Subscription = this.operationsService.jsonPatchByResourceType(
      this.submissionService.getSubmissionObjectLinkName(),
      this.submissionId,
      'sections')
      .subscribe();
    this.subs.push(sub);
    return sub;
  };

  /**
   * Initialize instance variables
   *
   * @param {NotificationsService} notificationsService
   * @param {SubmissionJsonPatchOperationsService} operationsService
   * @param {SectionsService} sectionService
   * @param {SubmissionService} submissionService
   * @param {TranslateService} translate
   */
  constructor(private notificationsService: NotificationsService,
    private operationsService: SubmissionJsonPatchOperationsService,
    private sectionService: SectionsService,
    private submissionService: SubmissionService,
    private translate: TranslateService,
    private uploadService: SectionUploadService) {
  }

  ngOnInit() {
    this.subs.push(
      this.uploadService.getUploadedFilesData(this.submissionId, 'upload')
        .subscribe((uploadData: WorkspaceitemSectionUploadObject) => {
          console.log('SubmissionUploadFilesComponent: uploadData', uploadData);
          if (uploadData && uploadData.files) {
            // Ensure fileList is always an array
            this.fileList = Array.isArray(uploadData.files) ? uploadData.files : Object.values(uploadData.files);
            console.log('SubmissionUploadFilesComponent: fileList', this.fileList);
            if (!this.selectedFile && this.fileList.length > 0) {
              this.selectedFile = this.fileList[0];
            }
          }
        })
    );
  }

  onFileSelectedForPreview(file: any) {
    this.selectedFile = file;
  }

  /**
   * Check if upload functionality is enabled
   */
  ngOnChanges() {
    this.uploadEnabled = this.sectionService.isSectionTypeAvailable(this.submissionId, SectionsType.Upload);
  }

  /**
   * Parse the submission object retrieved from REST after upload
   *
   * @param workspaceitem
   *    The submission object retrieved from REST
   */
  public onCompleteItem(workspaceitem: WorkspaceItem) {
    // Checks if upload section is enabled so do upload
    this.subs.push(
      this.uploadEnabled
        .pipe(first())
        .subscribe((isUploadEnabled) => {
          if (isUploadEnabled) {

            const { sections } = workspaceitem;
            const { errors } = workspaceitem;

            const errorsList = parseSectionErrors(errors);
            if (sections && isNotEmpty(sections)) {
              Object.keys(sections)
                .forEach((sectionId) => {
                  const sectionData = normalizeSectionData(sections[sectionId]);
                  const sectionErrors = errorsList[sectionId];
                  this.sectionService.isSectionType(this.submissionId, sectionId, SectionsType.Upload)
                    .pipe(take(1))
                    .subscribe((isUpload) => {
                      if (isUpload) {
                        // Look for errors on upload
                        if ((isEmpty(sectionErrors))) {
                          this.notificationsService.success(null, this.translate.get('submission.sections.upload.upload-successful'));
                        } else {
                          this.notificationsService.error(null, this.translate.get('submission.sections.upload.upload-failed'));
                        }
                      }
                    });
                  this.sectionService.updateSectionData(this.submissionId, sectionId, sectionData, sectionErrors, sectionErrors);
                });
            }

          }
        }),
    );
  }

  /**
   * Show error notification on upload fails
   */
  public onUploadError() {
    this.notificationsService.error(null, this.translate.get('submission.sections.upload.upload-failed'));
  }

  /**
   * Unsubscribe from all subscriptions
   */
  ngOnDestroy() {
    this.subs
      .filter((subscription) => hasValue(subscription))
      .forEach((subscription) => subscription.unsubscribe());
  }
}
