import { Component, inject } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { AccessibilityService, FontSize, ContrastMode } from '@app/core/services/accessibility/accessibility.service';

@Component({
  selector: 'app-accessibility-settings',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <div class="flex flex-col gap-4 p-4">
      <div role="group" aria-labelledby="font-size-label">
        <span id="font-size-label" class="block text-sm font-medium mb-2">Tamaño de letra</span>
        <div class="flex gap-2" role="radiogroup" aria-label="Tamaño de letra">
          <button 
            pButton 
            [class]="currentFontSize() === 'small' ? '' : 'p-button-outlined'"
            label="A" 
            aria-label="Pequeño"
            class="text-xs p-button-sm"
            [class.bg-primary-50]="currentFontSize() === 'small'"
            (click)="setFontSize('small')"
          ></button>
          <button 
            pButton 
            [class]="currentFontSize() === 'normal' ? '' : 'p-button-outlined'"
            label="A" 
            aria-label="Normal"
            class="text-sm p-button-sm"
            [class.bg-primary-50]="currentFontSize() === 'normal'"
            (click)="setFontSize('normal')"
          ></button>
          <button 
            pButton 
            [class]="currentFontSize() === 'large' ? '' : 'p-button-outlined'"
            label="A" 
            aria-label="Grande"
            class="text-base p-button-sm"
            [class.bg-primary-50]="currentFontSize() === 'large'"
            (click)="setFontSize('large')"
          ></button>
          <button 
            pButton 
            [class]="currentFontSize() === 'extra-large' ? '' : 'p-button-outlined'"
            label="A" 
            aria-label="Extra Grande"
            class="text-lg p-button-sm"
            [class.bg-primary-50]="currentFontSize() === 'extra-large'"
            (click)="setFontSize('extra-large')"
          ></button>
        </div>
      </div>

      <div role="group" aria-labelledby="contrast-label">
        <span id="contrast-label" class="block text-sm font-medium mb-2">Contraste</span>
        <div class="flex gap-2" role="radiogroup" aria-label="Modo de contraste">
          <button 
            pButton 
            [class]="currentContrast() === 'normal' ? '' : 'p-button-outlined'"
            label="Normal" 
            aria-label="Contraste normal"
            class="p-button-sm"
            [class.bg-primary-50]="currentContrast() === 'normal'"
            (click)="setContrast('normal')"
          ></button>
          <button 
            pButton 
            [class]="currentContrast() === 'high' ? '' : 'p-button-outlined'"
            label="Alto" 
            aria-label="Alto contraste"
            class="p-button-sm"
            [class.bg-primary-50]="currentContrast() === 'high'"
            (click)="setContrast('high')"
          ></button>
        </div>
      </div>
    </div>
  `
})
export class AccessibilitySettingsComponent {
  private accessibilityService = inject(AccessibilityService);

  currentFontSize() {
    return this.accessibilityService.fontSize();
  }

  currentContrast() {
    return this.accessibilityService.contrastMode();
  }

  setFontSize(size: FontSize) {
    this.accessibilityService.setFontSize(size);
  }

  setContrast(mode: ContrastMode) {
    this.accessibilityService.setContrastMode(mode);
  }
}
