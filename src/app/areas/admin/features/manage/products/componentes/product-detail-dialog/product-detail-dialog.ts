import { Component, inject, Input, Output, EventEmitter, signal, ChangeDetectionStrategy, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '@app/core/services/products/product';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Logging } from '@app/core/services/logging/logging';
import { ProductImage } from '@app/core/services/product-image';
import { ProductImageResponse } from '@app/shared/models/dto/products/product-image-response';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductOption as ProductOptionDTO } from '@app/shared/models/dto/products/product-option.model';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { GalleriaModule } from 'primeng/galleria';
import { ImageModule } from 'primeng/image';
import { FileUploadModule } from 'primeng/fileupload';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-product-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    GalleriaModule,
    ImageModule,
    FileUploadModule,
    ProgressBarModule,
    SkeletonModule,
    TagModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './product-detail-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailDialog implements OnChanges {
  @Input() product: ProductResponse | null = null;
  @Input() visible = signal(false);
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() editProduct = new EventEmitter<number>();
  @Output() productUpdated = new EventEmitter<void>();

  private productService = inject(Product);
  private masterDataService = inject(MasterData);
  private logger = inject(Logging);
  private imageService = inject(ProductImage);
  private messageService = inject(MessageService);

  detailOptions = signal<ProductOptionDTO[]>([]);
  detailOptionsLoading = signal(false);
  productImages = signal<ProductImageResponse[]>([]);
  imagesLoading = signal(false);
  selectedImageIndex = signal(0);
  galleriaVisible = signal(false);
  isUploadingImage = signal(false);
  localUploadProgress = signal(0);
  currencyFormat = Intl.NumberFormat('es-Co', { style: 'currency', currency: 'COP' });

  galleriaResponsiveOptions = [
    { breakpoint: '1024px', numVisible: 5 },
    { breakpoint: '768px', numVisible: 3 }
  ];

  ngOnChanges(): void {
    if (this.product && this.visible()) {
      this.loadProductDetails();
    }
  }

  private loadProductDetails(): void {
    if (!this.product) return;
    this.detailOptionsLoading.set(true);
    this.loadProductImages(this.product.id);
    this.productService.getOptions(this.product.id).pipe(
      catchError(() => of([] as ProductOptionDTO[]))
    ).subscribe(opts => {
      this.detailOptions.set(opts);
      this.detailOptionsLoading.set(false);
    });
  }

  loadProductImages(productId: number): void {
    this.imagesLoading.set(true);
    this.imageService.getImages(productId).pipe(
      catchError(err => {
        this.logger.error('Error loading product images', err);
        return of([]);
      })
    ).subscribe(images => {
      this.productImages.set(images);
      this.imagesLoading.set(false);
    });
  }

  close(): void {
    this.visible.set(false);
    this.visibleChange.emit(false);
  }

  openEditDialog(): void {
    if (this.product) {
      this.editProduct.emit(this.product.id);
      this.close();
    }
  }

  groupByCategory(options: ProductOptionDTO[]): { category: string; items: ProductOptionDTO[] }[] {
    const map = new Map<string, ProductOptionDTO[]>();
    for (const o of options) {
      const arr = map.get(o.optionCategoryName) ?? [];
      arr.push(o);
      map.set(o.optionCategoryName, arr);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }

  openGalleria(index: number): void {
    this.selectedImageIndex.set(index);
    this.galleriaVisible.set(true);
  }

  closeGalleria(): void {
    this.galleriaVisible.set(false);
  }

  getImageUrl(image: ProductImageResponse, type: 'mobile' | 'tablet' | 'desktop' = 'desktop'): string {
    return type === 'mobile' ? image.mobileUrl : type === 'tablet' ? image.tabletUrl : image.desktopUrl;
  }

  onImageSelect(event: { files: File[] }): void {
    const files: File[] = event.files;
    if (files.length === 0 || !this.product) return;

    this.isUploadingImage.set(true);
    this.localUploadProgress.set(0);

    this.imageService.uploadImage(this.product.id, files[0]).subscribe({
      next: (result) => {
        this.localUploadProgress.set(result.progress);
        const image = result.image;
        if (image != null) {
          this.productImages.update(imgs => [...imgs, image]);
        }
      },
      error: (err) => {
        this.logger.error('Error uploading image', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error de upload',
          detail: 'No se pudo subir la imagen'
        });
        this.isUploadingImage.set(false);
      },
      complete: () => {
        this.isUploadingImage.set(false);
        this.localUploadProgress.set(0);
        // Reload to ensure UI shows complete data
        if (this.product) {
          this.loadProductImages(this.product.id);
        }
      }
    });
  }

  confirmDeleteImage(event: Event, image: ProductImageResponse): void {
    if (!this.product) return;
    this.imageService.deleteImage(this.product.id, image.id).pipe(
      catchError(err => {
        this.logger.error('Error deleting image', err);
        return of(false);
      })
    ).subscribe(result => {
      if (result && this.product) {
        this.loadProductImages(this.product.id);
        this.messageService.add({
          severity: 'success',
          summary: 'Imagen eliminada',
          detail: 'La imagen fue eliminada correctamente'
        });
      }
    });
  }
}