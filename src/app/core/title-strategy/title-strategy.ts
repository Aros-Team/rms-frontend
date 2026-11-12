import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/**
 * Sets the document title from the deepest activated route's `title`,
 * suffixed with the app name.
 *
 * Without this every route kept the static `<title>` from index.html, so all
 * tabs, bookmarks and screen-reader page announcements said "Dashboard | RMS"
 * no matter where the user was.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    this.title.setTitle(routeTitle ? `${routeTitle} | RMS` : 'RMS');
  }
}
