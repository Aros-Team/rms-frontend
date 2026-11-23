import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, TemplateRef } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem, Menu } from '@core/services/menu/menu';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule, NgTemplateOutlet],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit, OnDestroy {
  @Input() visible = true;
  @Input() isMobile = false;
  /** Off-canvas (overlay) presentation, e.g. tablet where the panel floats. */
  @Input() isOverlay = false;
  /** Wide state: 3x2 navigation matrix with the assistant docked below. */
  @Input() expanded = false;
  /** Assistant view declared by the shell and docked under the navigation. */
  @Input() chatTemplate?: TemplateRef<unknown>;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() toggleChat = new EventEmitter<void>();

  menuItems: MenuItem[] = [];
  private menuSubscription?: Subscription;

  private menuService = inject(Menu);

  ngOnInit(): void {
    this.menuSubscription = this.menuService.menuItems$.subscribe(items => {
      this.menuItems = items;
    });
  }

  ngOnDestroy(): void {
    this.menuSubscription?.unsubscribe();
  }

  onMenuItemClick(item: MenuItem): void {
    // On desktop the sidebar is permanent: closing it would leave the visible
    // element marked `inert`/`aria-hidden` until a reload, so every link died
    // after the first navigation. Only the mobile drawer closes on selection.
    if (this.isMobile || this.isOverlay) {
      this.closeSidebar();
    }
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
