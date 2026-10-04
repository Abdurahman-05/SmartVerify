export const PHONE_DIGITS = 9;

export const digitsOnly = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

/** "912345678" -> "912 345 678" */
export const formatPhone = (digits: string) =>
  [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean).join(' ');

export const formatAmount = (amount: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount);
