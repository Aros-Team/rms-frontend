import { Pipe, PipeTransform } from '@angular/core';
import { OrderSelectedOption } from '@app/shared/models/dto/orders/order-response';

@Pipe({ name: 'optionNames' })
export class OptionNames implements PipeTransform {
  transform(options: OrderSelectedOption[] | undefined | null): string {
    return (options ?? []).map(o => o.name).join(', ');
  }
}
