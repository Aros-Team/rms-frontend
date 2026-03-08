import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-product-card-skeleton',
  standalone: true,
  imports: [CardModule, SkeletonModule],
  template: `
    <p-card styleClass="skeleton-card" aria-hidden="true">
      <ng-template pTemplate="header">
        <p-skeleton styleClass="skeleton-image" />
      </ng-template>
      <ng-template pTemplate="content">
        <p-skeleton width="70%" height="1.2rem" styleClass="skeleton-title" />
        <p-skeleton width="100%" height="0.8rem" styleClass="skeleton-text" />
        <p-skeleton width="60%" height="0.8rem" styleClass="skeleton-text" />
      </ng-template>
      <ng-template pTemplate="footer">
        <div class="skeleton-footer">
          <p-skeleton width="30%" height="1rem" />
          <p-skeleton width="25%" height="2rem" borderRadius="0.6rem" />
        </div>
      </ng-template>
    </p-card>
  `,
  styles: [`
    :host {
      display: block;
    }

    :host ::ng-deep .skeleton-card {
      overflow: hidden;
    }

    :host ::ng-deep .skeleton-image {
      aspect-ratio: 16 / 9;
      border-radius: 0;
    }

    :host ::ng-deep .skeleton-title {
      margin-bottom: 0.6rem;
    }

    :host ::ng-deep .skeleton-text {
      margin-top: 0.5rem;
    }

    .skeleton-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  `],
})
export class ProductCardSkeletonComponent {}
