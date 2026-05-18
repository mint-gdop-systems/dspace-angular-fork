import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {
  APP_CONFIG,
  AppConfig,
} from '@dspace/config/app-config.interface';
import { DSONameService } from '@dspace/core/breadcrumbs/dso-name.service';
import { BitstreamDataService } from '@dspace/core/data/bitstream-data.service';
import { PaginatedList } from '@dspace/core/data/paginated-list.model';
import { RemoteData } from '@dspace/core/data/remote-data';
import { NotificationsService } from '@dspace/core/notification-system/notifications.service';
import { Bitstream } from '@dspace/core/shared/bitstream.model';
import { followLink } from '@dspace/core/shared/follow-link-config.model';
import { Item } from '@dspace/core/shared/item.model';
import { getFirstCompletedRemoteData } from '@dspace/core/shared/operators';
import { hasValue } from '@dspace/shared/utils/empty.util';
import {
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ThemedLoadingComponent } from 'src/app/shared/loading/themed-loading.component';
import { MetadataFieldWrapperComponent } from 'src/app/shared/metadata-field-wrapper/metadata-field-wrapper.component';
import { FileSizePipe } from 'src/app/shared/utils/file-size-pipe';
import { VarDirective } from 'src/app/shared/utils/var.directive';
import { FilePreviewPanelComponent } from 'src/themes/crrsa/app/shared/file-preview-panel/file-preview-panel.component';

/**
 * This component renders the file section of the item
 * inside a 'ds-metadata-field-wrapper' component.
 */
@Component({
  selector: 'ds-base-item-page-file-section',
  templateUrl: './file-section.component.html',
  imports: [
    CommonModule,
    FileSizePipe,
    MetadataFieldWrapperComponent,
    ThemedLoadingComponent,
    TranslateModule,
    VarDirective,
    FilePreviewPanelComponent,
  ],
})
export class FileSectionComponent implements OnInit {

  @Input() item: Item;

  label = 'item.page.files';



  bitstreams$: BehaviorSubject<Bitstream[]>;

  groupedBitstreams$: Observable<BitstreamGroup[]>;

  currentPage: number;

  isLoading: boolean;

  isLastPage: boolean;

  pageSize: number;

  primaryBitstreamId: string;

  selectedFile: Bitstream | null = null;

  allFiles: Bitstream[] = [];

  @Output() fileSelected = new EventEmitter<Bitstream | null>();

  constructor(
    protected bitstreamDataService: BitstreamDataService,
    protected notificationsService: NotificationsService,
    protected translateService: TranslateService,
    public dsoNameService: DSONameService,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
  ) {
    this.pageSize = this.appConfig.item.bitstream.pageSize;
  }

  ngOnInit(): void {
    this.getPrimaryBitstreamId();
    this.bitstreams$ = new BehaviorSubject([]);
    this.groupedBitstreams$ = this.bitstreams$.pipe(
      map((bitstreams) => {
        if (!bitstreams) {
          return [];
        }
        const groups = new Map<string, Bitstream[]>();
        bitstreams.forEach((bitstream) => {
          const type = bitstream.firstMetadataValue('crvs.documentType') || 'Other';
          if (!groups.has(type)) {
            groups.set(type, []);
          }
          groups.get(type).push(bitstream);
        });
        return Array.from(groups.entries()).map(([name, bitstreams]) => ({ name, bitstreams }));
      })
    );
    this.getNextPage();
  }

  private getPrimaryBitstreamId() {
    this.bitstreamDataService.findPrimaryBitstreamByItemAndName(this.item, 'ORIGINAL', true, true).subscribe((primaryBitstream: Bitstream | null) => {
      if (!primaryBitstream) {
        return;
      }
      this.primaryBitstreamId = primaryBitstream?.id;
    });
  }

  /**
   * This method will retrieve the next page of Bitstreams from the external BitstreamDataService call.
   * It'll retrieve the currentPage from the class variables and it'll add the next page of bitstreams with the
   * already existing one.
   * If the currentPage variable is undefined, we'll set it to 1 and retrieve the first page of Bitstreams
   */
  getNextPage(): void {
    this.isLoading = true;
    if (this.currentPage === undefined) {
      this.currentPage = 1;
      this.bitstreams$.next([]);
    } else {
      this.currentPage++;
    }
    this.bitstreamDataService.findAllByItemAndBundleName(this.item, 'ORIGINAL', {
      currentPage: this.currentPage,
      elementsPerPage: this.pageSize,
    }, true, true, followLink('accessStatus')).pipe(
      getFirstCompletedRemoteData(),
    ).subscribe((bitstreamsRD: RemoteData<PaginatedList<Bitstream>>) => {
      if (bitstreamsRD.errorMessage) {
        this.notificationsService.error(this.translateService.get('file-section.error.header'), `${bitstreamsRD.statusCode} ${bitstreamsRD.errorMessage}`);
      } else if (hasValue(bitstreamsRD.payload)) {
        const current: Bitstream[] = this.bitstreams$.getValue();
        this.bitstreams$.next([...current, ...bitstreamsRD.payload.page]);
        this.allFiles = [...this.allFiles, ...bitstreamsRD.payload.page];
        if (!this.selectedFile && this.allFiles.length > 0) {
          this.selectedFile = this.allFiles[0];
          this.fileSelected.emit(this.selectedFile);
        }
        this.isLoading = false;
        this.isLastPage = this.currentPage === bitstreamsRD.payload.totalPages;
      }
    });
  }

  onFileSelected(file: Bitstream): void {
    this.selectedFile = file;
    this.fileSelected.emit(this.selectedFile);
  }
}

interface BitstreamGroup {
  name: string;
  bitstreams: Bitstream[];
}
