import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { AdminDashboardPageComponent } from 'src/themes/dars/app/admin/admin-dashboard-page/admin-dashboard-page.componentt';
import { SearchService } from 'src/app/shared/search/search.service';
// import { BitstreamDataService } from '@dspace/core/data/bitstream-data.service';
import { WorkspaceitemDataService } from '@dspace/core/submission/workspaceitem-data.service';
import { PoolTaskDataService } from '@dspace/core/tasks/pool-task-data.service';
import { ClaimedTaskDataService } from '@dspace/core/tasks/claimed-task-data.service';
import { CollectionDataService } from '@dspace/core/data/collection-data.service';
import { HALEndpointService } from '@dspace/core/shared/hal-endpoint.service';

describe('AdminDashboardPageComponent', () => {
  let component: AdminDashboardPageComponent;
  let fixture: ComponentFixture<AdminDashboardPageComponent>;

  const mockSearchService = jasmine.createSpyObj('SearchService', [
    'search',
    'getFacetValuesFor',
  ]);
  // const mockBitstreamDataService = jasmine.createSpyObj('BitstreamDataService', ['findListByHref']);
  const mockWorkspaceitemDataService = jasmine.createSpyObj(
    'WorkspaceitemDataService',
    ['findListByHref'],
  );
  const mockPoolTaskDataService = jasmine.createSpyObj('PoolTaskDataService', [
    'findListByHref',
  ]);
  const mockClaimedTaskDataService = jasmine.createSpyObj(
    'ClaimedTaskDataService',
    ['findListByHref'],
  );
  const mockCollectionDataService = jasmine.createSpyObj(
    'CollectionDataService',
    ['findAll'],
  );
  const mockHalService = jasmine.createSpyObj('HALEndpointService', [
    'getEndpoint',
  ]);

  beforeEach(async () => {
    mockSearchService.search.and.returnValue(
      of({ hasSucceeded: true, payload: { totalElements: 10 } }),
    );
    mockSearchService.getFacetValuesFor.and.returnValue(
      of({ hasSucceeded: true, payload: { page: [] } }),
    );
    // mockBitstreamDataService.findListByHref.and.returnValue(of({ hasSucceeded: true, payload: { totalElements: 20 } }));
    mockWorkspaceitemDataService.findListByHref.and.returnValue(
      of({ hasSucceeded: true, payload: { totalElements: 5 } }),
    );
    mockPoolTaskDataService.findListByHref.and.returnValue(
      of({ hasSucceeded: true, payload: { page: [] } }),
    );
    mockClaimedTaskDataService.findListByHref.and.returnValue(
      of({ hasSucceeded: true, payload: { page: [] } }),
    );
    mockHalService.getEndpoint.and.returnValue(of('http://mock-endpoint'));

    await TestBed.configureTestingModule({
      imports: [AdminDashboardPageComponent, TranslateModule.forRoot()],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
        // { provide: BitstreamDataService, useValue: mockBitstreamDataService },
        {
          provide: WorkspaceitemDataService,
          useValue: mockWorkspaceitemDataService,
        },
        { provide: PoolTaskDataService, useValue: mockPoolTaskDataService },
        {
          provide: ClaimedTaskDataService,
          useValue: mockClaimedTaskDataService,
        },
        { provide: CollectionDataService, useValue: mockCollectionDataService },
        { provide: HALEndpointService, useValue: mockHalService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call refresh on init', () => {
    spyOn(component, 'refresh').and.callThrough();
    component.ngOnInit();
    expect(component.refresh).toHaveBeenCalled();
  });
});
