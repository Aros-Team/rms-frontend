/**
 * Tests for the RmsEmptyState primitive.
 *
 * Feature: empty state with a reason and one or two real actions.
 * Contract:
 *  - title and message render; the icon is decorative
 *  - the primary action emits `action`
 *  - the secondary action is a link-styled button and emits `secondaryAction`
 *
 * Approach: mount a host template that binds the outputs, click the rendered
 * buttons and assert the emitted events.
 */
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsEmptyState } from './empty-state';
import { resolveUiResources } from '../testing/ui-test-resources';
import emptyStateHtml from './empty-state.html?raw';
import buttonHtml from '../button/button.html?raw';

@Component({
  standalone: true,
  imports: [RmsEmptyState],
  template: `
    <app-rms-empty-state
      title="No hay pedidos hoy"
      message="Aún no se registran pedidos para este día."
      actionLabel="Crear pedido"
      secondaryLabel="Ver pedidos de ayer"
      (action)="primaryClicks = primaryClicks + 1"
      (secondaryAction)="secondaryClicks = secondaryClicks + 1"
    />
  `,
})
class EmptyStateHost {
  primaryClicks = 0;
  secondaryClicks = 0;
}

describe('RmsEmptyState', () => {
  let fixture: ComponentFixture<EmptyStateHost>;
  let host: EmptyStateHost;

  beforeAll(async () => {
    await resolveUiResources({
      'empty-state.html': emptyStateHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
    });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [EmptyStateHost] }).compileComponents();
    fixture = TestBed.createComponent(EmptyStateHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the title, message and a decorative icon', () => {
    const title = (fixture.nativeElement as HTMLElement).querySelector('.rms-empty__title');
    const message = (fixture.nativeElement as HTMLElement).querySelector('.rms-empty__message');
    const icon = (fixture.nativeElement as HTMLElement).querySelector('.rms-empty__icon');

    expect(title?.textContent.trim()).toBe('No hay pedidos hoy');
    expect(message?.textContent.trim()).toBe('Aún no se registran pedidos para este día.');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('emits the primary action when its button is clicked', () => {
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button');
    buttons[0].click();

    expect(host.primaryClicks).toBe(1);
  });

  it('emits the secondary action from the link-style button', () => {
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button');
    buttons[1].click();

    expect(host.secondaryClicks).toBe(1);
  });
});
