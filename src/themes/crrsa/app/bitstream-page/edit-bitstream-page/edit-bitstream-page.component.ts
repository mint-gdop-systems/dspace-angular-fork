import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EditBitstreamPageComponent as BaseComponent } from '../../../../../app/bitstream-page/edit-bitstream-page/edit-bitstream-page.component';
import { Bitstream } from '../../../../../app/core/shared/bitstream.model';
import { Metadata } from '../../../../../app/core/shared/metadata.utils';
import { ErrorComponent } from '../../../../../app/shared/error/error.component';
import { FormComponent } from '../../../../../app/shared/form/form.component';
import { ThemedLoadingComponent } from '../../../../../app/shared/loading/themed-loading.component';
import { FileSizePipe } from '../../../../../app/shared/utils/file-size-pipe';
import { VarDirective } from '../../../../../app/shared/utils/var.directive';
import { ThemedThumbnailComponent } from '../../../../../app/thumbnail/themed-thumbnail.component';
import { DynamicFormGroupModel, DynamicFormService, DynamicSelectModel } from '@ng-dynamic-forms/core';
import { isEmpty } from '@dspace/shared/utils/empty.util';
import { ActivatedRoute, Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { BitstreamDataService } from '../../../../../app/core/data/bitstream-data.service';
import { DSONameService } from '../../../../../app/core/breadcrumbs/dso-name.service';
import { NotificationsService } from '../../../../../app/core/notification-system/notifications.service';
import { BitstreamFormatDataService } from '../../../../../app/core/data/bitstream-format-data.service';
import { PrimaryBitstreamService } from '../../../../../app/core/data/primary-bitstream.service';

@Component({
    selector: 'ds-edit-bitstream-page',
    styleUrls: ['../../../../../app/bitstream-page/edit-bitstream-page/edit-bitstream-page.component.scss'],
    templateUrl: './edit-bitstream-page.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        AsyncPipe,
        ErrorComponent,
        FileSizePipe,
        FormComponent,
        RouterLink,
        ThemedLoadingComponent,
        ThemedThumbnailComponent,
        TranslateModule,
        VarDirective,
    ],
})
export class EditBitstreamPageComponent extends BaseComponent implements OnInit {

    /**
     * The Dynamic Select Model for the document type
     */
    documentTypeModel = new DynamicSelectModel({
        id: 'documentType',
        name: 'documentType',
        options: [
            { label: 'ID Card', value: 'ID Card' },
            { label: 'Birth Certificate', value: 'Birth Certificate' },
            { label: 'Death Certificate', value: 'Death Certificate' },
            { label: 'Marriage Certificate', value: 'Marriage Certificate' },
            { label: 'Divorce Certificate', value: 'Divorce Certificate' },
            { label: 'Not-married Certificate', value: 'Not-married Certificate' },
            { label: 'Adoption Decree', value: 'Adoption Decree' },
            { label: 'Supporting Document', value: 'Supporting Document' },
            { label: 'Other', value: 'Other' },
        ],
    });

    /**
     * The Dynamic Select Model for the document status
     */
    documentStatusModel = new DynamicSelectModel({
        id: 'documentStatus',
        name: 'documentStatus',
        options: [
            { label: 'Active', value: 'Active' },
            { label: 'Inactive', value: 'Inactive' }
        ],
    });

    constructor(
        route: ActivatedRoute,
        router: Router,
        changeDetectorRef: ChangeDetectorRef,
        formService: DynamicFormService,
        translate: TranslateService,
        bitstreamService: BitstreamDataService,
        dsoNameService: DSONameService,
        notificationsService: NotificationsService,
        bitstreamFormatService: BitstreamFormatDataService,
        primaryBitstreamService: PrimaryBitstreamService,
    ) {
        super(
            route,
            router,
            changeDetectorRef,
            formService,
            translate,
            bitstreamService,
            dsoNameService,
            notificationsService,
            bitstreamFormatService,
            primaryBitstreamService,
        );

        this.formLayout = {
            ...this.formLayout,
            documentType: {
                grid: {
                    host: 'col col-sm-6 d-inline-block',
                },
            },
            documentStatus: {
                grid: {
                    host: 'col col-sm-6 d-inline-block',
                },
            },
            crvsContainer: {
                grid: {
                    host: 'row',
                },
            },
        };
    }

    /**
     * Initialize the component and subscribe to language changes to update select options.
     */
    ngOnInit() {
        super.ngOnInit();
        this.subs.push(
            this.translate.onLangChange.subscribe(() => {
                this.updateSelectOptions();
            })
        );
    }

    /**
     * Overwrite setForm to include new fields below the filename field
     */
    setForm() {
        if (!this.formModel.some(m => m.id === 'crvsContainer')) {
            const crvsContainer = new DynamicFormGroupModel({
                id: 'crvsContainer',
                group: [
                    this.documentTypeModel,
                    this.documentStatusModel,
                ],
            });
            (this.inputModels as any[]).push(this.documentTypeModel, this.documentStatusModel);
            // Insert after the first field (fileNamePrimaryContainer)
            this.formModel.splice(1, 0, crvsContainer);
        }
        super.setForm();
        this.updateSelectOptions();
    }

    /**
     * Updates select options with translated labels
     */
    updateSelectOptions() {
        this.documentTypeModel.options.forEach(option => {
            option.label = this.translate.instant(`${this.KEY_PREFIX}${this.documentTypeModel.id}.options.${option.value}`);
        });
        this.documentStatusModel.options.forEach(option => {
            option.label = this.translate.instant(`${this.KEY_PREFIX}${this.documentStatusModel.id}.options.${option.value}`);
        });
    }

    /**
     * Update the current form values with bitstream properties including CRVS metadata
     * @param bitstream
     */
    updateForm(bitstream: Bitstream) {
        super.updateForm(bitstream);
        this.formGroup.patchValue({
            crvsContainer: {
                documentType: bitstream.firstMetadataValue('crvs.documentType'),
                documentStatus: bitstream.firstMetadataValue('crvs.document.status'),
            },
        });
    }

    /**
     * Parse form data to an updated bitstream object including CRVS metadata
     * @param rawForm   Raw form data
     */
    formToBitstream(rawForm): Bitstream {
        const updatedBitstream = super.formToBitstream(rawForm);
        const newMetadata = updatedBitstream.metadata;

        if (isEmpty(rawForm.crvsContainer.documentType)) {
            delete newMetadata['crvs.documentType'];
        } else {
            Metadata.setFirstValue(newMetadata, 'crvs.documentType', rawForm.crvsContainer.documentType);
        }

        if (isEmpty(rawForm.crvsContainer.documentStatus)) {
            delete newMetadata['crvs.document.status'];
        } else {
            Metadata.setFirstValue(newMetadata, 'crvs.document.status', rawForm.crvsContainer.documentStatus);
        }

        updatedBitstream.metadata = newMetadata;
        return updatedBitstream;
    }
}
