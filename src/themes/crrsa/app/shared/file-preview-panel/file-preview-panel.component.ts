import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  NgZone,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
  QueryList,
  ViewChildren,
  Directive,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ThemedFileDownloadLinkComponent } from 'src/app/shared/file-download-link/themed-file-download-link.component';
import { Bitstream } from '@dspace/core/shared/bitstream.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs';

// Directive to trigger canvas rendering once instantiated in DOM
@Directive({
  selector: 'canvas[pdfCanvas]',
  standalone: true
})
export class PdfCanvasDirective implements AfterViewInit {
  @Input() pageNum!: number;
  @Input() renderCallback!: (canvas: HTMLCanvasElement, pageNum: number) => void;

  constructor(private el: ElementRef<HTMLCanvasElement>) {}

  ngAfterViewInit() {
    if (this.renderCallback && this.pageNum) {
      this.renderCallback(this.el.nativeElement, this.pageNum);
    }
  }
}

interface PageSize {
  width: number;
  height: number;
}

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
    PdfCanvasDirective
  ]
})
export class FilePreviewPanelComponent implements OnChanges, OnDestroy {
  @Input() fileList: any[] = [];
  @Input() selectedFile: any;
  @Output() fileSelected = new EventEmitter<any>();

  @ViewChild('pdfContainer') containerRef!: ElementRef<HTMLDivElement>;
  @ViewChildren('pageWrapper') pageElements!: QueryList<ElementRef<HTMLDivElement>>;


  // PDF state matching reference component
  public pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
  public numPages: number = 0;
  public currentPage: number = 1;
  public pdfError: string | null = null;
  public pageSizes: { [pageNumber: number]: PageSize } = {};

  private readonly RENDER_SCALE = 1;
  private pageRefs: { [pageNumber: number]: HTMLDivElement } = {};
  private observer: IntersectionObserver | null = null;
  // Tracks canvas ELEMENTS that have been drawn (a new canvas after
  // re-entering the render window must be drawn again)
  private renderedCanvases = new WeakSet<HTMLCanvasElement>();
  

  // Image state
  public imageUrl: SafeResourceUrl | null = null;
  public zoomLevel: number = 1;
  public rotationAngle: number = 0;

