import { CommonModule, CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ProductCardActionPayload, ProductCardViewModel } from './product-card.model';
import { RmsButtonComponent } from '../button/rms-button.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, NgOptimizedImage, CardModule, TagModule, RmsButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card styleClass="product-card" [class.product-card--disabled]="!canAdd">
      <ng-template pTemplate="header">
        <div class="image-wrap">
          <img
            [ngSrc]="product().imageUrl || fallbackImage"
            [alt]="'Imagen de ' + product().name"
            width="800"
            height="450"
            loading="lazy"
          />
          <p-tag
            [value]="product().isActive ? 'Activo' : 'Inactivo'"
            [severity]="product().isActive ? 'success' : 'danger'"
            class="status-tag"
          />
        </div>
      </ng-template>

      <ng-template pTemplate="content">
        <header class="card-header">
          <h3>{{ product().name }}</h3>
          <p>{{ product().description }}</p>
        </header>

        @if (product().tags?.length) {
          <div class="tags">
            @for (tag of product().tags; track tag) {
              <p-tag [value]="tag" severity="info" [rounded]="true" />
            }
          </div>
        }
      </ng-template>

      <ng-template pTemplate="footer">
        <div class="card-footer">
          <div class="pricing">
            <strong>{{ product().price | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
            <small [class.stock-warn]="product().stock <= 3">
              Stock: {{ product().stock }}
            </small>
          </div>

          <div class="actions">
            <rms-button
              [label]="'Detalle'"
              [severity]="'secondary'"
              [outlined]="true"
              [disabled]="!canAdd"
              (onClick)="details.emit({ productId: product().id })"
            />
            <rms-button
              [label]="canAdd ? 'Agregar' : 'No disponible'"
              [severity]="'primary'"
              [disabled]="!canAdd"
              (onClick)="add.emit({ productId: product().id })"
            />
          </div>
        </div>
      </ng-template>
    </p-card>
  `,
  styles: [`
    :host {
      display: block;
    }

    :host ::ng-deep .product-card {
      overflow: hidden;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }

    :host ::ng-deep .product-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 14px 26px rgba(8, 42, 68, 0.14);
    }

    :host ::ng-deep .product-card--disabled {
      opacity: 0.82;
    }

    .image-wrap {
      position: relative;
      aspect-ratio: 16 / 9;
      background: var(--p-surface-100);
    }

    .image-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .status-tag {
      position: absolute;
      top: 0.65rem;
      right: 0.65rem;
    }

    .card-header h3 {
      margin: 0;
      font-size: 1.05rem;
      color: var(--p-surface-900);
    }

    .card-header p {
      margin: 0.35rem 0 0;
      color: var(--p-surface-600);
      line-height: 1.35;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: 0.75rem;
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
    }

    .pricing {
      display: grid;
      gap: 0.15rem;
    }

    .pricing strong {
      font-size: 1.15rem;
      color: var(--p-surface-900);
    }

    .pricing small {
      color: var(--p-surface-600);
    }

    .stock-warn {
      color: var(--p-warning-600);
    }

    .actions {
      display: flex;
      gap: 0.45rem;
    }
  `],
})
export class ProductCardComponent {
  readonly fallbackImage =
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80';

  readonly product = input.required<ProductCardViewModel>();

  readonly add = output<ProductCardActionPayload>();
  readonly details = output<ProductCardActionPayload>();

  get canAdd(): boolean {
    return this.product().isActive && this.product().stock > 0;
  }
}
