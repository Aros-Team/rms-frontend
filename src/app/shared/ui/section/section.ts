import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * `app-rms-section` — page section with a heading and an actions slot.
 *
 * Owns the heading level so the page outline stays valid: PageHeader renders
 * the only H1, sections render H2 by default and nested groups use H3.
 */
@Component({
  selector: 'app-rms-section',
  templateUrl: './section.html',
  styleUrl: './section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsSection {
  private static nextId = 0;

  @Input({ required: true }) title!: string;
  @Input() description = '';
  @Input() level: 2 | 3 = 2;

  /** Stable per-instance id for aria-labelledby (titles are Spanish prose). */
  readonly headingId = `rms-section-${String(RmsSection.nextId++)}`;
}
