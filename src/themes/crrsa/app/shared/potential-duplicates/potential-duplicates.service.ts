import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { APP_CONFIG, AppConfig } from '@dspace/config/app-config.interface';

export interface PotentialDuplicateItem {
    handle: string;
}

export interface PotentialDuplicateGroup {
    signature: string;
    items: PotentialDuplicateItem[];
}

export interface PotentialDuplicatesResource {
    id: string;
    groups: PotentialDuplicateGroup[];
}

export interface PotentialDuplicatesRestResponse {
    _embedded?: {
        potentialDuplicatesResources?: PotentialDuplicatesResource[];
    };
}

@Injectable({
    providedIn: 'root',
})
export class PotentialDuplicatesService {

    constructor(@Inject(APP_CONFIG) protected appConfig: AppConfig, private http: HttpClient) { }

    getPotentialDuplicates(): Observable<PotentialDuplicateGroup[]> {
        const url = `${this.appConfig.rest.baseUrl}/api/statistics/potentialduplicates/search/findPotentialDuplicates`;
        return this.http.get<PotentialDuplicatesRestResponse>(url).pipe(
            map((response) => {
                const resources = response?._embedded?.potentialDuplicatesResources || [];
                // Extract groups from the first resource object ("id": "all")
                return resources[0]?.groups || [];
            })
        );
    }
}