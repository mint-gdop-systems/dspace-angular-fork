import { Component, Input } from '@angular/core';
import { ThemedComponent } from 'src/app/shared/theme-support/themed.component';
import { VitalEventTypeBadgeComponent } from './vital-event-type-badge.component';
import { Context } from "@dspace/core/shared/context.model";
import { DSpaceObject } from '@dspace/core/shared/dspace-object.model';

@Component({
  selector: 'ds-vital-event-type-badge',
  styleUrls: [],
  templateUrl: '../../../../../../../../app/shared/theme-support/themed.component.html',
  standalone: true,
  imports: [],
})
export class ThemedVitalEventTypeBadgeComponent extends ThemedComponent<VitalEventTypeBadgeComponent> {
  @Input() context: Context;

  @Input() object: DSpaceObject;

  protected inAndOutputNames: (keyof VitalEventTypeBadgeComponent & keyof this)[] = ['object'];

  protected getComponentName(): string {
    return 'VitalEventTypeBadgeComponent';
  }

  protected importThemedComponent(themeName: string): Promise<any> {
    return import('./vital-event-type-badge.component');
  }

  protected importUnthemedComponent(): Promise<any> {
    return import("./vital-event-type-badge.component")
  }
}
