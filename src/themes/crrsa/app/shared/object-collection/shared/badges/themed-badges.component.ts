import {
  Component,
  Input,
} from '@angular/core';
import { Context } from '@dspace/core/shared/context.model';
import { DSpaceObject } from '@dspace/core/shared/dspace-object.model';

import { BadgesComponent } from './badges.component';
import { ThemedComponent } from 'src/app/shared/theme-support/themed.component';

/**
 * Themed wrapper for BadgesComponent
 */
@Component({
  selector: 'ds-badges',
  templateUrl: '../../../../../../../app/shared/theme-support/themed.component.html',
})
export class ThemedBadgesComponent extends ThemedComponent<BadgesComponent> {
  @Input() object: DSpaceObject;
  @Input() context: Context;
  @Input() showAccessStatus: boolean;

  protected inAndOutputNames: (keyof BadgesComponent & keyof this)[] = ['object', 'context', 'showAccessStatus'];

  protected getComponentName(): string {
    return 'BadgesComponent';
  }

  protected importThemedComponent(themeName: string): Promise<any> {
    return import(`../../../../../themes/${themeName}/app/shared/object-collection/shared/badges/badges.component`);
  }

  protected importUnthemedComponent(): Promise<any> {
    return import(`./badges.component`);
  }
}
