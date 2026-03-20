import { Component, Input } from '@angular/core';
import { theme } from '../../../environments/theme';

@Component({
  selector: 'app-logo',
  imports: [],
  templateUrl: './logo.html',
  styles: ``,
})
export class Logo {
  @Input() color: string = theme.primary[500];
  @Input() size = 150;

}
