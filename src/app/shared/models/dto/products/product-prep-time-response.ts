/** Estimated and measured preparation times returned by `GET /v1/products/{id}/prep-time`. */
export interface ProductPrepTimeResponse {
  estimatedPrepMinutes: number | null;
  realPrepMinutes: number | null;
  realPrepSampleCount: number;
  prepTimeMode: 'ESTIMATED' | 'REAL' | 'AUTO';
  usedPrepMinutes: number;
  usedSource: 'ESTIMATED' | 'REAL';
  minimumSamples: number;
}
