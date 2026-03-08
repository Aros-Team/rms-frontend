import { CommonModule, CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ProductCardActionPayload, ProductCardViewModel } from './product-card.model';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" [class.card--disabled]="!product().isActive || product().stock <= 0">
      <div class="image-wrap">
        <img
          [ngSrc]="product().imageUrl || fallbackImage"
          [alt]="'Imagen de ' + product().name"
          width="800"
          height="450"
          loading="lazy"
        />
        <span class="status" [class.status--off]="!product().isActive">
          {{ product().isActive ? 'Activo' : 'Inactivo' }}
        </span>
      </div>

      <div class="content">
        <header>
          <h3>{{ product().name }}</h3>
          <p>{{ product().description }}</p>
        </header>

        @if (product().tags?.length) {
          <ul class="tags">
            @for (tag of product().tags; track tag) {
              <li>{{ tag }}</li>
            }
          </ul>
        }

        <footer>
          <div class="pricing">
            <strong>{{ product().price | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
            <small [class.stock--warn]="product().stock <= 3">
              Stock: {{ product().stock }}
            </small>
          </div>

          <div class="actions">
            <button
              type="button"
              class="btn btn--ghost"
              (click)="details.emit({ productId: product().id })"
              [attr.aria-label]="'Ver detalles de ' + product().name"
            >
              Detalle
            </button>
            <button
              type="button"
              class="btn"
              (click)="add.emit({ productId: product().id })"
              [disabled]="!canAdd"
              [attr.aria-label]="'Agregar ' + product().name + ' a la orden'"
            >
              {{ canAdd ? 'Agregar' : 'No disponible' }}
            </button>
          </div>
        </footer>
      </div>
    </article>
  `,
  styles: [
    `
      .card {
        border: 1px solid #c6dced;
        border-radius: 1rem;
        background: linear-gradient(180deg, #ffffff, #f8fcff);
        overflow: hidden;
        box-shadow: 0 10px 22px rgba(8, 42, 68, 0.08);
        transition: transform 180ms ease, box-shadow 180ms ease;
      }

      .card:hover {
        transform: translateY(-3px);
        box-shadow: 0 14px 26px rgba(8, 42, 68, 0.14);
      }

      .card--disabled {
        opacity: 0.82;
      }

      .image-wrap {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #e4edf4;
      }

      .image-wrap img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .status {
        position: absolute;
        top: 0.65rem;
        right: 0.65rem;
        background: #0a6f3f;
        color: #f4fff8;
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        border-radius: 999px;
        padding: 0.2rem 0.55rem;
      }

      .status--off {
        background: #7c1d1d;
        color: #fff2f2;
      }

      .content {
        padding: 0.9rem;
        display: grid;
        gap: 0.75rem;
      }

      h3 {
        margin: 0;
        font-size: 1.05rem;
      }

      p {
        margin: 0.35rem 0 0;
        color: #3a556b;
        line-height: 1.35;
      }

      .tags {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }

      .tags li {
        background: #e4f2ff;
        color: #17456a;
        border-radius: 0.45rem;
        padding: 0.2rem 0.45rem;
        font-size: 0.76rem;
      }

      footer {
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
        color: #073452;
      }

      .pricing small {
        color: #2b556f;
      }

      .stock--warn {
        color: #8f4b05;
      }

      .actions {
        display: flex;
        gap: 0.45rem;
      }

      .btn {
        border: 1px solid #0f4f78;
        border-radius: 0.6rem;
        background: #0f4f78;
        color: #ffffff;
        font-weight: 600;
        padding: 0.45rem 0.7rem;
        cursor: pointer;
      }

      .btn:hover:not(:disabled) {
        background: #0c4468;
      }

      .btn:focus-visible {
        outline: 2px solid #0f4f78;
        outline-offset: 2px;
      }

      .btn--ghost {
        background: transparent;
        color: #0f4f78;
      }

      .btn:disabled {
        cursor: not-allowed;
        opacity: 0.65;
      }
    `,
  ],
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
