import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { RmsButton } from '@app/shared/ui/button/button';

/**
 * Shared feedback block for the five analytics sections.
 *
 * Renders three states only when relevant: no permission, a failed request
 * (ProblemDetail detail + retry) and a partial-data note list. It is deliberately
 * dumb so each section owns its own loading/empty handling.
 */
@Component({
  selector: 'app-analytics-notice',
  templateUrl: './analytics-notice.html',
  styleUrl: './analytics-notice.css',
  imports: [RmsButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsNotice {
  @Input() error = '';
  @Input() errorTitle = 'No se pudieron cargar los datos';
  @Input() forbidden = false;
  @Input() notes: string[] = [];

  @Output() retry = new EventEmitter<void>();

  get showNotes(): boolean {
    return !this.error && !this.forbidden && this.notes.length > 0;
  }
}
