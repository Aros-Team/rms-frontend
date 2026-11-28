/**
 * Tolerant pagination adapter.
 *
 * The backend exposes three different pagination dialects, all of them at the
 * same time and none of them negotiable:
 *
 *  1. `{ items, total, page, size, total_pages }`  → GET /v1/orders
 *  2. Spring HATEOAS `{ content, page: { size, totalElements, totalPages, number } }`
 *     → GET /v1/products, /v1/supplies, /v1/supplies/variants,
 *       /v1/admin/special-selections/{id}/history
 *  3. Bare arrays → everything else
 *
 * `unwrapPage()` normalizes all of them (plus `null`/`undefined`, which is what
 * an empty body yields) into one shape so callers never branch on the dialect.
 */

/** Spring HATEOAS `page` metadata block. */
export interface PageMeta {
  number?: number | null;
  size?: number | null;
  totalElements?: number | null;
  totalPages?: number | null;
}

/** Union of every pagination envelope field the backend may send. */
export interface PageEnvelope<T> {
  /** Dialect 1 — `/v1/orders`. */
  items?: T[] | null;
  total?: number | null;
  /** Spring HATEOAS page number, or the object form of dialect 2. */
  page?: number | PageMeta | null;
  size?: number | null;
  total_pages?: number | null;

  /** Dialect 2 — Spring HATEOAS. */
  content?: T[] | null;
  totalElements?: number | null;
  number?: number | null;
  totalPages?: number | null;
}

/** Normalized page, identical for every dialect. */
export interface Page<T> {
  items: T[];
  total: number;
  /** Zero-based page index. */
  page: number;
  /** Requested page size (or item count for bare arrays). */
  size: number;
  totalPages: number;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstNumber(candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    const value = toNumberOrNull(candidate);
    if (value !== null) return value;
  }
  return null;
}

/**
 * Normalizes any supported pagination shape into `Page<T>`.
 *
 * Never throws: an unknown body degrades to an empty page.
 */
export function unwrapPage<T>(res: PageEnvelope<T> | T[] | null | undefined): Page<T> {
  if (res === null || res === undefined) {
    return { items: [], total: 0, page: 0, size: 0, totalPages: 0 };
  }

  // Dialect 3: bare array.
  if (Array.isArray(res)) {
    const items = res;
    return {
      items,
      total: items.length,
      page: 0,
      size: items.length,
      totalPages: items.length > 0 ? 1 : 0,
    };
  }

  // Dialects 1 and 2: pick whichever collection field is present.
  const rawItems = Array.isArray(res.items)
    ? res.items
    : Array.isArray(res.content)
      ? res.content
      : [];
  const meta: PageMeta | null = typeof res.page === 'object' && res.page !== null ? res.page : null;

  const total = firstNumber([res.total, res.totalElements, meta?.totalElements]) ?? rawItems.length;
  const page =
    firstNumber([typeof res.page === 'number' ? res.page : null, res.number, meta?.number]) ?? 0;
  const size = firstNumber([res.size, meta?.size]) ?? rawItems.length;
  const totalPages =
    firstNumber([res.total_pages, res.totalPages, meta?.totalPages]) ??
    (size > 0 ? Math.ceil(total / size) : 0);

  return { items: rawItems, total, page, size, totalPages };
}
