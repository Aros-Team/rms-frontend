import { Component } from '@angular/core';

import { TopSellingChart } from './top-selling-chart/top-selling-chart';

@Component({
  selector: 'app-analytics',
  imports: [TopSellingChart],
  templateUrl: './analytics.html',
  styles: ``
})
export class Analytics {
  title = 'Estadísticas';
  description = 'Visualiza las estadísticas de tu restaurante';
}
