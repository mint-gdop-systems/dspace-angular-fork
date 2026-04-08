import { Injectable } from '@angular/core';
import {
  hasValue,
  isEmpty,
  isNotEmpty
} from '@dspace/shared/utils/empty.util';
import { TranslateService } from '@ngx-translate/core';

import { DSpaceObject } from '../shared/dspace-object.model';
import { Metadata } from '../shared/metadata.utils';

/**
 * Returns a name for a {@link DSpaceObject} based
 * on its render types.
 */
@Injectable({
  providedIn: 'root',
})
export class DSONameService {

  constructor(private translateService: TranslateService) {

  }

  /**
   * Functions to generate the specific names.
   *
   * If this list ever expands it will probably be worth it to
   * refactor this using decorators for specific entity types,
   * or perhaps by using a dedicated model for each entity type
   *
   * With only two exceptions those solutions seem overkill for now.
   */
  private readonly factories = {
    EPerson: (dso: DSpaceObject, escapeHTML?: boolean): string => {
      const firstName = dso.firstMetadataValue('eperson.firstname', undefined, escapeHTML);
      const lastName = dso.firstMetadataValue('eperson.lastname', undefined, escapeHTML);
      if (isEmpty(firstName) && isEmpty(lastName)) {
        return this.translateService.instant('dso.name.unnamed');
      } else if (isEmpty(firstName) || isEmpty(lastName)) {
        return firstName || lastName;
      } else {
        return `${firstName} ${lastName}`;
      }
    },
    Person: (dso: DSpaceObject, escapeHTML?: boolean): string => {
      const familyName = dso.firstMetadataValue('person.familyName', undefined, escapeHTML);
      const givenName = dso.firstMetadataValue('person.givenName', undefined, escapeHTML);
      if (isEmpty(familyName) && isEmpty(givenName)) {
        return dso.firstMetadataValue('dc.title', undefined, escapeHTML) || this.translateService.instant('dso.name.unnamed');
      } else if (isEmpty(familyName) || isEmpty(givenName)) {
        return familyName || givenName;
      } else {
        return `${familyName}, ${givenName}`;
      }
    },
    OrgUnit: (dso: DSpaceObject, escapeHTML?: boolean): string => {
      return dso.firstMetadataValue('organization.legalName', undefined, escapeHTML);
    },
    House: (dso: DSpaceObject, escapeHTML?: boolean): string => {
      return dso.firstMetadataValue('crvs.identifier.houseFamilyKey', undefined, escapeHTML);
    },
    VitalEvent: (dso: DSpaceObject, escapeHTML?: boolean): string => {
      const childName = dso.firstMetadataValue("crvs.birth.childName", undefined, escapeHTML)
      const husbandName = dso.firstMetadataValue("crvs.marriage.husbandName", undefined, escapeHTML)
      const wifeName = dso.firstMetadataValue("crvs.marriage.wifeName", undefined, escapeHTML)
      const deceasedName = dso.firstMetadataValue("crvs.death.personName", undefined, escapeHTML)

      if (isNotEmpty(childName)) {
        return childName;
      }

      if (isNotEmpty(husbandName) && isNotEmpty(wifeName)) {
        return `${husbandName} & ${wifeName}`;
      }

      if (isNotEmpty(husbandName) || isNotEmpty(wifeName)) {
        return husbandName || wifeName;
      }

      if (isNotEmpty(deceasedName)) {
        return deceasedName;
      }
    },
    Default: (dso: DSpaceObject, escapeHTML?: boolean): string => {
      const fileNumber = dso.firstMetadataValue('legal.case.fileNumber', undefined, escapeHTML);
      const plaintiff = dso.firstMetadataValue('legal.case.plaintiff', undefined, escapeHTML);
      const defendant = dso.firstMetadataValue('legal.case.defendant', undefined, escapeHTML);
      const complaintNumber = dso.firstMetadataValue('legal.case.complaintNumber', undefined, escapeHTML);
      
      let legalName = '';
      const vsPart = (plaintiff && defendant) ? `${plaintiff} Vs ${defendant}` : (plaintiff || defendant || '');

      if (isNotEmpty(fileNumber) && isNotEmpty(vsPart)) {
        legalName = `${fileNumber}<br>${vsPart}`;
      } else {
        legalName = fileNumber || vsPart || complaintNumber || '';
      }

      if (isNotEmpty(legalName)) {
        return legalName;
      }

      // If object doesn't have dc.title metadata use name property
      return dso.firstMetadataValue('dc.title', undefined, escapeHTML) || dso.name || this.translateService.instant('dso.name.untitled');
    },
  };

  /**
   * Get the name for the given {@link DSpaceObject}
   *
   * @param dso  The {@link DSpaceObject} you want a name for
   * @param escapeHTML Whether the HTML is used inside a `[innerHTML]` attribute
   */
  getName(dso: DSpaceObject | undefined, escapeHTML?: boolean): string {
    if (dso) {
      const types = dso.getRenderTypes();
      const match = types
        .filter((type) => typeof type === 'string')
        .find((type: string) => Object.keys(this.factories).includes(type)) as string;

      let name;
      if (hasValue(match)) {
        name = this.factories[match](dso, escapeHTML);
      }
      if (isEmpty(name)) {
        name = this.factories.Default(dso, escapeHTML);
      }
      return name;
    } else {
      return '';
    }
  }

