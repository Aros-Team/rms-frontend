import {
  Component,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  SimpleChange,
  inject,
  Input,
  Output,
  EventEmitter,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  ContentChild,
  TemplateRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { Header } from '../../components/header/header';
import { Sidebar } from '../../components/sidebar/sidebar';
import { RestrictedBanner } from '../../components/restricted-banner/restricted-banner';
import { ServerDownBanner } from '../../components/server-down-banner/server-down-banner';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Header, Sidebar, RestrictedBanner, ServerDownBanner, CommonModule],
  templateUrl: './layout.html',
})
export class Layout implements OnInit, OnDestroy, OnChanges {
  @Input() workerType?: string;
  @Input() hideSidebar = false;
  @Input() role?: string;
  @Input() isChatOpen = false;
  @Output() toggleChatEvent = new EventEmitter<void>();

  /** Docked assistant declared by the shell; rendered inside the side panel. */
  @ContentChild('layoutChat') chatTemplate?: TemplateRef<unknown>;

  sidebarVisible = false;
  isMobile = false;
  isTablet = false;

  private resizeSubscription: Subscription | undefined;
  private routerSubscription: Subscription | undefined;
  private resizeHandler: (() => void) | undefined;
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  ngOnInit(): void {
    this.checkScreenSize();
    this.setupResizeListener();
    this.setupRouterListener();

    if (this.hideSidebar) {
      this.sidebarVisible = false;
    }
  }

  ngOnDestroy(): void {
    this.resizeSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const chat = changes['isChatOpen'] as SimpleChange | undefined;
    // On phones the panel is the same surface as the drawer: closing the
    // assistant must also dismiss the drawer instead of leaving an empty sheet.
    if (chat && !chat.firstChange && !chat.currentValue && this.isMobile) {
      this.sidebarVisible = false;
    }
  }

  private checkScreenSize(): void {
    const width = window.innerWidth;
    this.isMobile = width < 768;
    this.isTablet = width >= 768 && width < 1024;
    // Sidebar solo visible en desktop (>=1024px), no en tablet porque hay menú horizontal
    this.sidebarVisible = !this.isMobile && !this.isTablet && !this.hideSidebar;
  }

  private setupResizeListener(): void {
    this.resizeHandler = () => {
      this.checkScreenSize();
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  private setupRouterListener(): void {
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.cdr.markForCheck();
      });
  }

  toggleSidebar(): void {
    if (!this.hideSidebar) {
      this.sidebarVisible = !this.sidebarVisible;
    }
  }

  onSidebarVisibleChange(visible: boolean): void {
    this.sidebarVisible = visible;
    // The drawer and the docked assistant are the same surface: closing it on
    // mobile/tablet must also close the panel, not leave an empty overlay.
    if (!visible && this.isChatOpen) {
      this.toggleChatEvent.emit();
    }
  }

  /** Open state of the off-canvas drawer. Tablet and desktop always show the rail. */
  get drawerVisible(): boolean {
    if (this.isMobile) {
      return this.sidebarVisible || this.isChatOpen;
    }
    return true;
  }

  onToggleChat(): void {
    this.toggleChatEvent.emit();
  }
}
