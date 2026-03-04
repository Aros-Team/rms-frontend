import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LegalConsentModalComponent } from './legal-consent-modal.component';

describe('LegalConsentModalComponent', () => {
  let fixture: ComponentFixture<LegalConsentModalComponent>;
  let component: LegalConsentModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LegalConsentModalComponent],
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

  it('should hide modal on accept', () => {
    component.accept();
    fixture.detectChanges();

    const overlay = fixture.debugElement.query(By.css('.modal-overlay'));
    expect(overlay).toBeNull();
  });

  it('should hide modal on reject', () => {
    component.reject();
    fixture.detectChanges();

    const overlay = fixture.debugElement.query(By.css('.modal-overlay'));
    expect(overlay).toBeNull();
  });
});
