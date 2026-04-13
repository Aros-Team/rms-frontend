import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class FingerprintService {
  private platformId = inject(PLATFORM_ID);
  private readonly FINGERPRINT_KEY = 'rms_device_fp';
  private readonly FINGERPRINT_EXPIRY = 'rms_fp_expiry';

  getDeviceHash(): string {
    if (!isPlatformBrowser(this.platformId)) {
      return 'server-side-placeholder';
    }

    let fingerprint = localStorage.getItem(this.FINGERPRINT_KEY);
    const expiry = localStorage.getItem(this.FINGERPRINT_EXPIRY);

    if (fingerprint && expiry && Date.now() < parseInt(expiry, 10)) {
      return fingerprint;
    }

    fingerprint = this.generateFingerprint();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const newExpiry = Date.now() + thirtyDaysMs;
    
    localStorage.setItem(this.FINGERPRINT_KEY, fingerprint);
    localStorage.setItem(this.FINGERPRINT_EXPIRY, newExpiry.toString());

    return fingerprint;
  }

  private generateFingerprint(): string {
    const components = [
      'rms-v1',
      navigator.userAgent,
      navigator.language,
      screen.width.toString(),
      screen.height.toString(),
      screen.colorDepth.toString(),
      new Date().getTimezoneOffset().toString(),
      navigator.hardwareConcurrency?.toString() || '0',
      navigator.maxTouchPoints?.toString() || '0',
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      Intl.DateTimeFormat().resolvedOptions().locale,
    ];

    return this.secureHash(components.join('|'));
  }

  private secureHash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) + hash) + char;
      hash = hash & hash;
    }

    const reversed = str.split('').reduce((h, char) => {
      return ((h << 5) - h) + char.charCodeAt(0);
    }, 5381);

    hash = (hash ^ reversed) >>> 0;
    return hash.toString(16).padStart(8, '0');
  }
}
