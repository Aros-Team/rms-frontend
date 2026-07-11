import { Component, Input, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Header } from '../components/header/header';

export interface TabItem {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-worker-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Header, CommonModule],
  templateUrl: './worker-layout.html',
  styles: ``
})
export class WorkerLayout {
  @Input() workerType?: string;
  @Input() role?: string;
  private router = inject(Router);

  tabs: TabItem[] = [
    { id: 'menu',    label: 'Menú del día', icon: 'pi pi-calendar' },
    { id: 'carta',   label: 'Carta',        icon: 'pi pi-book' },
    { id: 'pedidos', label: 'Pedidos',      icon: 'pi pi-list' },
  ];

  isActive(tab: TabItem): boolean {
    return this.router.url.includes(`tab=${tab.id}`);
  }

  onTabClick(tab: TabItem): void {
    void this.router.navigate(['/worker'], { queryParams: { tab: tab.id } });
  }
}
