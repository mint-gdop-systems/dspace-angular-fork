import {
    Pipe,
    PipeTransform,
} from '@angular/core';
import { LocaleService } from '@dspace/core/locale/locale.service';
import { take } from 'rxjs/operators';
  
@Pipe({  
  name: 'dsThousandsSeparator',  
})  
export class ThousandsSeparatorPipe implements PipeTransform {  
  
  private currentLocale: string;  
  
  constructor(private localeService: LocaleService) {  
    this.localeService.getCurrentLanguageCode().pipe(take(1)).subscribe(locale => {  
      this.currentLocale = locale;  
    });  
  }  
  
  transform(value: number | string, locale?: string): string {  
    if (value === null || value === undefined || value === '') {  
      return '';  
    }  
      
    const numValue = typeof value === 'string' ? parseFloat(value) : value;  
      
    if (isNaN(numValue)) {  
      return value.toString();  
    }  
  
    const formatter = new Intl.NumberFormat(locale || this.currentLocale);  
    return formatter.format(numValue);  
  }  
}