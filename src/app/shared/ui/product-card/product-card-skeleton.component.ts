import { Component } from '@angular/core';

@Component({
  selector: 'app-product-card-skeleton',
  standalone: true,
  template: `
    <article class="card-skeleton" aria-hidden="true">
      <div class="s-line s-image"></div>
      <div class="content">
        <div class="s-line s-title"></div>
        <div class="s-line s-text"></div>
        <div class="s-line s-text short"></div>
        <div class="s-footer">
          <div class="s-line s-price"></div>
          <div class="s-line s-button"></div>
        </div>
      </div>
    </article>
  `,
  styles: [
    `
      .card-skeleton {
        border: 1px solid #d3e3ef;
        border-radius: 1rem;
        overflow: hidden;
        background: #ffffff;
      }

      .content {
        padding: 0.9rem;
      }

      .s-line {
        border-radius: 0.55rem;
        background: linear-gradient(90deg, #e6eff7 25%, #f6fbff 37%, #e6eff7 63%);
        background-size: 400% 100%;
        animation: shine 1.2s ease infinite;
      }

      .s-image {
        aspect-ratio: 16 / 9;
      }

      .s-title {
        height: 1.15rem;
        margin-top: 0.2rem;
      }

      .s-text {
        height: 0.75rem;
        margin-top: 0.6rem;
      }

      .short {
        width: 68%;
      }

      .s-footer {
        margin-top: 0.9rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .s-price {
        width: 35%;
        height: 1rem;
      }

      .s-button {
        width: 30%;
        height: 1.85rem;
      }

      @keyframes shine {
        0% {
          background-position: 100% 0;
        }
        100% {
          background-position: 0 0;
        }
      }
    `,
  ],
})
export class ProductCardSkeletonComponent {}
