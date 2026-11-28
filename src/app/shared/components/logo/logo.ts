import { Component, Input } from '@angular/core';
@Component({
  selector: 'app-logo',
  imports: [],
  templateUrl: './logo.html',
})
export class Logo {
  /** Matches the dark brand text used by the header wordmark and active tabs. */
  @Input() color = 'var(--rms-brand-text)';
  @Input() size = 150;
}
