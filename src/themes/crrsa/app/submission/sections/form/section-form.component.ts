import {
  ChangeDetectorRef,
  Component,
  Inject,
} from '@angular/core';
import { ObjectCacheService } from '@dspace/core/cache/object-cache.service';
import { ConfigObject } from '@dspace/core/config/models/config.model';
import { SubmissionFormsModel } from '@dspace/core/config/models/config-submission-forms.model';
import { SubmissionFormsConfigDataService } from '@dspace/core/config/submission-forms-config-data.service';
import { RemoteData } from '@dspace/core/data/remote-data';
import { RequestService } from '@dspace/core/data/request.service';
import { JsonPatchOperationPathCombiner } from '@dspace/core/json-patch/builder/json-patch-operation-path-combiner';
import { NotificationsService } from '@dspace/core/notification-system/notifications.service';
import { followLink } from '@dspace/core/shared/follow-link-config.model';
import {
  getFirstSucceededRemoteData,
  getRemoteDataPayload,
} from '@dspace/core/shared/operators';
import { SubmissionObject } from '@dspace/core/submission/models/submission-object.model';
import { WorkspaceitemSectionFormObject } from '@dspace/core/submission/models/workspaceitem-section-form.model';
import { WorkspaceitemSectionDataType } from '@dspace/core/submission/models/workspaceitem-sections.model';
import { SectionsType } from '@dspace/core/submission/sections-type';
import {
  isEmpty,
  isNotEmpty,
  isUndefined,
} from '@dspace/shared/utils/empty.util';
import { DynamicFormControlEvent } from '@ng-dynamic-forms/core';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest as observableCombineLatest } from 'rxjs';
import {
  map,
  mergeMap,
  take,
  tap,
} from 'rxjs/operators';
import { FormBuilderService } from 'src/app/shared/form/builder/form-builder.service';
import { FormComponent } from 'src/app/shared/form/form.component';
import { FormService } from 'src/app/shared/form/form.service';
import { ThemedLoadingComponent } from 'src/app/shared/loading/themed-loading.component';
import { SubmissionSectionFormComponent as BaseSubmissionSectionFormComponent } from 'src/app/submission/sections/form/section-form.component';
import { SectionFormOperationsService } from 'src/app/submission/sections/form/section-form-operations.service';
import { SectionDataObject } from 'src/app/submission/sections/models/section-data.model';
import { renderSectionFor } from 'src/app/submission/sections/sections-decorator';
import { SubmissionObjectService } from 'src/app/submission/submission-object.service';
import { SubmissionService } from 'src/app/submission/submission.service';
import { CrrsaSectionsService } from 'src/themes/crrsa/app/submission/sections/sections.service';

/**
 * CRRSA submission form section with vital-event dependent section visibility.
 */
@renderSectionFor(SectionsType.SubmissionForm)
@Component({
  selector: 'ds-submission-section-form',
  styleUrls: ['./section-form.component.scss'],
  templateUrl: './section-form.component.html',
  imports: [
    FormComponent,
    ThemedLoadingComponent,
  ],
  providers: [
    CrrsaSectionsService,
  ],
})
export class SubmissionSectionFormComponent extends BaseSubmissionSectionFormComponent {

  private static readonly VITAL_EVENT_TYPE_METADATA = 'crvs.vital.eventType';

  private static readonly VITAL_EVENT_SECTION_IDS = ['birth', 'marriageAndDivorce', 'death'];

  private static readonly VITAL_EVENT_TYPE_SECTION_MAP: { [eventType: string]: string } = {
    Birth: 'birth',
    'Marriage / Divorce': 'marriageAndDivorce',
    Death: 'death',
  };

  constructor(protected cdr: ChangeDetectorRef,
              protected formBuilderService: FormBuilderService,
              protected formOperationsService: SectionFormOperationsService,
              protected formService: FormService,
              protected formConfigService: SubmissionFormsConfigDataService,
              protected notificationsService: NotificationsService,
              protected crrsaSectionService: CrrsaSectionsService,
              protected submissionService: SubmissionService,
              protected translate: TranslateService,
              protected submissionObjectService: SubmissionObjectService,
              protected objectCache: ObjectCacheService,
              protected requestService: RequestService,
              @Inject('collectionIdProvider') public injectedCollectionId: string,
              @Inject('sectionDataProvider') public injectedSectionData: SectionDataObject,
              @Inject('submissionIdProvider') public injectedSubmissionId: string) {
    super(
      cdr,
      formBuilderService,
      formOperationsService,
      formService,
      formConfigService,
      notificationsService,
      crrsaSectionService,
      submissionService,
      translate,
      submissionObjectService,
      objectCache,
      requestService,
      injectedCollectionId,
      injectedSectionData,
      injectedSubmissionId,
    );
  }

