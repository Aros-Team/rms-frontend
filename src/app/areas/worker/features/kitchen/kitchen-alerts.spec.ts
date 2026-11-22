/**
 * Tests for the kitchen new-order alert.
 *
 * Feature: a new QUEUE order is announced with an optional sound and haptic,
 * and the mute preference survives a reload.
 * Contract:
 *  - the preference is persisted in localStorage and restored on construction;
 *  - a muted board never plays a cue;
 *  - a suspended AudioContext reports `blocked` and resumes after a gesture;
 *  - a missing AudioContext degrades to `unsupported` instead of throwing.
 */
import { TestBed } from '@angular/core/testing';

import { Logging } from '@app/core/services/logging/logging';
import { KitchenAlerts } from './kitchen-alerts';

const STORAGE_KEY = 'rms.kitchen.alerts.muted';

class FakeAudioParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeOscillator {
  type = 'sine';
  frequency = new FakeAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  addEventListener = vi.fn();
}

class FakeGain {
  gain = new FakeAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeAudioContext {
  static instances = 0;
  static last: FakeAudioContext | null = null;
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = {};
  oscillators = 0;
  resume = vi.fn(() => Promise.resolve());

  constructor() {
    FakeAudioContext.instances += 1;
    FakeAudioContext.last = this;
  }

  createOscillator(): FakeOscillator {
    this.oscillators += 1;
    return new FakeOscillator();
  }

  createGain(): FakeGain {
    return new FakeGain();
  }
}

function configure(): KitchenAlerts {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: Logging,
        useValue: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      },
    ],
  });
  return TestBed.inject(KitchenAlerts);
}

describe('KitchenAlerts', () => {
  beforeEach(() => {
    localStorage.clear();
    FakeAudioContext.instances = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to sound on', () => {
    const alerts = configure();
    expect(alerts.muted()).toBe(false);
    expect(alerts.blocked()).toBe(false);
  });

  it('persists the mute flag and reads it back on the next construction', () => {
    const first = configure();
    first.setMuted(true);

    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
    expect(first.muted()).toBe(true);

    const second = configure();
    expect(second.muted()).toBe(true);
  });

  it('toggles and arms audio when unmuting', () => {
    const alerts = configure();
    const arm = vi.spyOn(alerts, 'arm');

    alerts.setMuted(true);
    alerts.toggle();

    expect(alerts.muted()).toBe(false);
    expect(arm).toHaveBeenCalled();
  });

  it('never plays a cue while muted', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const alerts = configure();
    alerts.setMuted(true);

    expect(alerts.notify()).toBe('muted');
    expect(FakeAudioContext.instances).toBe(0);
  });

  it('degrades to unsupported when the platform has no AudioContext', () => {
    const alerts = configure();
    expect(alerts.notify()).toBe('unsupported');
  });

  it('plays two tones when the context is running', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const alerts = configure();

    expect(alerts.notify()).toBe('played');
    expect(alerts.blocked()).toBe(false);
    expect(FakeAudioContext.instances).toBe(1);
  });

  it('reports blocked on a suspended context and resumes after a gesture', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const alerts = configure();
    // The first notify() creates the context; make it suspended before use.
    expect(alerts.notify()).toBe('played');
    const context = FakeAudioContext.last;
    if (!context) throw new Error('Expected an AudioContext');
    context.state = 'suspended';

    expect(alerts.notify()).toBe('blocked');
    expect(alerts.blocked()).toBe(true);

    alerts.arm();
    await Promise.resolve();

    expect(context.resume).toHaveBeenCalled();
    expect(alerts.blocked()).toBe(false);
  });
});
