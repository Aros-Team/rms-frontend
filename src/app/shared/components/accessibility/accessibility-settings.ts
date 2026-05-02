import { Component, inject } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { Accessibility, FontSize, ContrastMode } from '@app/core/services/accessibility/accessibility';

@Component({
  selector: 'app-accessibility-settings',
  imports: [ButtonModule],
  templateUrl: './accessibility-settings.html',
})
export class AccessibilitySettings {
  private accessibilityService = inject(Accessibility);

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