import { Component, Input } from "@angular/core";
import { Item } from "@dspace/core/shared/item.model";
import { hasValue } from "@dspace/shared/utils/empty.util";
import { TranslateModule } from "@ngx-translate/core";

@Component({
    selector: 'ds-base-vital-event-type-badge',
    templateUrl: './vital-event-type-badge.component.html',
    styleUrls: ['./vital-event-type-badge.component.scss'],
    standalone: true,
    imports: [TranslateModule],
})
export class VitalEventTypeBadgeComponent {
    @Input() object: Item;

    /**  
     * Returns the CRVS event type metadata value if available  
     */
    get eventType(): string {
        if (hasValue(this.object) && this.object.hasMetadata('crvs.vital.eventType')) {
            return this.object.firstMetadataValue('crvs.vital.eventType');
        }
        return null;
    }

    /**  
     * Whether to show the badge  
     */
    get showBadge(): boolean {
        return hasValue(this.eventType);
    }
}