import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { MenuItemType } from 'src/app/shared/menu/menu-item-type.model';
import { PartialMenuSection } from 'src/app/shared/menu/menu-provider.model';
import { AbstractExpandableMenuProvider } from 'src/app/shared/menu/providers/helper-providers/expandable-menu-provider';
import { TextMenuItemModel } from 'src/app/shared/menu/menu-item/models/text.model';
import { LinkMenuItemModel } from 'src/app/shared/menu/menu-item/models/link.model';

/**
 * Custom Menu provider to replace the "All of DSpace" browse menu sections
 * with custom filters for the dars theme.
 */
@Injectable()
export class CustomBrowseMenuProvider extends AbstractExpandableMenuProvider {
  constructor() {
    super();
  }

  getTopSection(): Observable<PartialMenuSection> {
    return of({
      model: {
        type: MenuItemType.TEXT,
        text: 'menu.section.browse_global',
      } as TextMenuItemModel,
      icon: 'globe',
      visible: true,
    });
  }

  /**
   * Hardcode the dropdown subsections to the requested custom search filters
   */
  getSubSections(): Observable<PartialMenuSection[]> {
    return of([
      {
        visible: true,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.browse_global_by_caseStatus',
          link: '/search',
          queryParams: { 'f.caseStatus': '[* TO *],equals' },
        } as LinkMenuItemModel,
      },
      {
        visible: true,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.browse_global_by_fileNumber',
          link: '/search',
          queryParams: { 'f.fileNumber': '[* TO *],equals' },
        } as LinkMenuItemModel,
      },
      {
        visible: true,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.browse_global_by_registrationDate',
          link: '/search',
          queryParams: { 'f.registrationDate': '[* TO *],equals' },
        } as LinkMenuItemModel,
      },
      {
        visible: true,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.browse_global_by_plaintiff',
          link: '/search',
          queryParams: { 'f.plaintiff': '[* TO *],equals' },
        } as LinkMenuItemModel,
      },
      {
        visible: true,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.browse_global_by_defendant',
          link: '/search',
          queryParams: { 'f.defendant': '[* TO *],equals' },
        } as LinkMenuItemModel,
      },
    ]);
  }
}