  // General state
  private objectUrl: string | null = null;
  private currentRequestId: string | null = null;
  private destroy$ = new Subject<void>();
  public isLoading: boolean = false;
  private previewRequest$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.renderPageCanvas = this.renderPageCanvas.bind(this);
  }

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
    this.resetPdfState();
    this.resetImageState();
    this.isLoading = true;

    if (this.isPdf(this.selectedFile) || this.isImage(this.selectedFile)) {
      const url = this.getDownloadUrl(this.selectedFile);
      if (url) {
        this.http.get(url, { responseType: 'blob' }).pipe(
          takeUntil(this.destroy$),
          takeUntil(this.previewRequest$)
        ).subscribe({
          next: (blob) => {
            if (this.currentRequestId !== newRequestId) return;

            this.ngZone.run(() => {
              this.objectUrl = URL.createObjectURL(blob);

              if (this.isPdf(this.selectedFile)) {
                this.loadPdfDocument(this.objectUrl);
              } else {
                this.imageUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl);
                this.isLoading = false;
                this.cdr.detectChanges();
              }
            });
          },
          error: (err) => {
            if (this.currentRequestId !== newRequestId) return;
            this.ngZone.run(() => {
              this.pdfError = 'Failed to load PDF.';
              this.isLoading = false;
              this.cdr.detectChanges();
            });
          }
        });
      } else {
        this.isLoading = false;
      }
    } else {
      this.isLoading = false;
    }
  }

  /* =========================================================
     PDF-JS core functionality
     ========================================================= */

  private async loadPdfDocument(url: string) {
    try {
      const loadingTask = pdfjsLib.getDocument({ url });
      const pdf = await loadingTask.promise;

      this.pdfDocument = pdf;
      this.numPages = pdf.numPages;
      this.currentPage = 1;
      this.pageSizes = {};
      this.pdfError = null;
      this.isLoading = false;
      this.cdr.detectChanges();

      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1 });
      this.pageSizes[1] = { width: viewport.width, height: viewport.height };

      this.cdr.detectChanges();
      setTimeout(() => this.setupIntersectionObserver(), 100);
    } catch (err) {
      console.error('PDF Load Error:', err);
      this.pdfError = 'Failed to load PDF.';
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private setupIntersectionObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    if (!this.containerRef?.nativeElement) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        const visiblePages = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visiblePages.length > 0) {
          const pageNumber = Number(visiblePages[0].target.getAttribute('data-page-number'));
          this.ngZone.run(() => {
            this.currentPage = pageNumber;
            this.cdr.detectChanges();
          });
        }
      },
      {
        root: this.containerRef.nativeElement,
        threshold: [0.25, 0.5, 0.75, 1.0]
      }
    );

    this.pageElements.forEach((el) => {
      const native = el.nativeElement;
      const pageNum = Number(native.getAttribute('data-page-number'));
      this.pageRefs[pageNum] = native;
      this.observer?.observe(native);
    });
  }

  public shouldRenderPage(pageNumber: number): boolean {
    return Math.abs(pageNumber - this.currentPage) <= 1;
  }

  public getPageStyle(pageNumber: number) {
    const size = this.pageSizes[pageNumber] || this.pageSizes[1] || { width: 612, height: 792 };
    return {
      width: `${size.width * this.RENDER_SCALE}px`,
      height: `${size.height * this.RENDER_SCALE}px`
    };
  }

  public async renderPageCanvas(canvas: HTMLCanvasElement, pageNumber: number) {
    const doc = this.pdfDocument;
    if (!doc || this.renderedCanvases.has(canvas)) return;
    this.renderedCanvases.add(canvas);

    try {
      const page = await doc.getPage(pageNumber);
      // Document changed / canvas removed while waiting
      if (doc !== this.pdfDocument || !canvas.isConnected) {
        this.renderedCanvases.delete(canvas);
        return;
      }

      const viewport = page.getViewport({ scale: this.RENDER_SCALE });
      const unscaled = page.getViewport({ scale: 1 });
      this.pageSizes[pageNumber] = { width: unscaled.width, height: unscaled.height };

      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvas, canvasContext: context, viewport }).promise;
    } catch (e) {
      this.renderedCanvases.delete(canvas); // allow retry
      console.error(`Error rendering page ${pageNumber}`, e);
    }
  }

  private resetPdfState() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.pdfDocument?.destroy();
    this.pdfDocument = null;
    this.numPages = 0;
    this.currentPage = 1;
    this.pdfError = null;
    this.pageSizes = {};
    this.pageRefs = {};
  }

  /* =========================================================
     Image controls & Helpers
     ========================================================= */

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

    return mimetype.startsWith('image/') ||
      this.getFileName(file).toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) !== null;
  }

  public isPdf(file: any): boolean {
    if (!file) return false;
    const mimetype = file?.format?.mimetype ||
      file?.metadata?.['dc.format']?.[0]?.value ||
      file?.metadata?.['dc.format.mimetype']?.[0]?.value;

    return mimetype === 'application/pdf' ||
      this.getFileName(file).toLowerCase().endsWith('.pdf');
  }

  private cleanup() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    if (this.observer) {
      this.observer.disconnect();
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

  getDownloadUrl(file: any): string {
    return file?._links?.content?.href || file?.url;
  }

  getFileName(file: any): string {
    if (!file) return '';
    const metadata = file.metadata || {};
    return metadata['dc.title']?.[0]?.value ||
      metadata['dc.title']?.[0]?.display ||
      metadata['dc_title']?.[0]?.value ||
      file.uuid;
  }

  getFileSize(file: any): string {
    if (!file || !file.sizeBytes) return 'Unknown';
    const bytes = file.sizeBytes;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  private getMetadataValue(file: any, key: string, defaultValue: string): string {
    if (!file) return defaultValue;
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

  public range(num: number): number[] {
    return Array.from({ length: num }, (_, i) => i + 1);
  }
}