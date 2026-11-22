/**
 * Vite `?raw` template imports used by the cashier specs.
 *
 * The testing helper is compiled by `tsconfig.app.json` (only `*.spec.ts` is
 * excluded), so its raw-template imports need a module shape. Declarations are
 * scoped to the templates the helper imports: a global `*.html?raw` wildcard
 * would also type every existing spec's raw import and make their
 * `as unknown as string` assertions redundant under strict lint.
 */
declare module '*cashier-area.html?raw' {
  const content: string;
  export default content;
}
declare module '*pending-board.html?raw' {
  const content: string;
  export default content;
}
declare module '*order-charge.html?raw' {
  const content: string;
  export default content;
}
declare module '*receipt.html?raw' {
  const content: string;
  export default content;
}
declare module '*shift-dialog.html?raw' {
  const content: string;
  export default content;
}
declare module '*void-payment-dialog.html?raw' {
  const content: string;
  export default content;
}
declare module '*button.html?raw' {
  const content: string;
  export default content;
}
declare module '*badge.html?raw' {
  const content: string;
  export default content;
}
declare module '*empty-state.html?raw' {
  const content: string;
  export default content;
}
declare module '*icon-button.html?raw' {
  const content: string;
  export default content;
}
declare module '*input.html?raw' {
  const content: string;
  export default content;
}
declare module '*field.html?raw' {
  const content: string;
  export default content;
}
declare module '*section.html?raw' {
  const content: string;
  export default content;
}
declare module '*select.html?raw' {
  const content: string;
  export default content;
}
declare module '*skeleton.html?raw' {
  const content: string;
  export default content;
}
declare module '*dialog.html?raw' {
  const content: string;
  export default content;
}
declare module '*status-pill.html?raw' {
  const content: string;
  export default content;
}
declare module '*page-header.html?raw' {
  const content: string;
  export default content;
}
