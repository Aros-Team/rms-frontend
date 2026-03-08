import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-shell-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <p class="nav-title">Navegacion</p>

      <nav class="nav-grid">
        @for (let item of navItems; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.path === '' }"
            class="nav-link"
          >
            <i [class]="item.icon"></i>
            <span>{{ item.label }}</span>
          </a>
        }
      </nav>
    </aside>
  `,
  styles: [
    `
      .sidebar {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 1rem;
        padding: 1rem;
      }

      .nav-title {
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #64748b;
        margin: 0 0 0.75rem 0.5rem;
      }

      .nav-grid {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .nav-link {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.65rem 0.75rem;
        border-radius: 0.75rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #94a3b8;
        text-decoration: none;
        transition: all 0.15s;
      }

      .nav-link:hover {
        background: #1e293b;
        color: #e2e8f0;
      }

      .nav-link.active {
        background: #f1f5f9;
        color: #0f172a;
      }

      .nav-link i {
        font-size: 1rem;
      }
    `,
  ],
})
export class ShellSidebarComponent {
  readonly navItems: NavItem[] = [
    { label: 'Nueva Orden', path: '', icon: 'pi pi-plus' },
    { label: 'Pedidos', path: 'orders', icon: 'pi pi-list' },
    { label: 'Productos', path: 'products', icon: 'pi pi-box' },
    { label: 'Mesas', path: 'tables', icon: 'pi pi-th-large' },
  ];
}
