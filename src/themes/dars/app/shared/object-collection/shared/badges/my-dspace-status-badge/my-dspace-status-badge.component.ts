import { Component, type OnInit } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { MyDSpaceStatusBadgeComponent as BaseComponent } from "../../../../../../../../app/shared/object-collection/shared/badges/my-dspace-status-badge/my-dspace-status-badge.component";

@Component({
	selector: "ds-my-dspace-status-badge",
	styleUrls: [
		"../../../../../../../../app/shared/object-collection/shared/badges/my-dspace-status-badge/my-dspace-status-badge.component.scss",
	],
	templateUrl: "./my-dspace-status-badge.component.html",
	standalone: true,
	imports: [TranslateModule],
})
export class MyDSpaceStatusBadgeComponent
	extends BaseComponent
	implements OnInit
{
	ngOnInit() {
		super.ngOnInit();
		const provenance = this.object?.findMetadataSortedByPlace(
			"dc.description.provenance",
		);
		if (provenance && provenance.length > 0) {
			const latestEntry = provenance[provenance.length - 1].value;
			if (latestEntry.toLowerCase().includes("rejected by")) {
				this.badgeContent = "rejected";
				this.badgeClass = "text-light badge bg-danger";
			}
		}
	}
}
