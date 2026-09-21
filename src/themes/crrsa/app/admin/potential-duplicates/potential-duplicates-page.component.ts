import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BehaviorSubject, finalize } from 'rxjs';
import { PotentialDuplicateGroup, PotentialDuplicatesService } from '../../shared/potential-duplicates/potential-duplicates.service';

@Component({
    selector: 'ds-potential-duplicates-page',
    templateUrl: './potential-duplicates-page.component.html',
    standalone: true,
    imports: [CommonModule, RouterModule],
})
export class PotentialDuplicatesPageComponent implements OnInit {
    groups: PotentialDuplicateGroup[] = [];
    loading$ = new BehaviorSubject<boolean>(true);

    constructor(protected potentialDuplicatesService: PotentialDuplicatesService) { }

    ngOnInit(): void {
        this.potentialDuplicatesService.getPotentialDuplicates().pipe(
            finalize(() => this.loading$.next(false)),
        ).subscribe({
            next: (groups: PotentialDuplicateGroup[]) => {
                this.groups = groups;
            },
            error: (err) => console.error('Failed to load potential duplicates', err),
        });
    }

    handleRoute(handle: string): string[] {
        return ['/handle', ...handle.split('/')];
    }
}