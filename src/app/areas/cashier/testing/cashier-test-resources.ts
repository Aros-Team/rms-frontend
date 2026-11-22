import { resolveUiResources } from '@app/shared/ui/testing/ui-test-resources';

import cashierAreaHtml from '../cashier-area.html?raw';
import pendingBoardHtml from '../components/pending-board/pending-board.html?raw';
import orderChargeHtml from '../components/order-charge/order-charge.html?raw';
import receiptHtml from '../components/receipt/receipt.html?raw';
import shiftDialogHtml from '../components/shift-dialog/shift-dialog.html?raw';
import voidDialogHtml from '../components/void-payment-dialog/void-payment-dialog.html?raw';
import buttonHtml from '../../../shared/ui/button/button.html?raw';
import badgeHtml from '../../../shared/ui/badge/badge.html?raw';
import emptyStateHtml from '../../../shared/ui/empty-state/empty-state.html?raw';
import iconButtonHtml from '../../../shared/ui/icon-button/icon-button.html?raw';
import inputHtml from '../../../shared/ui/input/input.html?raw';
import fieldHtml from '../../../shared/ui/field/field.html?raw';
import sectionHtml from '../../../shared/ui/section/section.html?raw';
import selectHtml from '../../../shared/ui/select/select.html?raw';
import skeletonHtml from '../../../shared/ui/skeleton/skeleton.html?raw';
import dialogHtml from '../../../shared/ui/dialog/dialog.html?raw';
import statusPillHtml from '../../../shared/ui/status-pill/status-pill.html?raw';
import pageHeaderHtml from '../../../shared/ui/page-header/page-header.html?raw';

/**
 * External template registry for the cashier specs.
 *
 * Angular's JIT TestBed cannot read `templateUrl` from disk, so every template
 * used by the component under test (its own and the design-system primitives /
 * child components it renders) must be provided.
 *
 * Order matters: `resolveUiResources` resolves with `endsWith`, so the most
 * specific names go first (`shift-dialog.html` before `dialog.html`,
 * `icon-button.html` before `button.html`). Otherwise the wrong template would
 * be injected silently.
 */
const CASHIER_TEMPLATES: Record<string, string> = {
  'shift-dialog.html': shiftDialogHtml as unknown as string,
  'void-payment-dialog.html': voidDialogHtml as unknown as string,
  'order-charge.html': orderChargeHtml as unknown as string,
  'pending-board.html': pendingBoardHtml as unknown as string,
  'cashier-area.html': cashierAreaHtml as unknown as string,
  'receipt.html': receiptHtml as unknown as string,
  'icon-button.html': iconButtonHtml as unknown as string,
  'empty-state.html': emptyStateHtml as unknown as string,
  'page-header.html': pageHeaderHtml as unknown as string,
  'status-pill.html': statusPillHtml as unknown as string,
  'skeleton.html': skeletonHtml as unknown as string,
  'select.html': selectHtml as unknown as string,
  'section.html': sectionHtml as unknown as string,
  'field.html': fieldHtml as unknown as string,
  'input.html': inputHtml as unknown as string,
  'badge.html': badgeHtml as unknown as string,
  'button.html': buttonHtml as unknown as string,
  'dialog.html': dialogHtml as unknown as string,
};

/** Resolves the cashier + design-system templates for a JIT TestBed. */
export async function resolveCashierResources(): Promise<void> {
  await resolveUiResources(CASHIER_TEMPLATES);
}

/** Finds a rendered button by its visible label, failing loudly. */
export function buttonByText(root: ParentNode, label: string): HTMLButtonElement {
  const buttons = Array.from(root.querySelectorAll('button'));
  const match = buttons.find((button) => button.textContent.trim() === label);
  if (match === undefined) throw new Error(`Button "${label}" not found`);
  return match;
}

/** Sets a native input value and dispatches the input event Angular listens to. */
export function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
