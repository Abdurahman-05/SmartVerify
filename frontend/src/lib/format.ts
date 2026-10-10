export const PHONE_DIGITS = 9;

export const digitsOnly = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

/** "912345678" -> "912 345 678" */
export const formatPhone = (digits: string) =>
  [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean).join(' ');

export const formatAmount = (amount: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(amount));

const MAX_AMOUNT_DIGITS = 9;

/** Typed amount text to whole birr: digits only, everything else dropped. */
export const parseAmountInput = (text: string) => Number(digitsOnly(text, MAX_AMOUNT_DIGITS)) || 0;

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** "10:42 AM" */
export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

/** "30 Sep 2026" or "30 Sep" */
export const formatDay = (iso: string, withYear = true) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
