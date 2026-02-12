import {
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';


import { SubmissionUploadFilesComponent } from './submission-upload-files.component';
import { ThemedComponent } from 'src/app/shared/theme-support/themed.component';
import { UploaderOptions } from 'src/app/shared/upload/uploader/uploader-options.model';

/**
 * Themed wrapper for {@link SubmissionUploadFilesComponent}
 */
@Component({
  selector: 'ds-submission-upload-files',
  templateUrl: '../../../../../../app/shared/theme-support/themed.component.html',
  standalone: true,
})
export class ThemedSubmissionUploadFilesComponent extends ThemedComponent<SubmissionUploadFilesComponent> {

  @Input() collectionId: string;

  @Input() submissionId: string;

  @Input() uploadFilesOptions: UploaderOptions;

  @Output() fileSelect: EventEmitter<File> = new EventEmitter<File>();

  protected inAndOutputNames: (keyof SubmissionUploadFilesComponent & keyof this)[] = [
    'collectionId',
    'submissionId',
    'uploadFilesOptions',
  ];

  protected getComponentName(): string {
    return 'SubmissionUploadFilesComponent';
  }

  protected importThemedComponent(themeName: string): Promise<any> {
    return import(`../../../../themes/${themeName}/app/submission/form/submission-upload-files/submission-upload-files.component.ts`);
  }

  protected importUnthemedComponent(): Promise<any> {
    return import('./submission-upload-files.component');
  }
}
