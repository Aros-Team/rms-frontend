import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Logging } from '@app/core/services/logging/logging';
import { ProductImageResponse } from '@app/shared/models/dto/products/product-image-response';

@Injectable({
  providedIn: 'root',
})
export class ProductImage {
  private http = inject(HttpClient);
  private logging = inject(Logging);

  readonly uploadProgress = signal(0);
  readonly isUploading = signal(false);
  readonly uploadError = signal<string | null>(null);

  uploadImage(productId: number, file: File): Observable<{ progress: number; image?: ProductImageResponse }> {
    return new Observable((observer) => {
      this.isUploading.set(true);
      this.uploadProgress.set(0);
      this.uploadError.set(null);

      const formData = new FormData();
      formData.append('file', file);

      const sub: Subscription = this.http.post<ProductImageResponse>(
        `v1/products/${String(productId)}/images`,
        formData,
        {
          reportProgress: true,
          observe: 'events',
        }
      ).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            const progress = Math.round((event.loaded * 100) / event.total);
            this.uploadProgress.set(progress);
            observer.next({ progress });
          } else if (event.type === HttpEventType.Response && event.body) {
            this.isUploading.set(false);
            this.uploadProgress.set(100);
            const image = event.body;
            observer.next({ progress: 100, image });
            observer.complete();
          }
        },
        error: (err: unknown) => {
          this.isUploading.set(false);
          this.uploadProgress.set(0);
          const errObj = err as { error?: { message?: string }; message?: string };
          const message = errObj.error?.message ?? errObj.message ?? 'Upload failed';
          this.uploadError.set(message);
          this.logging.error('ProductImage upload failed', err);
          observer.error(err);
        },
      });

      return () => {
        sub.unsubscribe();
      };
    });
  }

  getImages(productId: number): Observable<ProductImageResponse[]> {
    return this.http.get<ProductImageResponse[]>(`v1/products/${String(productId)}/images`);
  }

  deleteImage(productId: number, imageId: number): Observable<unknown> {
    return this.http.delete<unknown>(`v1/products/${String(productId)}/images/${String(imageId)}`);
  }
}