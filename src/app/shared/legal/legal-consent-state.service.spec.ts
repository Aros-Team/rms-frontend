import { TestBed } from '@angular/core/testing';
import { LegalConsentStateService } from './legal-consent-state.service';

describe('LegalConsentStateService', () => {
  let service: LegalConsentStateService;

  beforeEach(() => {
    localStorage.removeItem('rms_habeas_data_accepted');

    TestBed.configureTestingModule({
      providers: [LegalConsentStateService],
    });

    service = TestBed.inject(LegalConsentStateService);
  });

  it('should show modal by default', () => {
    expect(service.shouldShowModal()).toBeTrue();
    expect(service.hasAcceptedHabeasData()).toBeFalse();
  });

  it('should persist accepted state', () => {
    service.accept();

    expect(service.hasAcceptedHabeasData()).toBeTrue();
    expect(service.shouldShowModal()).toBeFalse();
    expect(localStorage.getItem('rms_habeas_data_accepted')).toBe('true');
  });

  it('should reset accepted state', () => {
    service.accept();
    service.reset();

    expect(service.hasAcceptedHabeasData()).toBeFalse();
    expect(service.shouldShowModal()).toBeTrue();
    expect(localStorage.getItem('rms_habeas_data_accepted')).toBe('false');
  });
});
