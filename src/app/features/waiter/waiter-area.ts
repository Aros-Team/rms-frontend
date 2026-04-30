import { Component, OnInit, inject, signal } from '@angular/core';

import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';

import { MasterDataService } from '@app/core/services/master-data/master-data.service';
import { OrderService } from '@app/core/services/orders/order-service';

@Component({
  selector: 'app-waiter-area',
  imports: [RouterModule, ButtonModule, CardModule, DividerModule],
  template: `
    <div class="min-h-screen bg-surface-50 dark:bg-surface-900">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-surface-900 dark:text-surface-100 mb-2">Área de Mesero</h1>
        <p class="text-surface-600 dark:text-surface-400">Gestiona pedidos y mesas del restaurante</p>
      </div>

      <!-- Cards de funcionalidades -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <p-card class="cursor-pointer h-full hover:shadow-lg transition-all duration-200" [routerLink]="['/worker/day-menu']">
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="pi pi-list text-2xl text-primary-600 dark:text-primary-400"></i>
            </div>
            <h3 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">Menú del Día</h3>
            <p class="text-surface-600 dark:text-surface-400">Especialidades disponibles hoy</p>
          </div>
        </p-card>

        <p-card class="cursor-pointer h-full hover:shadow-lg transition-all duration-200" [routerLink]="['/worker/take-order']">
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="pi pi-shopping-cart text-2xl text-green-600 dark:text-green-400"></i>
            </div>
            <h3 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">Tomar Orden</h3>
            <p class="text-surface-600 dark:text-surface-400">Seleccionar productos y crear orden</p>
          </div>
        </p-card>

        <p-card class="cursor-pointer h-full hover:shadow-lg transition-all duration-200" [routerLink]="['/worker/orders']">
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="pi pi-clock text-2xl text-orange-600 dark:text-orange-400"></i>
            </div>
            <h3 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">Órdenes del Día</h3>
            <p class="text-surface-600 dark:text-surface-400">Ver pedidos activos del día</p>
          </div>
        </p-card>
      </div>

      <div class="mt-6">
        <p-card class="cursor-pointer h-full hover:shadow-lg transition-all duration-200" [routerLink]="['/worker/kitchen']">
          <div class="text-center p-6">
            <div class="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="pi pi-table text-2xl text-blue-600 dark:text-blue-400"></i>
            </div>
            <h3 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">Cocina</h3>
            <p class="text-surface-600 dark:text-surface-400">Ver pedidos pendientes en cocina</p>
          </div>
        </p-card>
      </div>

      <!-- Estadísticas + Acciones rápidas -->
      <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <p-card header="Resumen Rápido">
          @if (statsLoading()) {
            <div class="flex items-center gap-2 text-surface-400 py-4">
              <i class="pi pi-spin pi-spinner"></i>
              <span class="text-sm">Cargando estadísticas...</span>
            </div>
          } @else {
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <span class="text-surface-600 dark:text-surface-400">Mesas ocupadas:</span>
                <span class="font-semibold text-surface-900 dark:text-surface-100">
                  {{ occupiedTables() }}/{{ totalTables() }}
                </span>
              </div>
              <p-divider />
              <div class="flex justify-between items-center">
                <span class="text-surface-600 dark:text-surface-400">Órdenes activas:</span>
                <span class="font-semibold text-surface-900 dark:text-surface-100">{{ activeOrders() }}</span>
              </div>
              <p-divider />
              <div class="flex justify-between items-center">
                <span class="text-surface-600 dark:text-surface-400">Pedidos pendientes:</span>
                <span class="font-semibold text-surface-900 dark:text-surface-100">{{ pendingOrders() }}</span>
              </div>
            </div>
          }
        </p-card>

        <p-card header="Acciones Rápidas">
          <div class="space-y-3">
            <p-button label="Menú del Día" icon="pi pi-list" styleClass="w-full justify-start" [text]="true" [routerLink]="['/worker/day-menu']" />
            <p-button label="Tomar Orden" icon="pi pi-shopping-cart" styleClass="w-full justify-start" [text]="true" [routerLink]="['/worker/take-order']" />
            <p-button label="Órdenes del Día" icon="pi pi-clock" styleClass="w-full justify-start" [text]="true" [routerLink]="['/worker/orders']" />
            <p-button label="Cocina" icon="pi pi-table" styleClass="w-full justify-start" [text]="true" [routerLink]="['/worker/kitchen']" />
          </div>
        </p-card>
      </div>
    </div>
  `
})
export class WaiterArea implements OnInit {
  private masterData = inject(MasterDataService);
  private orderService = inject(OrderService);

  statsLoading = signal(true);
  occupiedTables = signal(0);
  totalTables = signal(0);
  activeOrders = signal(0);
  pendingOrders = signal(0);

  ngOnInit(): void {
    this.loadStats();
  }

  private loadStats(): void {
    this.statsLoading.set(true);

    // Carga mesas y órdenes en paralelo
    this.masterData.load().subscribe({
      next: (data) => {
        const tables = data.tables;
        this.totalTables.set(tables.length);
        this.occupiedTables.set(tables.filter(t => t.status === 'OCCUPIED').length);
      }
    });

    this.orderService.getTodayOrders().subscribe({
      next: (orders) => {
        this.activeOrders.set(orders.filter(o =>
          o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
        ).length);
        this.pendingOrders.set(orders.filter(o => o.status === 'QUEUE').length);
        this.statsLoading.set(false);
      },
      error: () => {
        this.statsLoading.set(false);
      }
    });
  }
}
