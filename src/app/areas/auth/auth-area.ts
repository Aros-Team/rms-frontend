import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Unified public/auth shell.
 *
 * Feature: login, two-factor, forgot password, reset password and account
 * setup share one frame (brand header, one column, footer) instead of four
 * different layouts.
 *
 * Contract:
 *  - one `<main id="main">` landmark and skip link per auth page
 *  - the brand is not a heading; each page owns its own `<h1>`
 *  - at 320px the column never overflows horizontally
 */
@Component({
  selector: 'app-auth',
  templateUrl: './auth.html',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Auth {
  readonly area = 'auth';
}
