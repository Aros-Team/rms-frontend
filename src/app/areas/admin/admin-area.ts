import { Component, OnInit, inject, ChangeDetectionStrategy, signal } from '@angular/core';
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
  private menuService = inject(Menu);

  role = 'ADMIN';
  isChatOpen = signal(false);

  ngOnInit(): void {
    this.configureAdminMenu();
  }

  togglePanel(): void {
    this.isChatOpen.update(open => !open);
  }

  private configureAdminMenu(): void {
    this.menuService.setMenuItems([...ADMIN_NAV]);
  }
}
