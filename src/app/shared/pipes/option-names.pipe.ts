import { Pipe, PipeTransform } from '@angular/core';
import { OrderSelectedOption } from '@app/shared/models/dto/orders/order-response.model';

@Pipe({ name: 'optionNames' })
export class OptionNamesPipe implements PipeTransform {
  transform(options: OrderSelectedOption[] | undefined | null): string {
    return (options ?? []).map(o => o.name).join(', ');
  }
}
