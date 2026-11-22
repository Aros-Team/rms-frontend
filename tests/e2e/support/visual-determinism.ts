import type { Locator, Page } from '@playwright/test';

/**
 * Visual determinism helpers (P1-QA-09).
 *
 * Two layers keep data-heavy snapshots stable across days while preserving the
 * layout under test:
 *
 *  1. Freeze the browser clock to the seed anchor (2026-11-21, 12:00 Bogota).
 *     Dashboard totals, period selectors and "today" ranges are computed from
 *     `new Date()` in the client, so a moving clock would silently change the
 *     queried window even with perfect masking.
 *  2. Mask every visible leaf that contains a digit (dates, clock, totals,
 *     order ids, KPI values, relative times, counts), plus chart canvases and
 *     toasts. Static labels, cards and table structure remain visible.
 */
// Late in the seed anchor day: includes the day's orders while staying in the
// past for the API, which rejects an endDate after its own clock.
const SEED_ANCHOR = '2026-11-21T20:00:00-05:00';

const FREEZE_CLOCK = `
  (() => {
    const fixed = new Date('${SEED_ANCHOR}').valueOf();
    const RealDate = Date;
    class FrozenDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fixed);
        } else {
          super(...args);
        }
      }
      static now() {
        return fixed;
      }
    }
    Object.setPrototypeOf(FrozenDate, RealDate);
    window.Date = FrozenDate;
  })();
`;

export async function freezeClock(page: Page): Promise<void> {
  await page.addInitScript({ content: FREEZE_CLOCK });
}

/** Tag dynamic leaves just before the screenshot and return the mask locators. */
export async function visualMasks(page: Page): Promise<Locator[]> {
  await page.evaluate(() => {
    const DYNAMIC = 'pw-visual-dynamic';
    document.querySelectorAll(`.${DYNAMIC}`).forEach((el) => el.classList.remove(DYNAMIC));

    const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CANVAS', 'SVG', 'PATH', 'MAT-DIALOG-CONTAINER']);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const el = node as Element;
      if (!skip.has(el.tagName) && el.childElementCount === 0) {
        const text = (el.textContent ?? '').trim();
        // Any digit covers dates, clocks, money, ids, counts and KPI values.
        // Pure labels ("Ventas del Día") stay visible.
        if (text && /\d/.test(text)) {
          el.classList.add(DYNAMIC);
        }
      }
      node = walker.nextNode();
    }
  });

  return [
    page.locator('.pw-visual-dynamic'),
    page.locator('p-chart canvas'),
    page.locator('.p-toast'),
    page.locator('.p-toast-message'),
    // Form values can carry dates, money and seed data even when their labels
    // are static (for example the cashier "Fecha" picker and recipe price).
    page.locator('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])'),
    page.locator('textarea'),
    page.locator('select'),
  ];
}
