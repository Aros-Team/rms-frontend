import { Component, inject, OnInit } from '@angular/core';

import { ChartModule } from 'primeng/chart';
import { AnalyticsService } from '@app/core/services/analytics/analytics-service';

interface ChartData {
  labels?: string[];
  datasets?: { data: number[]; backgroundColor?: string[]; borderWidth?: number }[];
}

interface ChartOptions {
  cutout?: string;
  plugins?: {
    legend?: { position?: string };
    tooltip?: {
      callbacks?: {
        label?: (context: { label?: string; parsed: number }) => string;
      };
    };
  };
}

@Component({
  selector: 'app-top-selling-chart',
  standalone: true,
  imports: [ChartModule],
  templateUrl: './top-selling-chart.component.html',
})
export class TopSellingChartComponent implements OnInit {
  private analytics = inject(AnalyticsService);

  data: ChartData | null = null;
  options: ChartOptions = {
    cutout: '60%',
    plugins: {
      legend: {
        position: 'bottom'
      },
      tooltip: {
        callbacks: {
          label: (context: { label?: string; parsed: number }) => {
            const label = context.label || '';
            const value = context.parsed;
            return `${label}: ${value}`;
          }
        }
      }
    }
  };
  loading = true;
  error = false;

  ngOnInit(): void {
    this.analytics.getTopSellingProducts().subscribe({
      next: (products) => {
        const top = (products ?? []).slice(0, 10);
        const labels = top.map(p => p.name);
        const quantities = top.map(p => p.soldQuantity);

        const colors = labels.map((_, i) => this.color(i));

        this.data = {
          labels,
          datasets: [
            {
              data: quantities,
              backgroundColor: colors,
              borderWidth: 0
            }
          ]
        };
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  private color(i: number): string {
    const palette = ['#42A5F5','#66BB6A','#FFA726','#AB47BC','#FF7043','#26A69A','#EC407A','#7E57C2','#FFCA28','#29B6F6'];
    return palette[i % palette.length];
  }
}