  /**
   * Initialize all instance variables and retrieve form configuration.
   */
  override onSectionInit() {
    this.pathCombiner = new JsonPatchOperationPathCombiner('sections', this.sectionData.id);
    this.formId = this.formService.getUniqueId(this.sectionData.id);
    this.crrsaSectionService.dispatchSetSectionFormId(this.submissionId, this.sectionData.id, this.formId);
    if (this.sectionData.id === 'vitalEventType') {
      this.handleVitalEventTypeChange(null);
    }
    this.formConfigService.findByHref(this.sectionData.config).pipe(
      map((configData: RemoteData<ConfigObject>) => configData.payload as SubmissionFormsModel),
      tap((config: SubmissionFormsModel) => this.formConfig = config),
      mergeMap(() =>
        observableCombineLatest([
          this.crrsaSectionService.getSectionData(this.submissionId, this.sectionData.id, this.sectionData.sectionType),
          this.submissionObjectService.findById(this.submissionId, true, false, followLink('item')).pipe(
            getFirstSucceededRemoteData(),
            getRemoteDataPayload()),
          this.crrsaSectionService.isSectionReadOnly(this.submissionId, this.sectionData.id, this.submissionService.getSubmissionScope()),
        ])),
      take(1))
      .subscribe(([sectionData, submissionObject, isSectionReadOnly]: [WorkspaceitemSectionDataType, SubmissionObject, boolean]) => {
        if (isUndefined(this.formModel)) {
          this.submissionObject = submissionObject;
          this.isSectionReadonly = isSectionReadOnly;
          this.initForm(sectionData as WorkspaceitemSectionFormObject, this.sectionData.errorsToShow, this.sectionData.serverValidationErrors);
          this.sectionData.data = sectionData;
          this.subscriptions();
          this.isLoading = false;
          this.cdr.detectChanges();

          if (this.sectionData.id === 'vitalEventType') {
            this.handleVitalEventTypeChange(this.getStoredVitalEventType(sectionData));
          }
        }
      });
  }

  /**
   * Method called when a form dfChange event is fired.
   *
   * @param event
   *    the [[DynamicFormControlEvent]] emitted
   */
  override onChange(event: DynamicFormControlEvent): void {
    super.onChange(event);

    const metadata = this.formOperationsService.getFieldPathSegmentedFromChangeEvent(event);
    if (metadata === SubmissionSectionFormComponent.VITAL_EVENT_TYPE_METADATA) {
      this.handleVitalEventTypeChange(this.formOperationsService.getFieldValueFromChangeEvent(event));
    }
  }

  private handleVitalEventTypeChange(selectedValue: any): void {
    const selectedEventType = this.getVitalEventTypeValue(selectedValue);

    if (isEmpty(selectedEventType)) {
      SubmissionSectionFormComponent.VITAL_EVENT_SECTION_IDS.forEach((sectionId) => {
        this.crrsaSectionService.disableSection(this.submissionId, sectionId);
      });
      return;
    }

    SubmissionSectionFormComponent.VITAL_EVENT_SECTION_IDS.forEach((sectionId) => {
      this.crrsaSectionService.disableSection(this.submissionId, sectionId);
    });

    const sectionToEnable = SubmissionSectionFormComponent.VITAL_EVENT_TYPE_SECTION_MAP[selectedEventType];
    if (sectionToEnable) {
      this.crrsaSectionService.enableSection(this.submissionId, sectionToEnable);
    }
  }

  private getStoredVitalEventType(sectionData: WorkspaceitemSectionDataType): any {
    const storedValues = sectionData?.[SubmissionSectionFormComponent.VITAL_EVENT_TYPE_METADATA];
    return Array.isArray(storedValues) ? storedValues[0] : storedValues;
  }

  private getVitalEventTypeValue(selectedValue: any): string {
    if (Array.isArray(selectedValue)) {
      return this.getVitalEventTypeValue(selectedValue[0]);
    }

    if (typeof selectedValue === 'string') {
      return selectedValue.trim();
    }

    if (isNotEmpty(selectedValue?.value)) {
      return selectedValue.value.toString().trim();
    }

    if (isNotEmpty(selectedValue?.display)) {
      return selectedValue.display.toString().trim();
    }

    if (isNotEmpty(selectedValue?.label)) {
      return selectedValue.label.toString().trim();
    }

    return null;
  }
}
