/**
 * Tests for the printable receipt document.
 *
 * Feature: wrap the rendered ticket in a self-contained monochrome document
 * printed from a throw-away iframe.
 * Contract:
 *  - a complete HTML5 document with the Spanish language and the ticket markup;
 *  - print media rules and system colours (Canvas / CanvasText / GrayText), so
 *    the ticket stays legible on paper in any app theme;
 *  - no dependency on the application stylesheet.
 *
 * Approach: build the document from a small ticket string and assert its parts.
 */
import { describe, expect, it } from 'vitest';

import { buildReceiptDocument } from './receipt-document';

describe('buildReceiptDocument', () => {
  const ticket = '<article class="receipt-ticket"><p>R-20261121-000001</p></article>';

  it('emits a complete Spanish HTML document', () => {
    const html = buildReceiptDocument(ticket);

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('</html>');
  });

  it('embeds the rendered ticket markup', () => {
    expect(buildReceiptDocument(ticket)).toContain(ticket);
  });

  it('includes print rules and monochrome system colours', () => {
    const html = buildReceiptDocument(ticket);

    expect(html).toContain('@page');
    expect(html).toContain('CanvasText');
    expect(html).toContain('GrayText');
  });

  it('does not depend on the application stylesheet', () => {
    expect(buildReceiptDocument(ticket)).not.toContain('styles.css');
  });
});
