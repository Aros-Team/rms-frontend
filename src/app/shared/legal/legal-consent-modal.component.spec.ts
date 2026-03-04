import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LegalConsentModalComponent } from './legal-consent-modal.component';
import { LegalConsentStateService } from './legal-consent-state.service';

describe('LegalConsentModalComponent', () => {
  let fixture: ComponentFixture<LegalConsentModalComponent>;
  let component: LegalConsentModalComponent;
  let consentStateSpy: jasmine.SpyObj<LegalConsentStateService>;

  beforeEach(async () => {
    consentStateSpy = jasmine.createSpyObj<LegalConsentStateService>('LegalConsentStateService', ['accept', 'reset']);

    await TestBed.configureTestingModule({
      imports: [LegalConsentModalComponent],
      providers: [{ provide: LegalConsentStateService, useValue: consentStateSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(LegalConsentModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render the modal initially', () => {
    const overlay = fixture.debugElement.query(By.css('.modal-overlay'));
    expect(overlay).toBeTruthy();
  });

  it('should switch tabs and show matching title', () => {
    component.setTab('privacy');
    fixture.detectChanges();

    const title = fixture.debugElement.query(By.css('.legal-text h2')).nativeElement as HTMLHeadingElement;
    expect(title.textContent).toContain('Política de Protección de Datos Personales');
  });

  it('should call consent accept on accept action', () => {
    component.accept();
    expect(consentStateSpy.accept).toHaveBeenCalledTimes(1);
  });

  it('should keep modal visible on reject action', () => {
    component.reject();
    fixture.detectChanges();

    const overlay = fixture.debugElement.query(By.css('.modal-overlay'));
    expect(overlay).toBeTruthy();
    expect(consentStateSpy.accept).not.toHaveBeenCalled();
  });
});
