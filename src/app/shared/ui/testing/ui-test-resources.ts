import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';

/**
 * Test helper: resolves the external templates used by the UI primitives.
 *
 * Angular's TestBed cannot read `templateUrl` from disk in Vitest. Each spec
 * imports the `?raw` templates it needs (including nested primitives) and maps
 * the file name to its contents. Styles resolve to an empty string: they are
 * not executed by the DOM assertions.
 */
export async function resolveUiResources(resources: Record<string, string>): Promise<void> {
  await resolveComponentResources((url: string): Promise<string> => {
    for (const [name, content] of Object.entries(resources)) {
      if (url.endsWith(name)) return Promise.resolve(content);
    }
    return Promise.resolve('');
  });
}

/** Query helper that fails loudly instead of forcing a non-null assertion. */
export function queryElement(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`Expected to find "${selector}"`);
  return element;
}
