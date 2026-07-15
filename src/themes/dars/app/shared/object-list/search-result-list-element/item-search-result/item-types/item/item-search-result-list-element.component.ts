import { AsyncPipe, NgClass } from "@angular/common";
import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { ItemSearchResult } from "src/app/core/shared/object-collection/item-search-result.model";
import { ViewMode } from "src/app/core/shared/view-mode.model";
import { ThemedBadgesComponent } from "src/app/shared/object-collection/shared/badges/themed-badges.component";
import { listableObjectComponent } from "src/app/shared/object-collection/shared/listable-object/listable-object.decorator";
import { ItemSearchResultListElementComponent as BaseComponent } from "src/app/shared/object-list/search-result-list-element/item-search-result/item-types/item/item-search-result-list-element.component";
import { TruncatableComponent } from "src/app/shared/truncatable/truncatable.component";
import { TruncatablePartComponent } from "src/app/shared/truncatable/truncatable-part/truncatable-part.component";
import { ThemedThumbnailComponent } from "src/app/thumbnail/themed-thumbnail.component";

@listableObjectComponent("PublicationSearchResult", ViewMode.ListElement)
@listableObjectComponent(ItemSearchResult, ViewMode.ListElement)
@Component({
	selector: "ds-item-search-result-list-element",
	styleUrls: ["./item-search-result-list-element.component.scss"],
	templateUrl: "./item-search-result-list-element.component.html",
	imports: [
		AsyncPipe,
		NgClass,
		RouterLink,
		TranslateModule,
		ThemedBadgesComponent,
		ThemedThumbnailComponent,
		TruncatableComponent,
		TruncatablePartComponent,
	],
})
export class ItemSearchResultListElementComponent extends BaseComponent {
	/**
	 * Returns the rejection reason if the item was rejected.
	 */
	get rejectionReason(): string {
		const provenance = this.dso?.findMetadataSortedByPlace(
			"dc.description.provenance",
		);
		if (provenance && provenance.length > 0) {
			const latestEntry = provenance[provenance.length - 1].value;
			if (latestEntry.toLowerCase().includes("rejected by")) {
				const reasonMatch = latestEntry.match(
					/reason:\s*(.*?)(?:\s+on\s+\d{4}-|$)/i,
				);
				if (reasonMatch?.[1]) {
					return reasonMatch[1].trim();
				}
			}
		}
		return null;
	}
}
