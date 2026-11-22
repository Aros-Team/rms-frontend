import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { filter } from 'rxjs/operators';

import { Header } from '../../components/header/header';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { ServerDownBanner } from '../../components/server-down-banner/server-down-banner';
import type { NavItem, WorkerWorkspace } from '@app/core/config/navigation/role-navigation';
import { WORKER_NAV } from '@app/core/config/navigation/role-navigation';

/**
 * Worker shell chrome.
 *
 * Feature: one layout for the three worker workspaces, driven by the central
 * navigation config.
 *
 * Contract:
 *  - waiter: mobile-first; ONE bottom navigation (44px+ targets); no second
 *    tab bar, so the old stacked bars are gone
 *  - kitchen: no navigation at all and a full-bleed canvas for a 1920x1080 TV;
 *    falls back to 1024x768 without changing to a phone layout
 *  - cashier: desktop navigation in the same bar
 *  - one `<main id="main">` landmark plus a skip link on every route
 */
@Component({
  selector: 'app-worker-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Header, RouterLink, NgClass, Breadcrumbs, ServerDownBanner],
  templateUrl: './worker-layout.html',
  styleUrl: './worker-layout.css',
})
export class WorkerLayout {
  readonly workerType = input<WorkerWorkspace>('waiter');
  readonly role = input<string | undefined>(undefined);

  readonly navItems = computed<readonly NavItem[]>(() => WORKER_NAV[this.workerType()]);
  readonly isKitchen = computed(() => this.workerType() === 'kitchen');

  readonly currentUrl = signal('');

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.currentUrl.set(this.router.url);
    const sub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
      });
    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }

  /** `aria-current="page"` for the active destination, including the default tab. */
  isActive(item: NavItem): boolean {
    const [path = '', query = ''] = this.currentUrl().split('?');

    if (item.queryParams?.['tab'] !== undefined) {
      const params = new URLSearchParams(query);
      return path === item.routerLink && (params.get('tab') ?? 'menu') === item.queryParams['tab'];
    }

    return path === item.routerLink || path.startsWith(`${item.routerLink}/`);
  }
}
