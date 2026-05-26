import { Component, Input } from "@angular/core";
import { Context } from "@dspace/core/shared/context.model";
import { DSpaceObject } from "@dspace/core/shared/dspace-object.model";

import { MyDSpaceStatusBadgeComponent } from "./my-dspace-status-badge.component";
import { ThemedComponent } from "src/app/shared/theme-support/themed.component";

/**
 * Themed wrapper for MyDSpaceStatusBadge
 */
@Component({
	selector: "ds-my-dspace-status-badge",
	templateUrl: "../../../../../../../../app/shared/theme-support/themed.component.html",
})
export class ThemedMyDSpaceStatusBadgeComponent extends ThemedComponent<MyDSpaceStatusBadgeComponent> {
	@Input() context: Context;

	@Input() object: DSpaceObject;

	protected inAndOutputNames: (keyof MyDSpaceStatusBadgeComponent &
		keyof this)[] = ["context", "object"];

	protected getComponentName(): string {
		return "MyDSpaceStatusBadgeComponent";
	}

	protected importThemedComponent(themeName: string): Promise<any> {
		return import(`./my-dspace-status-badge.component`);
	}

	protected importUnthemedComponent(): Promise<any> {
		return import(`./my-dspace-status-badge.component`);
	}
}
