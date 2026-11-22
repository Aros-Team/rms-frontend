import type { CanDeactivateFn } from '@angular/router';

import type { SettingsPage } from './settings-page';

/**
 * Blocks leaving `/admin/settings` while a section has unsaved edits.
 *
 * Delegates to the page, which owns the confirmation dialog and resolves the
 * guard promise when the admin either discards or keeps editing. Navigation with
 * a clean form resolves synchronously.
 */
export const settingsUnsavedChangesGuard: CanDeactivateFn<SettingsPage> = (component) =>
  component.confirmDiscard();
