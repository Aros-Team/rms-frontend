import { Component, OnInit, OnDestroy, Output, EventEmitter, inject, Input, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationStart } from '@angular/router';
import { MenuItem, Menu } from '@core/services/menu/menu';
import { Auth } from '@core/services/auth/auth';
import { Subscription, filter } from 'rxjs';
import { Logo } from "../logo/logo";
import { environment } from '@environments/environment';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-header',
  imports: [CommonModule, Logo, ButtonModule, DialogModule, RouterModule],
  templateUrl: './header.html',
  styles: ``
})
export class Header implements OnInit, OnDestroy {
  @Output() toggleMenu = new EventEmitter<void>();
  @Output() toggleChat = new EventEmitter<void>();
  @Input() isMobile = false;
  @Input() role?: string;
  @Input() isChatOpen = false;
  customer = environment.customer;

  selectedMenuItem: MenuItem | null = null;
  menuItems: MenuItem[] = [];
  visibleMenuItems = signal<MenuItem[]>([]);
  overflowMenuItems = signal<MenuItem[]>([]);
  showOverflowMenu = signal(false);
  isNavigating = signal(false);
  
  private menuSubscription: Subscription | undefined;
  private itemsSubscription: Subscription | undefined;
  private navigationSubscription: Subscription | undefined;
  showLogoutDialog = false;

  private menuService = inject(Menu);
  private authService = inject(Auth);
  private router = inject(Router);

  ngOnInit(): void {
    this.menuSubscription = this.menuService.selectedMenuItem$.subscribe(item => {
      this.selectedMenuItem = item;
    });
    
    this.itemsSubscription = this.menuService.menuItems$.subscribe(items => {
      this.menuItems = items;
      this.calculateVisibleItems();
    });

    this.navigationSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ).subscribe(() => {
      this.isNavigating.set(true);
      this.showOverflowMenu.set(false);
    });
  }

  ngOnDestroy(): void {
    this.menuSubscription?.unsubscribe();
    this.itemsSubscription?.unsubscribe();
    this.navigationSubscription?.unsubscribe();
  }

  @HostListener('window:resize')
  onResize() {
    if (!this.isNavigating()) {
      this.calculateVisibleItems();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.overflow-menu-container')) {
      this.showOverflowMenu.set(false);
    }
  }

  private calculateVisibleItems() {
    const width = window.innerWidth;
    
    if (width >= 768 && width < 1024) {
      const reservedWidth = 280;
      const availableWidth = Math.max(0, width - reservedWidth);
      
      const visible: MenuItem[] = [];
      let usedWidth = 0;
      
      for (let i = 0; i < this.menuItems.length; i++) {
        const item = this.menuItems[i];
        const remainingItems = this.menuItems.length - i - 1;
        const needsMoreButton = remainingItems > 0;
        const itemWidth = this.estimateItemWidth(item);
        const moreButtonWidth = needsMoreButton ? 50 : 0;
        const totalWidth = usedWidth + itemWidth + moreButtonWidth + 10;
        
        if (totalWidth <= availableWidth) {
          visible.push(item);
          usedWidth += itemWidth + 4;
        } else {
          break;
        }
      }
      
      const overflow = this.menuItems.slice(visible.length);
      
      if (overflow.length === 1) {
        const lastVisibleWidth = visible.length > 0 ? this.estimateItemWidth(visible[visible.length - 1]) : 0;
        const overflowWidth = this.estimateItemWidth(overflow[0]);
        
        if (usedWidth - lastVisibleWidth + overflowWidth + 50 <= availableWidth) {
          visible.pop();
          visible.push(overflow[0]);
          overflow.length = 0;
        }
      }
      
      this.visibleMenuItems.set(visible);
      this.overflowMenuItems.set(overflow);
    } else {
      this.visibleMenuItems.set([]);
      this.overflowMenuItems.set([]);
    }
  }

  private estimateItemWidth(item: MenuItem): number {
    const iconWidth = item.icon ? 20 : 0;
    const textWidth = item.label.length * 7.5;
    const paddingGap = 32;
    return iconWidth + textWidth + paddingGap;
  }

  toggleOverflowMenu(event: Event) {
    event.stopPropagation();
    this.showOverflowMenu.update(v => !v);
  }

  onOverflowItemClick(item: MenuItem) {
    this.showOverflowMenu.set(false);
    
    if (item.routerLink) {
      void this.router.navigate([item.routerLink]);
    }
    
    if (item.command) {
      item.command();
    }
  }

  onLogout(): void {
    this.showLogoutDialog = true;
  }

  confirmLogout(): void {
    this.showLogoutDialog = false;
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  cancelLogout(): void {
    this.showLogoutDialog = false;
  }
}
