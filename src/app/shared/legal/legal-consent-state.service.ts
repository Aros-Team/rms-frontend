import { Injectable, computed, signal } from '@angular/core';

const HABEAS_DATA_ACCEPTED_KEY = 'rms_habeas_data_accepted';

@Injectable({ providedIn: 'root' })
export class LegalConsentStateService {
  private readonly accepted = signal<boolean>(this.readAcceptedFromStorage());

  readonly hasAcceptedHabeasData = computed(() => this.accepted());
  readonly shouldShowModal = computed(() => !this.accepted());

  accept(): void {
    this.accepted.set(true);
    this.persist(true);
  }

  reset(): void {
    this.accepted.set(false);
    this.persist(false);
  }

  private readAcceptedFromStorage(): boolean {
    try {
      return localStorage.getItem(HABEAS_DATA_ACCEPTED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private persist(value: boolean): void {
    try {
      localStorage.setItem(HABEAS_DATA_ACCEPTED_KEY, String(value));
    } catch {
      // noop
    }
  }
}
