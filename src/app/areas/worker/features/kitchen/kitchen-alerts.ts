import { Injectable, inject, signal } from '@angular/core';

import { Logging } from '@app/core/services/logging/logging';

const STORAGE_KEY = 'rms.kitchen.alerts.muted';

export type KitchenAlertResult = 'played' | 'muted' | 'blocked' | 'unsupported';

interface AudioContextWindow {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

function readMuted(): boolean {
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Storage can be blocked (private mode, embedded browser): default to sound on.
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // Persisting the preference is best-effort; the toggle still works in-session.
  }
}

/**
 * Kitchen new-order alert.
 *
 * Sound is never autoplayed on page load: the AudioContext is created lazily
 * and resumed on the first user gesture (`arm()`), which the component calls on
 * the first pointer/key event. If the browser still blocks it, `notify()`
 * returns `blocked` and the board shows a non-blocking hint instead of failing
 * silently or hijacking the UI.
 *
 * The mute flag is persisted in `localStorage` under
 * `rms.kitchen.alerts.muted` (goal: mute toggle persisted).
 * A short vibration accompanies the beep where the platform supports it.
 */
@Injectable({ providedIn: 'root' })
export class KitchenAlerts {
  private readonly logger = inject(Logging);

  readonly muted = signal(readMuted());
  /** `true` after the browser refuses to start/resume audio without a gesture. */
  readonly blocked = signal(false);

  private context: AudioContext | null = null;

  setMuted(value: boolean): void {
    this.muted.set(value);
    writeMuted(value);
    if (!value) this.arm();
  }

  toggle(): void {
    this.setMuted(!this.muted());
  }

  /**
   * Creates or resumes the AudioContext. Safe to call from any user gesture and
   * safe to call repeatedly; it never throws into the component.
   */
  arm(): void {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === 'suspended') {
      void context
        .resume()
        .then(() => {
          this.blocked.set(false);
        })
        .catch(() => {
          this.blocked.set(true);
        });
    }
  }

  /**
   * Plays the new-order cue when sound is enabled.
   *
   * Returns the outcome so the caller can distinguish "muted by the user" from
   * "the browser blocked audio"; the UI only reacts to `blocked`.
   */
  notify(): KitchenAlertResult {
    if (this.muted()) return 'muted';
    this.vibrate();

    const context = this.ensureContext();
    if (!context) return 'unsupported';

    if (context.state === 'suspended') {
      this.blocked.set(true);
      void context
        .resume()
        .then(() => {
          this.blocked.set(false);
          this.play(context);
        })
        .catch(() => {
          this.blocked.set(true);
        });
      return 'blocked';
    }

    this.play(context);
    this.blocked.set(false);
    return 'played';
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof window === 'undefined') return null;

    const audioWindow = window as unknown as AudioContextWindow;
    const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextCtor) return null;

    try {
      this.context = new AudioContextCtor();
      return this.context;
    } catch (error) {
      this.logger.warn('KitchenAlerts: AudioContext could not be created', error);
      return null;
    }
  }

  /**
   * Two short tones (~0.36 s). Gain is low enough to be a cue, not a siren.
   * Oscillators are stopped and disconnected, so repeated orders do not leak.
   */
  private play(context: AudioContext): void {
    try {
      const start = context.currentTime;
      const notes = [880, 1174];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const noteStart = start + index * 0.18;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.16, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.16);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + 0.17);
        oscillator.addEventListener('ended', () => {
          oscillator.disconnect();
          gain.disconnect();
        });
      });
    } catch (error) {
      this.logger.warn('KitchenAlerts: cue could not be played', error);
    }
  }

  private vibrate(): void {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
      navigator.vibrate([120, 60, 120]);
    } catch {
      // Haptics are optional; a blocked call must not break the alert path.
    }
  }
}
