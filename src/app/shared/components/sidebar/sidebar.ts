import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem, Menu } from '@core/services/menu/menu';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html'
})
export class Sidebar implements OnInit, OnDestroy {
  @Input() visible = true;
  @Input() isMobile = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  menuItems: MenuItem[] = [];
  private menuSubscription!: Subscription;

  private menuService = inject(Menu);

  ngOnInit(): void {
    this.menuSubscription = this.menuService.menuItems$.subscribe(items => {
      this.menuItems = items;
    });
  }

  ngOnDestroy(): void {
    this.menuSubscription.unsubscribe();
  }

  onMenuItemClick(item: MenuItem): void {
    this.closeSidebar();
    this.menuService.selectMenuItem(item);

    if (item.command) {
      item.command();
    }
  }

  closeSidebar(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  trackByMenuItem(_index: number, item: MenuItem): string {
    return item.id;
  }
}
