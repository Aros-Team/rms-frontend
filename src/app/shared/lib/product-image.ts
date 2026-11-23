export interface ProductImageUrls {
  imageUrl?: string | null;
  imageTabletUrl?: string | null;
  imageDesktopUrl?: string | null;
}

/** Build a responsive srcset from the product image variants the API exposes. */
export function productImageSrcSet(product: ProductImageUrls | null | undefined): string | null {
  if (!product?.imageUrl) return null;
  const entries: string[] = [];
  if (product.imageUrl) entries.push(`${product.imageUrl} 400w`);
  if (product.imageTabletUrl) entries.push(`${product.imageTabletUrl} 800w`);
  if (product.imageDesktopUrl) entries.push(`${product.imageDesktopUrl} 1200w`);
  return entries.length > 1 ? entries.join(', ') : null;
}

export function productImageSrc(
  product: ProductImageUrls | null | undefined,
  fallback = '',
): string {
  return product?.imageUrl ?? fallback;
}
