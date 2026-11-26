/**
 * Wire shape of `ImageResponse` for worker portraits
 * (`GET|POST|PUT /v1/workers/{id}/images`).
 */
export interface WorkerImageResponse {
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
