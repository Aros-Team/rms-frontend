import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  inject,
  Input,
  signal,
  computed,
  effect,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd, NavigationStart } from '@angular/router';
import { MenuItem, Menu } from '@core/services/menu/menu';
import { Auth } from '@core/services/auth/auth';
import {
  NotificationCenter,
  AppNotification,
} from '@core/services/notifications/notification-center';
import { Subscription } from 'rxjs';
import { Logo } from '../logo/logo';
import { environment } from '@environments/environment';
import { DialogModule } from 'primeng/dialog';
import { RmsButton } from '@app/shared/ui/button/button';

@Component({
  selector: 'app-header',
  imports: [CommonModule, Logo, RouterModule, DialogModule, RmsButton],
  templateUrl: './header.html',
})
export class Header implements OnInit, OnDestroy {
  @Output() toggleMenu = new EventEmitter<void>();
  @Input() isMobile = false;
  @Input() role?: string;
  @Input() workerType?: string;
  /** When true, hides the tablet inline nav (used when a separate tab bar exists below header) */
  @Input() hideTabletNav = false;
  /** State of the off-canvas menu, for `aria-expanded` on the trigger. */
  @Input() menuOpen = false;
  customer = environment.customer;

  menuItems: MenuItem[] = [];
  visibleMenuItems = signal<MenuItem[]>([]);
  overflowMenuItems = signal<MenuItem[]>([]);
  showOverflowMenu = signal(false);
  showUserMenu = signal(false);
  showNotifications = signal(false);
  isNavigating = signal(false);

  readonly notificationCenter = inject(NotificationCenter);

  private readonly currentUser = computed(() => this.authService.userData());

  readonly userName = computed(() => {
    const user = this.currentUser();
    if (user?.name.trim()) return user.name.trim();
    return this.role === 'ADMIN' ? 'Administrador' : 'Usuario';
  });

  readonly userEmail = computed(() => this.currentUser()?.email ?? '');

  readonly userRoleLabel = computed(() =>
    (this.role ?? this.currentUser()?.role) === 'ADMIN' ? 'Administrador' : 'Trabajador',
  );

  /**
   * Workers reach their account, password and accessibility settings at
   * `/worker/profile`; from the profile menu, next to "Cerrar sesión", so the
   * menu is the only account entry point in every workspace (kitchen has no
   * navigation at all).
   */
  readonly isWorker = computed(() => (this.role ?? this.currentUser()?.role) === 'WORKER');

  readonly userInitials = computed(() => {
    const name = this.currentUser()?.name.trim();
    if (name) {
      return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase();
    }
    const email = this.currentUser()?.email ?? '';
    return email ? email.charAt(0).toUpperCase() : 'U';
  });

  private itemsSubscription: Subscription | undefined;
  private navigationSubscription: Subscription | undefined;
  showLogoutDialog = false;

  private menuService = inject(Menu);
  private authService = inject(Auth);
  private router = inject(Router);

  constructor() {
    // The shell renders before `/auth` resolves; start the feed as soon as the
    // session user exists so workers subscribe to their own topic and endpoint.
    effect(() => {
      const user = this.authService.userData();
      const role = user?.role ?? this.role;
      if (user !== undefined && (role === 'ADMIN' || role === 'WORKER')) {
        this.notificationCenter.start();
      }
    });
  }

  ngOnInit(): void {
    this.itemsSubscription = this.menuService.menuItems$.subscribe((items) => {
      this.menuItems = items;
      this.calculateVisibleItems();
      this.syncMenuItemFromRoute();
    });

    this.navigationSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.isNavigating.set(true);
        this.showOverflowMenu.set(false);
      }
      if (event instanceof NavigationEnd) {
        this.isNavigating.set(false);
        this.showUserMenu.set(false);
        this.showNotifications.set(false);
        this.syncMenuItemFromRoute();
      }
    });
  }

  private syncMenuItemFromRoute(): void {
    const url = this.router.url;
    const matched = this.menuItems.find((item) => {
      if (!item.routerLink) return false;
      if (item.exact) return url === item.routerLink;
      return url.startsWith(item.routerLink);
    });
    if (matched) {
      this.menuService.selectMenuItem(matched);
    }
  }

  ngOnDestroy(): void {
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
    if (!target.closest('.user-menu-container')) {
      this.showUserMenu.set(false);
    }
    if (!target.closest('.notifications-container')) {
      this.showNotifications.set(false);
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
        const lastVisibleWidth =
          visible.length > 0 ? this.estimateItemWidth(visible[visible.length - 1]) : 0;
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
    this.showOverflowMenu.update((v) => !v);
  }

  toggleUserMenu(event: Event) {
    event.stopPropagation();
    this.showNotifications.set(false);
    this.showUserMenu.update((open) => !open);
  }

  toggleNotifications(event: Event) {
    event.stopPropagation();
    this.showUserMenu.set(false);
    const opening = !this.showNotifications();
    this.showNotifications.set(opening);
    if (opening) {
      this.notificationCenter.refresh();
    }
  }

  openNotification(notification: AppNotification): void {
    this.notificationCenter.markRead(notification.id);
    this.showNotifications.set(false);

    // A new worker module only appears after `/auth` is fetched again, so a
    // module-assignment notification performs a full reload instead of a
    // client-side navigation.
    if (notification.code === 'WORKER_MODULE_ASSIGNED') {
      window.location.assign(notification.route ?? '/worker');
      return;
    }

    if (notification.route) {
      void this.router.navigateByUrl(notification.route);
    }
  }

  formatNotificationTime(date: Date): string {
    const now = new Date();
    const sameDay =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    return new Intl.DateTimeFormat(
      'es-ES',
      sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short' },
    ).format(date);
  }

  toneClass(tone: AppNotification['tone']): string {
    switch (tone) {
      case 'success':
        return 'rms-text-success';
      case 'danger':
        return 'rms-text-danger';
      case 'warning':
        return 'rms-text-warning';
      default:
        return 'text-accent';
    }
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
    this.showUserMenu.set(false);
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
