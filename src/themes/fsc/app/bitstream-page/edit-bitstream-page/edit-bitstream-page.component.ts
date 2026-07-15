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
import { DynamicFormGroupModel, DynamicFormService, DynamicSelectModel, DynamicInputModel } from '@ng-dynamic-forms/core';
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
     * Legal Document Type
     */
    documentTypeModel = new DynamicSelectModel({
        id: 'documentType',
        name: 'documentType',
        options: [
            { label: 'judge', value: 'በዳኛ የተሰራ' },
            { label: 'other', value: 'ልዩ ልዩ' },
            { label: 'excution', value: 'በጽ/ቤቱ የተሰራ' },
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
            route, router, changeDetectorRef, formService, translate, 
            bitstreamService, dsoNameService, notificationsService, 
            bitstreamFormatService, primaryBitstreamService,
        );

        this.formLayout = {
            ...this.formLayout,
            documentType: { grid: { host: 'col-12 d-inline-block' } },
            legalContainer: { grid: { host: 'row' } },
        };
    }

    ngOnInit() {
        super.ngOnInit();
        this.subs.push(
            this.translate.onLangChange.subscribe(() => {
                this.updateSelectOptions();
            })
        );
    }

    /**
     * Inject Legal fields into the form model
     */
    setForm() {
        if (!this.formModel.some(m => m.id === 'legalContainer')) {
            const legalContainer = new DynamicFormGroupModel({
                id: 'legalContainer',
                group: [
                    this.documentTypeModel,
                ],
            });
            
            (this.inputModels as any[]).push(
                this.documentTypeModel
            );

            // Insert after filename field
            this.formModel.splice(1, 0, legalContainer);
        }
        super.setForm();
        this.updateSelectOptions();
    }

    updateSelectOptions() {
        [this.documentTypeModel].forEach(model => {
            model.options.forEach(option => {
                option.label = this.translate.instant(`${this.KEY_PREFIX}${model.id}.options.${option.label}`);
            });
        });
    }

    /**
     * Map DSpace Metadata -> Form Values
     */
    updateForm(bitstream: Bitstream) {
        super.updateForm(bitstream);
        this.formGroup.patchValue({
            legalContainer: {
                documentType: bitstream.firstMetadataValue('legal.document.type'),
            },
        });
    }

    /**
     * Map Form Values -> DSpace Metadata
     */
    formToBitstream(rawForm): Bitstream {
        const updatedBitstream = super.formToBitstream(rawForm);
        const newMetadata = updatedBitstream.metadata;
        const container = rawForm.legalContainer;

        const mappings = [
            { field: 'legal.document.type', value: container.documentType }
        ];

        mappings.forEach(m => {
            if (isEmpty(m.value)) {
                delete newMetadata[m.field];
            } else {
                Metadata.setFirstValue(newMetadata, m.field, m.value);
            }
        });

        updatedBitstream.metadata = newMetadata;
        return updatedBitstream;
    }
}