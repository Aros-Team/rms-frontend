/**
 * Printable document for the receipt.
 *
 * The receipt is printed through a throw-away iframe instead of a global
 * `@media print` stylesheet: the cashier shell, dialogs and navigation must not
 * appear (or leave blank pages), and a feature lane may not edit the global
 * stylesheet. System colours (`Canvas`, `CanvasText`, `GrayText`) keep the
 * ticket monochrome on paper regardless of the app theme.
 *
 * `ticketHtml` is the already-rendered (and therefore HTML-escaped) receipt
 * article from the DOM.
 */
const RECEIPT_DOCUMENT_CSS = `
@page { margin: 8mm; }
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: Canvas;
  color: CanvasText;
}
body {
  font-family: ui-monospace, "Courier New", monospace;
  font-size: 10pt;
  line-height: 1.35;
}
.receipt-ticket {
  width: 78mm;
  margin: 0 auto;
}
.receipt-ticket__header {
  text-align: center;
  padding-block-end: 2mm;
  border-block-end: 1px dashed GrayText;
  margin-block-end: 2mm;
}
.receipt-ticket__brand,
.receipt-ticket__title,
.receipt-ticket__number,
.receipt-ticket__thanks,
.receipt-ticket__void,
.receipt-ticket__note {
  margin: 0;
}
.receipt-ticket__brand { font-weight: 700; letter-spacing: 0.12em; }
.receipt-ticket__number { font-weight: 700; }
.receipt-ticket__void {
  margin-block-start: 1mm;
  border: 1px solid CanvasText;
  padding: 1mm;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.receipt-ticket__meta,
.receipt-ticket__totals {
  display: block;
  margin: 0;
  padding-block: 1mm;
}
.receipt-ticket__meta div,
.receipt-ticket__totals div {
  display: flex;
  justify-content: space-between;
  gap: 4mm;
}
.receipt-ticket__meta dt,
.receipt-ticket__meta dd,
.receipt-ticket__totals dt,
.receipt-ticket__totals dd {
  margin: 0;
}
.receipt-ticket__meta { border-block-end: 1px dashed GrayText; margin-block-end: 2mm; }
.receipt-ticket__items {
  width: 100%;
  border-collapse: collapse;
  margin-block-end: 2mm;
}
.receipt-ticket__items th,
.receipt-ticket__items td {
  padding: 0.8mm 0;
  text-align: start;
  vertical-align: top;
}
.receipt-ticket__items .receipt-ticket__qty { text-align: center; }
.receipt-ticket__items .receipt-ticket__line-total { text-align: end; }
.receipt-ticket__item-extra {
  display: block;
  color: GrayText;
}
.receipt-ticket__totals { border-block-start: 1px dashed GrayText; }
.receipt-ticket__totals .receipt-ticket__grand-total {
  border-block-start: 1px solid CanvasText;
  margin-block-start: 1mm;
  padding-block-start: 1mm;
  font-weight: 700;
}
.receipt-ticket__tenders {
  border-block-start: 1px dashed GrayText;
  padding-block: 1mm;
}
.receipt-ticket__tender {
  display: flex;
  justify-content: space-between;
  gap: 4mm;
}
.receipt-ticket__tender-ref { display: block; color: GrayText; }
.receipt-ticket__void-info {
  margin-block-start: 2mm;
  padding-block-start: 1mm;
  border-block-start: 1px dashed GrayText;
}
.receipt-ticket__thanks {
  margin-block-start: 3mm;
  text-align: center;
}
`;

/** Builds the self-contained HTML document printed by the receipt dialog. */
export function buildReceiptDocument(ticketHtml: string): string {
  return [
    '<!doctype html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="utf-8">',
    '<title>Recibo</title>',
    `<style>${RECEIPT_DOCUMENT_CSS}</style>`,
    '</head>',
    `<body>${ticketHtml}</body>`,
    '</html>',
  ].join('');
}
