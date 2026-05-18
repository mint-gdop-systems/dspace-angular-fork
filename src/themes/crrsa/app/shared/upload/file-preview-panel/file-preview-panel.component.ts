import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ThemedFileDownloadLinkComponent } from 'src/app/shared/file-download-link/themed-file-download-link.component';
import { Bitstream } from '@dspace/core/shared/bitstream.model';

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

    // Image manipulation state
    public zoomLevel: number = 1;
    public rotationAngle: number = 0;

    constructor(
        private http: HttpClient,
        private sanitizer: DomSanitizer
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
        this.cleanup();
        this.resetImageState();

        if (this.isPdf(this.selectedFile) || this.isImage(this.selectedFile)) {
            const url = this.getDownloadUrl(this.selectedFile);
            if (url) {
                this.http.get(url, { responseType: 'blob' }).subscribe({
                    next: (blob) => {
                        this.objectUrl = URL.createObjectURL(blob);
                        if (this.isPdf(this.selectedFile)) {
                            this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl);
                            this.imageUrl = null;
                        } else {
                            this.imageUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl);
                            this.pdfUrl = null;
                        }
                    },
                    error: (err) => {
                        console.error('FilePreviewPanelComponent: Error fetching blob', err);
                        this.pdfUrl = null;
                        this.imageUrl = null;
                    }
                });
            }
        } else {
            this.pdfUrl = null;
            this.imageUrl = null;
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
        this.cleanup();
    }

    onFileChange(event: any) {
        const file = this.fileList.find(f => f.uuid === event.target.value);
        this.fileSelected.emit(file);
    }

    isPdf(file: any): boolean {
        console.log('FilePreviewPanelComponent: Checking isPdf for', file);
        if (!file) return false;

        const mimetype = file?.format?.mimetype ||
            file?.metadata?.['dc.format']?.[0]?.value ||
            file?.metadata?.['dc.format.mimetype']?.[0]?.value;

        const isPdf = mimetype === 'application/pdf' ||
            this.getFileName(file).toLowerCase().endsWith('.pdf');

        console.log('FilePreviewPanelComponent: detected mimetype:', mimetype);
        console.log('FilePreviewPanelComponent: isPdf result', isPdf);
        return isPdf;
    }

    getDownloadUrl(file: any): string {
        console.log('FilePreviewPanelComponent: getDownloadUrl for', file);
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
}
