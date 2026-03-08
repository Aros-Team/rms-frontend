import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RmsPageHeaderComponent } from '../../../../shared/ui/page-header/rms-page-header.component';
import { RmsCardComponent } from '../../../../shared/ui/card/rms-card.component';
import { RmsBadgeComponent } from '../../../../shared/ui/badge/rms-badge.component';
import { RmsButtonComponent } from '../../../../shared/ui/button/rms-button.component';
import { RmsEmptyStateComponent } from '../../../../shared/ui/empty-state/rms-empty-state.component';

interface KitchenOrder {
  id: number;
  tableNumber: number;
  items: { name: string; quantity: number }[];
  status: 'pending' | 'preparing' | 'ready';
  createdAt: Date;
}

@Component({
  selector: 'app-kitchen-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RmsPageHeaderComponent,
    RmsCardComponent,
    RmsBadgeComponent,
    RmsButtonComponent,
    RmsEmptyStateComponent,
  ],
  templateUrl: './kitchen-dashboard.page.html',
  styleUrl: './kitchen-dashboard.page.css',
})
export class KitchenDashboardPageComponent {
  readonly pendingOrders = signal<KitchenOrder[]>([
    {
      id: 1,
      tableNumber: 3,
      items: [
        { name: 'Hamburguesa Clásica', quantity: 2 },
        { name: 'Papas Fritas', quantity: 1 },
        { name: 'Refresco', quantity: 2 }
      ],
      status: 'pending',
      createdAt: new Date(Date.now() - 5 * 60000)
    },
    {
      id: 2,
      tableNumber: 5,
      items: [
        { name: 'Ensalada César', quantity: 1 },
        { name: 'Sopa del día', quantity: 1 }
      ],
      status: 'preparing',
      createdAt: new Date(Date.now() - 12 * 60000)
    },
    {
      id: 3,
      tableNumber: 1,
      items: [
        { name: 'Ribeye Steak', quantity: 1 },
        { name: 'Vino Tinto', quantity: 1 }
      ],
      status: 'pending',
      createdAt: new Date(Date.now() - 3 * 60000)
    }
  ]);

  startPreparing(orderId: number): void {
    this.pendingOrders.update(orders =>
      orders.map(o => o.id === orderId ? { ...o, status: 'preparing' as const } : o)
    );
  }

  markReady(orderId: number): void {
    this.pendingOrders.update(orders =>
      orders.map(o => o.id === orderId ? { ...o, status: 'ready' as const } : o)
    );
  }

  getTimeAgo(date: Date): string {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  getStatusSeverity(status: string): 'warning' | 'success' | 'info' {
    const map: Record<string, 'warning' | 'success' | 'info'> = {
      pending: 'warning',
      preparing: 'info',
      ready: 'success',
    };
    return map[status] || 'info';
  }
}
