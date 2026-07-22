import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, NgZone, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ThemedFileDownloadLinkComponent } from 'src/app/shared/file-download-link/themed-file-download-link.component';
import { Bitstream } from '@dspace/core/shared/bitstream.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
    selector: 'ds-file-preview-panel',
    templateUrl: './file-preview-panel.component.html',
    styleUrls: ['./file-preview-panel.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        ThemedFileDownloadLinkComponent,
        FormsModule,
    ]
})
export class FilePreviewPanelComponent implements OnChanges, OnDestroy {
    @Input() fileList: any[] = [];
    @Input() selectedFile: any;
    @Output() fileSelected = new EventEmitter<any>();

    public pdfUrl: SafeResourceUrl | null = null;
    public imageUrl: SafeResourceUrl | null = null;
    private objectUrl: string | null = null;
    private currentRequestId: string | null = null;
    private destroy$ = new Subject<void>();
    public isLoading: boolean = false;
    private previewRequest$ = new Subject<void>();

    // Image manipulation state
    public zoomLevel: number = 1;
    public rotationAngle: number = 0;

    constructor(
        private http: HttpClient,
        private sanitizer: DomSanitizer,
        private ngZone: NgZone,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.selectedFile && this.selectedFile) {
            this.updatePreview();
        }
    }

    public asBitstream(file: any): Bitstream {
        if (!file) return null;
        if (file instanceof Bitstream) return file;
        return Object.assign(new Bitstream(), file, {
            _links: file._links || { self: { href: file.url } }
        });
    }

    private updatePreview() {
        this.previewRequest$.next();

        const newRequestId = this.selectedFile?.uuid || this.selectedFile?.id;
        if (!newRequestId) return;

        this.currentRequestId = newRequestId;
        this.cleanup();
        this.resetImageState();
        this.isLoading = true;
        this.pdfUrl = null;
        this.imageUrl = null;

        if (this.isPdf(this.selectedFile) || this.isImage(this.selectedFile)) {
            const url = this.getDownloadUrl(this.selectedFile);
            if (url) {
                this.http.get(url, { responseType: 'blob' }).pipe(
                    takeUntil(this.destroy$),
                    takeUntil(this.previewRequest$)
                ).subscribe({
                    next: (blob) => {
                        if (this.currentRequestId !== newRequestId) {
                            return;
                        }
                        this.ngZone.run(() => {
                            this.objectUrl = URL.createObjectURL(blob);

                            if (this.isPdf(this.selectedFile)) {
                                this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl);
                                this.imageUrl = null;
                            } else {
                                this.imageUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl);
                                this.pdfUrl = null;
                            }

                            this.isLoading = false;

                            this.cdr.detectChanges();
                        });
                    },
                    error: (err) => {
                        if (this.currentRequestId !== newRequestId) {
                            return;
                        }
                        this.ngZone.run(() => {
                            this.pdfUrl = null;
                            this.imageUrl = null;
                            this.isLoading = false;

                            this.cdr.detectChanges();
                        });
                    }
                });
            } else {
                this.isLoading = false;
            }
        } else {
            this.pdfUrl = null;
            this.imageUrl = null;
            this.isLoading = false;
        }
    }

    private resetImageState() {
        this.zoomLevel = 1;
        this.rotationAngle = 0;
    }

    public zoomIn() {
        this.zoomLevel += 0.2;
    }

    public zoomOut() {
        this.zoomLevel = Math.max(0.2, this.zoomLevel - 0.2);
    }

    public rotate() {
        this.rotationAngle = (this.rotationAngle + 90) % 360;
    }

    public isImage(file: any): boolean {
        if (!file) return false;

        const mimetype = file?.format?.mimetype ||
            file?.metadata?.['dc.format']?.[0]?.value ||
            file?.metadata?.['dc.format.mimetype']?.[0]?.value || '';

        const isImg = mimetype.startsWith('image/') ||
            this.getFileName(file).toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) !== null;

        return isImg;
    }

    private cleanup() {
        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
            this.objectUrl = null;
        }
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.cleanup();
    }

    onFileChange(event: any) {
        const file = this.fileList.find(f => f.uuid === event.target.value);
        this.fileSelected.emit(file);
    }

    isPdf(file: any): boolean {
        if (!file) return false;

        const mimetype = file?.format?.mimetype ||
            file?.metadata?.['dc.format']?.[0]?.value ||
            file?.metadata?.['dc.format.mimetype']?.[0]?.value;

        const isPdf = mimetype === 'application/pdf' ||
            this.getFileName(file).toLowerCase().endsWith('.pdf');

        return isPdf;
    }

    getDownloadUrl(file: any): string {
        // Priority: content link in _links, then url property
        return file?._links?.content?.href || file?.url;
    }

    getFileName(file: any): string {
        if (!file) {
            return '';
        }
        // Try various common metadata keys for filename
        const metadata = file.metadata || {};
        return metadata['dc.title']?.[0]?.value ||
            metadata['dc.title']?.[0]?.display ||
            metadata['dc_title']?.[0]?.value ||
            file.uuid;
    }

    getFileSize(file: any): string {
        if (!file || !file.sizeBytes) {
            return 'Unknown';
        }
        const bytes = file.sizeBytes;
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }

    private getMetadataValue(file: any, key: string, defaultValue: string): string {
        if (!file) {
            return defaultValue;
        }

        if (typeof file.firstMetadataValue === 'function') {
            return file.firstMetadataValue(key) || defaultValue;
        }

        return file.metadata?.[key]?.[0]?.value || defaultValue;
    }

    getDocumentType(file: any): string {
        return this.getMetadataValue(file, 'crvs.documentType', 'Unknown');
    }

    getDocumentStatus(file: any): string {
        return this.getMetadataValue(file, 'crvs.document.status', 'Active');
    }

    getPageCount(file: any): string {
        return this.getMetadataValue(file, 'crvs.document.pages', '1');
    }
}
