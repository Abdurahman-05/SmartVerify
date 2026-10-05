export const PHONE_DIGITS = 9;

export const digitsOnly = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

/** "912345678" -> "912 345 678" */
export const formatPhone = (digits: string) =>
  [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean).join(' ');

export const formatAmount = (amount: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount);

const MAX_AMOUNT_DIGITS = 9;

/** Cleans typed amount text: digits with at most one dot and two decimals. */
export function sanitizeAmountInput(text: string) {
  const [whole = '', ...rest] = text.replace(/[^\d.]/g, '').split('.');
  const integer = whole.replace(/^0+(?=\d)/, '').slice(0, MAX_AMOUNT_DIGITS);
  if (rest.length === 0) return integer;
  return `${integer || '0'}.${rest.join('').slice(0, 2)}`;
}

/** "1000.5" -> "1,000.5" while typing. */
export function formatAmountInput(raw: string) {
  if (!raw) return '';
  const [integer, decimals] = raw.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimals === undefined ? grouped : `${grouped}.${decimals}`;
}

export const parseAmount = (raw: string) => Number(raw) || 0;

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
