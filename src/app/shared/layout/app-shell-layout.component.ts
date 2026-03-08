import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShellHeaderComponent } from './shell-header.component';
import { ShellSidebarComponent } from './shell-sidebar.component';

@Component({
  selector: 'app-shell-layout',
  standalone: true,
  imports: [RouterOutlet, ShellHeaderComponent, ShellSidebarComponent],
  template: `
    <main class="shell-layout">
      <app-shell-sidebar></app-shell-sidebar>

      <section class="shell-content">
        <app-shell-header></app-shell-header>
        <router-outlet></router-outlet>
      </section>
    </main>
  `,
  styles: [
    `
      .shell-layout {
        min-height: 100dvh;
        max-width: 1600px;
        margin: 0 auto;
        padding: 1rem;
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 1rem;
        background: var(--p-surface-950);
      }

      .shell-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      @media (max-width: 768px) {
        .shell-layout {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AppShellLayoutComponent {}
