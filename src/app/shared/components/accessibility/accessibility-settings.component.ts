import { Component, inject } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { AccessibilityService, FontSize, ContrastMode } from '@app/core/services/accessibility/accessibility.service';

@Component({
  selector: 'app-accessibility-settings',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <div class="flex flex-col gap-4 p-4">
      <div>
        <label class="block text-sm font-medium mb-2">Tamaño de letra</label>
        <div class="flex gap-2">
          <button 
            pButton 
            [class]="currentFontSize() === 'small' ? '' : 'p-button-outlined'"
            label="A" 
            class="text-xs p-button-sm"
            [class.bg-primary-50]="currentFontSize() === 'small'"
            (click)="setFontSize('small')"
            title="Pequeño"
          ></button>
          <button 
            pButton 
            [class]="currentFontSize() === 'normal' ? '' : 'p-button-outlined'"
            label="A" 
            class="text-sm p-button-sm"
            [class.bg-primary-50]="currentFontSize() === 'normal'"
            (click)="setFontSize('normal')"
            title="Normal"
          ></button>
          <button 
            pButton 
            [class]="currentFontSize() === 'large' ? '' : 'p-button-outlined'"
            label="A" 
            class="text-base p-button-sm"
            [class.bg-primary-50]="currentFontSize() === 'large'"
            (click)="setFontSize('large')"
            title="Grande"
          ></button>
          <button 
            pButton 
            [class]="currentFontSize() === 'extra-large' ? '' : 'p-button-outlined'"
            label="A" 
            class="text-lg p-button-sm"
            [class.bg-primary-50]="currentFontSize() === 'extra-large'"
            (click)="setFontSize('extra-large')"
            title="Extra Grande"
          ></button>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium mb-2">Contraste</label>
        <div class="flex gap-2">
          <button 
            pButton 
            [class]="currentContrast() === 'normal' ? '' : 'p-button-outlined'"
            label="Normal" 
            class="p-button-sm"
            [class.bg-primary-50]="currentContrast() === 'normal'"
            (click)="setContrast('normal')"
          ></button>
          <button 
            pButton 
            [class]="currentContrast() === 'high' ? '' : 'p-button-outlined'"
            label="Alto" 
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
