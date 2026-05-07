import { Component, OnInit, OnDestroy, inject, Input, Output, EventEmitter, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';

import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { Header } from '../components/header/header';
import { Sidebar } from '../components/sidebar/sidebar';
import { Accessibility } from '../components/accessibility/accessibility';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Header, Sidebar, Accessibility],
  templateUrl: './layout.html',
  styles: ``
})
export class Layout implements OnInit, OnDestroy {
  @Input() workerType?: string;
  @Input() hideSidebar = false;
  @Input() role?: string;
  @Input() isChatOpen = false;
  @Output() toggleChatEvent = new EventEmitter<void>();

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

  private checkScreenSize(): void {
    const width = window.innerWidth;
    this.isMobile = width < 768;
    this.isTablet = width >= 768 && width < 1024;
    // Sidebar solo visible en desktop (>=1024px), no en tablet porque hay menú horizontal
    this.sidebarVisible = !this.isMobile && !this.isTablet && !this.hideSidebar;
  }

  private setupResizeListener(): void {
    this.resizeHandler = () => { this.checkScreenSize(); };
    window.addEventListener('resize', this.resizeHandler);
  }

  private setupRouterListener(): void {
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
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
  }

  onToggleChat(): void {
    this.toggleChatEvent.emit();
  }
}