  /**
   * Gets the Hit highlight
   *
   * @param object
   * @param dso
   * @param escapeHTML Whether the HTML is used inside a `[innerHTML]` attribute
   *
   * @returns {string} html embedded hit highlight.
   */
  getHitHighlights(object: any, dso: DSpaceObject, escapeHTML?: boolean): string {
    const types = dso.getRenderTypes();
    const entityType = types
      .filter((type) => typeof type === 'string')
      .find((type: string) => (['Person', 'OrgUnit', 'House', 'VitalEvent']).includes(type)) as string;
    if (entityType === 'Person') {
      const familyName = this.firstMetadataValue(object, dso, 'person.familyName', escapeHTML);
      const givenName = this.firstMetadataValue(object, dso, 'person.givenName', escapeHTML);
      if (isEmpty(familyName) && isEmpty(givenName)) {
        return this.firstMetadataValue(object, dso, 'dc.title', escapeHTML) || dso.name;
      } else if (isEmpty(familyName) || isEmpty(givenName)) {
        return familyName || givenName;
      }
      return `${familyName}, ${givenName}`;
    } else if (entityType === 'OrgUnit') {
      return this.firstMetadataValue(object, dso, 'organization.legalName', escapeHTML);
    } else if (entityType === "House") {
      return this.firstMetadataValue(object, dso, 'crvs.identifier.houseFamilyKey', escapeHTML) || dso.name || this.translateService.instant('dso.name.untitled');
    } else if (entityType === "VitalEvent") {
      const childName = this.firstMetadataValue(object, dso, "crvs.birth.childName", escapeHTML)
      const husbandName = this.firstMetadataValue(object, dso, "crvs.marriage.husbandName", escapeHTML)
      const wifeName = this.firstMetadataValue(object, dso, "crvs.marriage.wifeName", escapeHTML)
      const deceasedName = this.firstMetadataValue(object, dso, "crvs.death.personName", escapeHTML)

      if (isNotEmpty(childName)) {
        return childName;
      }

      if (isNotEmpty(husbandName) && isNotEmpty(wifeName)) {
        return `${husbandName} & ${wifeName}`;
      }

      if (isNotEmpty(husbandName) || isNotEmpty(wifeName)) {
        return husbandName || wifeName;
      }

      if (isNotEmpty(deceasedName)) {
        return deceasedName;
      }

      return this.translateService.instant('dso.name.untitled');
    }

    const fileNumber = this.firstMetadataValue(object, dso, 'legal.case.fileNumber', escapeHTML);
    const plaintiff = this.firstMetadataValue(object, dso, 'legal.case.plaintiff', escapeHTML);
    const defendant = this.firstMetadataValue(object, dso, 'legal.case.defendant', escapeHTML);
    const complaintNumber = this.firstMetadataValue(object, dso, 'legal.case.complaintNumber', escapeHTML);
    
    let legalName = '';
    const vsPart = (plaintiff && defendant) ? `${plaintiff} Vs ${defendant}` : (plaintiff || defendant || '');

    if (isNotEmpty(fileNumber) && isNotEmpty(vsPart)) {
      legalName = `${fileNumber}<br>${vsPart}`;
    } else {
      legalName = fileNumber || vsPart || complaintNumber || '';
    }

    if (isNotEmpty(legalName)) {
      return legalName;
    }

    return this.firstMetadataValue(object, dso, 'dc.title', escapeHTML) || dso.name || this.translateService.instant('dso.name.untitled');
  }

  /**
 * Gets the appropriate date
 *
 * @param object
 * @param dso
 * @param escapeHTML Whether the HTML is used inside a `[innerHTML]` attribute
 *
 * @returns {string} html embedded hit highlight.
 */
  getDate(object: any, dso: DSpaceObject, escapeHTML?: boolean): string {
    const types = dso.getRenderTypes();
    const entityType = types
      .filter((type) => typeof type === 'string')
      .find((type: string) => (['House', 'VitalEvent']).includes(type)) as string;
    if (entityType === "House") {
      return this.firstMetadataValue(object, dso, 'crvs.date.registration', escapeHTML) || "";
    } else if (entityType === "VitalEvent") {
      const dateOfBirth = this.firstMetadataValue(object, dso, "crvs.birth.dateOfBirth", escapeHTML)
      const marriageDate = this.firstMetadataValue(object, dso, "crvs.marriage.date", escapeHTML)
      const divorceDate = this.firstMetadataValue(object, dso, "crvs.divorce.courtApprovalDate", escapeHTML)
      const dateOfDeath = this.firstMetadataValue(object, dso, "crvs.death.dateOfDeath", escapeHTML)

      if (isNotEmpty(dateOfBirth)) {
        return `Date of Birth: ${dateOfBirth}`;
      }

      if (isNotEmpty(marriageDate) || isNotEmpty(divorceDate)) {
        return `Marriage: ${marriageDate || "N/A"}, Divorce: ${divorceDate || "N/A"}`;
      }

      if (isNotEmpty(dateOfDeath)) {
        return `Date of Death: ${dateOfDeath}`;
      }

      return "No Date";
    }

    const registrationDate = this.firstMetadataValue(object, dso, 'legal.date.registration', escapeHTML);
    if (isNotEmpty(registrationDate)) {
      return registrationDate;
    }

    return "No Date";
  }

  /**
   * Gets the first matching metadata string value from hitHighlights or dso metadata, preferring hitHighlights.
   *
   * @param object
   * @param dso
   * @param {string|string[]} keyOrKeys The metadata key(s) in scope. Wildcards are supported; see [[Metadata]].
   * @param escapeHTML Whether the HTML is used inside a `[innerHTML]` attribute
   *
   * @returns {string} the first matching string value, or `undefined`.
   */
  firstMetadataValue(object: any, dso: DSpaceObject, keyOrKeys: string | string[], escapeHTML?: boolean): string {
    return Metadata.firstValue(dso.metadata, keyOrKeys, object.hitHighlights, undefined, escapeHTML);
  }

}
