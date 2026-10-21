import { describe, expect, it } from 'vitest';

import { openSecret, sealSecret } from '../services/secret-box.js';
import { base32Encode, matchTotp, totpCode, totpStep } from '../services/totp.js';

// RFC 6238 appendix B: SHA-1 secret "12345678901234567890" (the last 6 of the 8 digits).
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('authenticator codes', () => {
  it('match the RFC 6238 test values', () => {
    expect(totpCode(RFC_SECRET, totpStep(59_000))).toBe('287082');
    expect(totpCode(RFC_SECRET, totpStep(1_111_111_109_000))).toBe('081804');
    expect(totpCode(RFC_SECRET, totpStep(2_000_000_000_000))).toBe('279037');
  });

  it('accept one step of clock drift, and each code only once', () => {
    const now = 1_111_111_109_000;
    const step = totpStep(now);
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), null, now)).toBe(step - 1);
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step), step, now)).toBeNull();
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), null, now)).toBeNull();
    expect(matchTotp(RFC_SECRET, 'abcdef', null, now)).toBeNull();
  });
});

describe('secret box', () => {
  const key = Buffer.alloc(32, 9).toString('base64');
  it('opens what it sealed, and refuses another key or a changed box', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP', key);
    expect(sealed).not.toContain('JBSWY3DP');
    expect(openSecret(sealed, key)).toBe('JBSWY3DPEHPK3PXP');
    expect(() => openSecret(sealed, Buffer.alloc(32, 1).toString('base64'))).toThrow();
    expect(() => openSecret(`${sealed.slice(0, -2)}AA`, key)).toThrow();
  });
});
