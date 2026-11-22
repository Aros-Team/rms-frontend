import { Component, OnInit, inject, ChangeDetectionStrategy, ViewChild, signal, ChangeDetectorRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Layout } from '@app/shared/layout/layout/layout';
import { Chat } from '@app/areas/admin/features/chat/chat';
import { Menu } from '@app/core/services/menu/menu';
import { ADMIN_NAV } from '@app/core/config/navigation/role-navigation';

@Component({
  selector: 'app-admin-area',
  templateUrl: './admin-area.html',
  imports: [Layout, RouterOutlet, Chat],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminArea implements OnInit {
  @ViewChild(Chat) chatComponent?: Chat;
  private menuService = inject(Menu);
  private cdr = inject(ChangeDetectorRef);

  role = 'ADMIN';
  isChatOpen = signal(false);

  ngOnInit(): void {
    this.configureAdminMenu();
  }

  toggleChat(): void {
    this.chatComponent?.toggleChat();
    this.isChatOpen.set(this.chatComponent?.isOpen() ?? false);
    this.cdr.markForCheck();
  }

  private configureAdminMenu(): void {
    this.menuService.setMenuItems([...ADMIN_NAV]);
  }
}