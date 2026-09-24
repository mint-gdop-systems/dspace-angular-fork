/**
 * The contents of this file are subject to the license and copyright
 * detailed in the LICENSE and NOTICE files at the root of the source
 * tree and available online at
 *
 * http://www.dspace.org/license/
 */

import { Injectable } from '@angular/core';
import { AuthorizationDataService } from '@dspace/core/data/feature-authorization/authorization-data.service';
import {
    map,
    Observable
} from 'rxjs';
import { MenuItemType } from '../../../../../../app/shared/menu/menu-item-type.model';
import { AbstractMenuProvider, PartialMenuSection } from '../../../../../../app/shared/menu/menu-provider.model';
import { FeatureID } from '@dspace/core/data/feature-authorization/feature-id';

/**
 * Menu provider to create the "Admin Dashboard" menu section in the public navbar under Statistics.
 */
@Injectable({ providedIn: 'root' })
export class AdminDashboardMenuProvider extends AbstractMenuProvider {

    constructor(
        protected authorizationService: AuthorizationDataService,
    ) {
        super();
    }

    public getSections(): Observable<PartialMenuSection[]> {
        return this.authorizationService.isAuthorized(FeatureID.AdministratorOf).pipe(
            map((isSiteAdmin) => {
                return [
                    {
                        id: 'admin-dashboard',
                        visible: true,
                        model: {
                            type: MenuItemType.LINK,
                            text: 'menu.section.analytics',
                            link: '/statistics/admin-dashboard',
                        },
                        icon: 'chart-bar',
                    },
                    {
                        id: 'potential-duplicated',
                        visible: isSiteAdmin,
                        model: {
                            type: MenuItemType.LINK,
                            text: 'menu.section.potential-duplicates',
                            link: '/admin/potential-duplicates',
                        },
                        icon: 'copy',
                    },
                ];
            }),
        );

    }
}
