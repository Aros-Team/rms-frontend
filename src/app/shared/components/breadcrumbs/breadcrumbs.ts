import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface Breadcrumb {
  readonly label: string;
  readonly url: string;
  readonly current: boolean;
}

/**
 * Route breadcrumbs derived from the activated route tree.
 *
 * Feature: every nested screen shows where it sits in the IA.
 *
 * Contract:
 *  - labels come from the route `title` (or `data.breadcrumb` when a shorter
 *    label is wanted), so a new route is described by the same metadata that
 *    sets the document title
 *  - the last crumb carries `aria-current="page"` and is not a link
 *  - nothing renders on a top-level screen (one crumb): the shell already
 *    names it
 *
 * Approach: walk the primary outlet snapshot, accumulate URL segments, collapse
 * entries that resolve to the same URL (index routes), render a labelled nav.
 */
@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink],
  templateUrl: './breadcrumbs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Breadcrumbs {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly crumbs = signal<Breadcrumb[]>(this.build(this.router.routerState.snapshot.root));

  constructor() {
    const sub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.crumbs.set(this.build(this.router.routerState.snapshot.root));
      });
    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }

  private build(root: ActivatedRouteSnapshot): Breadcrumb[] {
    const entries: { label: string; url: string }[] = [];
    const segments: string[] = [];

    let node: ActivatedRouteSnapshot | null = root;
    while (node) {
      segments.push(...node.url.map((segment) => segment.path));

      const label = this.labelFor(node);
      if (label && segments.length > 0) {
        entries.push({ label, url: `/${segments.join('/')}` });
      }
      node = node.firstChild;
    }

    const collapsed: { label: string; url: string }[] = [];
    for (const entry of entries) {
      const lastIndex = collapsed.length - 1;
      if (lastIndex >= 0 && collapsed[lastIndex].url === entry.url) {
        collapsed[lastIndex] = entry;
      } else {
        collapsed.push(entry);
      }
    }

    return collapsed.map((entry, index) => ({
      ...entry,
      current: index === collapsed.length - 1,
    }));
  }

  private labelFor(node: ActivatedRouteSnapshot): string | null {
    const fromData: unknown = node.data['breadcrumb'];
    if (typeof fromData === 'string' && fromData.length > 0) {
      return fromData;
    }
    return typeof node.title === 'string' && node.title.length > 0 ? node.title : null;
  }
}
