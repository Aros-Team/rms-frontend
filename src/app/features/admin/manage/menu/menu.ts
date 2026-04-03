import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, EMPTY } from 'rxjs';

import { DayMenuService } from '@app/core/services/daymenu/daymenu-service';
import { ProductService } from '@app/core/services/products/product-service';
import { LoggingService } from '@app/core/services/logging/logging-service';
import { DayMenuResponse, DayMenuHistoryResponse, DayMenuHistoryPage } from '@app/shared/models/dto/daymenu/daymenu-response';
import { ProductSimpleResponse } from '@app/shared/models/dto/products/product-simple-response';

import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    ButtonModule,
    CardModule,
    ToastModule,
    SelectModule,
    TableModule,
    SkeletonModule,
  ],
  templateUrl: './menu.html',
  providers: [MessageService],
})
export class Menu {
  private dayMenuService = inject(DayMenuService);
  private productService = inject(ProductService);
  private logger = inject(LoggingService);
  private messageService = inject(MessageService);

  currentMenu = signal<DayMenuResponse | null>(null);
  loadingCurrent = signal(true);

  products = signal<ProductSimpleResponse[]>([]);
  loadingProducts = signal(true);
  selectedProductId = signal<number | null>(null);

  get selectedProductIdValue(): number | null {
    return this.selectedProductId();
  }
  set selectedProductIdValue(val: number | null) {
    this.selectedProductId.set(val);
  }
  isSubmitting = signal(false);

  history = signal<DayMenuHistoryResponse[]>([]);
  loadingHistory = signal(true);
  totalRecords = signal(0);
  pageSize = 10;

  selectedProduct = computed(() =>
    this.products().find(p => p.id === this.selectedProductId()) ?? null
  );

  constructor() {
    this.loadCurrentMenu();
    this.loadProducts();
    this.loadHistory(0);
  }

  private loadCurrentMenu(): void {
    this.loadingCurrent.set(true);
    this.dayMenuService.getCurrentDayMenu().pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 204 || err.status === 404) {
          this.currentMenu.set(null);
        } else {
          this.logger.error('Error loading current day menu', err);
        }
        this.loadingCurrent.set(false);
        return EMPTY;
      })
    ).subscribe(menu => {
      this.currentMenu.set(menu);
      this.loadingCurrent.set(false);
    });
  }

  private loadProducts(): void {
    this.loadingProducts.set(true);
    this.productService.getProducts().pipe(
      catchError(err => {
        this.logger.error('Error loading products', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los productos' });
        this.loadingProducts.set(false);
        return EMPTY;
      })
    ).subscribe(all => {
      this.products.set(all.filter(p => p.hasOptions && p.active));
      this.loadingProducts.set(false);
    });
  }

  loadHistory(page: number): void {
    this.loadingHistory.set(true);
    this.dayMenuService.getHistory(page, this.pageSize).pipe(
      catchError(err => {
        this.logger.error('Error loading history', err);
        this.loadingHistory.set(false);
        return EMPTY;
      })
    ).subscribe((data: DayMenuHistoryPage) => {
      this.history.set(data.content);
      this.totalRecords.set(data.totalElements);
      this.loadingHistory.set(false);
    });
  }

  onPageChange(event: { first: number; rows: number }): void {
    const page = Math.floor(event.first / event.rows);
    this.loadHistory(page);
  }

  assign(): void {
    const productId = this.selectedProductId();
    if (productId === null) return;

    this.isSubmitting.set(true);
    this.dayMenuService.updateDayMenu(productId).pipe(
      catchError((err: HttpErrorResponse) => {
        this.logger.error('Error updating day menu', err);
        const detail = this.extractError(err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
        this.isSubmitting.set(false);
        return EMPTY;
      })
    ).subscribe(updated => {
      this.currentMenu.set(updated);
      this.selectedProductId.set(null);
      this.isSubmitting.set(false);
      this.messageService.add({ severity: 'success', summary: 'Éxito', detail: `Menú del día actualizado: ${updated.productName}` });
      this.loadHistory(0);
    });
  }

  private extractError(err: HttpErrorResponse): string {
    if (err.status === 400) return 'El producto seleccionado no es válido para menú del día';
    if (err.status === 404) return 'El producto no existe o está inactivo';
    try {
      const body = typeof err.error === 'string' ? JSON.parse(err.error) : err.error;
      if (body?.message) return body.message;
    } catch { /* ignore */ }
    return 'No se pudo actualizar el menú del día';
  }
}
