import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * `app-rms-skeleton` — loading placeholder shaped like the final content.
 *
 * The wrapper is a `role="status"` with a visible-to-AT label, so a screen
 * reader hears "Cargando…" instead of empty divs (T-03). The bars themselves
 * are aria-hidden. Animation is disabled by the global reduced-motion gate.
 */
@Component({
  selector: 'app-rms-skeleton',
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsSkeleton {
  @Input() variant: 'text' | 'rect' | 'circle' = 'rect';
  @Input() width = '100%';
  @Input() height = '1rem';
  @Input() lines = 1;
  @Input() ariaLabel = 'Cargando…';

  get lineArray(): number[] {
    return Array.from({ length: Math.max(1, this.lines) });
  }

  get lineCount(): number {
    return Math.max(1, this.lines);
  }

  get circleSize(): string {
    return this.height;
  }
}
