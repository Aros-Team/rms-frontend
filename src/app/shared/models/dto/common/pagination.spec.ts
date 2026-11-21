/**
 * Tests for the pagination adapter.
 *
 * Feature: Normalizes the three pagination dialects the backend emits into one
 *          `Page<T>` shape.
 * Contract:
 *  - `{ items, total, page, size, total_pages }` → items/total/page/size/totalPages
 *  - HATEOAS `{ content, page: { size, totalElements, totalPages, number } }`
 *  - bare array → total = length, page 0, size = length, totalPages = 1
 *  - null / undefined → empty page
 * Approach: Call `unwrapPage()` with handwritten wire fixtures and assert the
 * normalized output (pure function, no TestBed).
 */
import { describe, expect, it } from 'vitest';

import { unwrapPage } from './pagination';

describe('unwrapPage', () => {
  it('normalizes the /v1/orders dialect', () => {
    const res = {
      items: [{ id: 1 }, { id: 2 }],
      total: 42,
      page: 2,
      size: 2,
      total_pages: 21,
    };

    const page = unwrapPage(res);

    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(42);
    expect(page.page).toBe(2);
    expect(page.size).toBe(2);
    expect(page.totalPages).toBe(21);
  });

  it('normalizes the Spring HATEOAS dialect', () => {
    const res = {
      content: [{ id: 'a' }],
      page: { size: 20, totalElements: 61, totalPages: 4, number: 3 },
    };

    const page = unwrapPage(res);

    expect(page.items).toEqual([{ id: 'a' }]);
    expect(page.total).toBe(61);
    expect(page.page).toBe(3);
    expect(page.size).toBe(20);
    expect(page.totalPages).toBe(4);
  });

  it('derives totalPages when the backend omits it', () => {
    const page = unwrapPage({ items: [{ id: 1 }], total: 25, page: 0, size: 10 });

    expect(page.totalPages).toBe(3);
  });

  it('accepts a bare array', () => {
    const page = unwrapPage([{ id: 1 }, { id: 2 }, { id: 3 }]);

    expect(page.items).toHaveLength(3);
    expect(page.total).toBe(3);
    expect(page.page).toBe(0);
    expect(page.size).toBe(3);
    expect(page.totalPages).toBe(1);
  });

  it('returns an empty page for an empty array', () => {
    expect(unwrapPage([])).toEqual({ items: [], total: 0, page: 0, size: 0, totalPages: 0 });
  });

  it('returns an empty page for null', () => {
    expect(unwrapPage(null)).toEqual({ items: [], total: 0, page: 0, size: 0, totalPages: 0 });
  });

  it('returns an empty page for undefined', () => {
    expect(unwrapPage(undefined)).toEqual({ items: [], total: 0, page: 0, size: 0, totalPages: 0 });
  });

  it('tolerates an unknown body without throwing', () => {
    const page = unwrapPage({} as never);

    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });
});
