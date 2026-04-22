import { Component, OnInit, OnDestroy, Output, EventEmitter, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MenuItem, MenuService } from '../../../core/services/menu/menu-service';
import { AuthService } from '../../../core/services/authentication/auth-service';
import { Subscription } from 'rxjs';
import { Logo } from "../logo/logo";
import { AccessibilityComponent } from '../accessibility/accessibility.component';
import { environment } from '@environments/environment';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

export interface HorizontalMenuOption {
  id: string;
  label: string;
  description: string;
  icon?: string;
  isActive?: boolean;
  command?: () => void;
  routerLink?: string;
}

@Component({
  selector: 'app-header',
  imports: [CommonModule, Logo, ButtonModule, AccessibilityComponent, DialogModule],
  templateUrl: './header.html',
  styles: ``
})
export class Header implements OnInit, OnDestroy {
  @Output() toggleMenu = new EventEmitter<void>();
  @Output() toggleChat = new EventEmitter<void>();
  @Input() horizontalMenuOptions: HorizontalMenuOption[] = [];
  @Input() isMobile = false;
  @Input() role?: string;
  customer = environment.customer;

  selectedMenuItem: MenuItem | null = null;
  private menuSubscription!: Subscription;
  showLogoutDialog = false;

  private menuService = inject(MenuService);
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    this.menuSubscription = this.menuService.selectedMenuItem$.subscribe(item => {
      this.selectedMenuItem = item;
    });
  }

  ngOnDestroy(): void {
    if (this.menuSubscription) {
      this.menuSubscription.unsubscribe();
    }
  }

  onLogout(): void {
    this.showLogoutDialog = true;
  }

  confirmLogout(): void {
    this.showLogoutDialog = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  cancelLogout(): void {
    this.showLogoutDialog = false;
  }

  onHorizontalOptionClick(option: HorizontalMenuOption): void {
    // Navigate if routerLink is provided
    if (option.routerLink) {
      this.router.navigate([option.routerLink]);
    }

    // Execute command if provided
    if (option.command) {
      option.command();
    }

    // Update active state for visual feedback
    this.horizontalMenuOptions = this.horizontalMenuOptions.map(opt => ({
      ...opt,
      isActive: opt.id === option.id
    }));
  }
}
