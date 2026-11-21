/**
 * Wire shape of `ImageResponse` (`GET /v1/products/{id}/images`,
 * `POST /v1/products/{id}/images`).
 */
export interface ProductImageResponse {
  id: number;
  entityType: 'PRODUCT' | 'USER';
  entityId: number;
  originalFilename: string;
  contentType: string;
  originalSizeBytes: number;
  mobileUrl: string;
  tabletUrl: string;
  desktopUrl: string;
  createdAt: string;
}
