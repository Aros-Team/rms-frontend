import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ProductCostBreakdownResponse } from '@app/shared/models/dto/products/product-cost-breakdown-response';
import { Money } from '@app/shared/pipes/money/money';

@Component({
  selector: 'app-cost-breakdown-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardModule, TableModule, Money],
  templateUrl: './cost-breakdown-panel.html',
})
export class CostBreakdownPanelComponent {
  @Input() breakdown: ProductCostBreakdownResponse | null = null;
  @Input() compact = false;
}
