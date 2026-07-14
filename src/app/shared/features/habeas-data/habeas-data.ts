import { Component, inject, OnInit, OnDestroy } from '@angular/core';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { Subscription } from 'rxjs';
import { HabeasDataService } from './habeas-data.service';

@Component({
  selector: 'app-habeas-data',
  imports: [DialogModule, ButtonModule],
  templateUrl: './habeas-data.html'
})
export class HabeasData implements OnInit, OnDestroy {
  visible = false;
  lastUpdateDate = '13 de Marzo de 2026';
  fontSize = 16;

  private readonly FONT_SIZE_KEY = 'accessibility_font_size';
  private habeasDataService = inject(HabeasDataService);
  private subs: Subscription[] = [];

  ngOnInit(): void {
    const accepted = localStorage.getItem('habeas_data_accepted');
    if (!accepted) {
      this.visible = true;
    }

    const savedFontSize = localStorage.getItem(this.FONT_SIZE_KEY);
    if (savedFontSize) {
      this.fontSize = parseInt(savedFontSize, 10);
    }

    this.subs.push(
      this.habeasDataService.showDialog.subscribe(() => {
        this.visible = true;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => { s.unsubscribe(); });
  }

  accept(): void {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    localStorage.setItem('habeas_data_accepted', 'true');
    localStorage.setItem('habeas_data_date', dateStr);
    this.habeasDataService.accepted.next();
    this.visible = false;
  }

  reject(): void {
    localStorage.removeItem('habeas_data_accepted');
    this.habeasDataService.rejected.next();
    this.visible = false;
  }
}
