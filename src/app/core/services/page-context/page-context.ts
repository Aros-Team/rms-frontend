import { Injectable, signal } from '@angular/core';

/**
 * Page-level context shown in the header next to the brand.
 *
 * Route-level context (`Configuración`, `Horarios · Semana`) is derived from
 * the URL by the header. A page can refine it further — for example the
 * settings workspace adds the active section description — without rendering
 * another explanatory line in the content.
 */
@Injectable({ providedIn: 'root' })
export class PageContext {
  private readonly current = signal<string | null>(null);
  readonly value = this.current.asReadonly();

  set(context: string): void {
    this.current.set(context);
  }

  clear(): void {
    this.current.set(null);
  }
}
