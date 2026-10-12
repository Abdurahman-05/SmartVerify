/** Telebirr has no account number: the wallet is the owner's phone number. */
export const TELEBIRR = 'TEL';

/** 10 digits starting 09 or 07, like customer phones in orders. */
export const TELEBIRR_PHONE = /^0[79]\d{8}$/;

/** i18n key for the masked number line: "Phone ••••7788" or "Account ••••4758". */
export const maskedNumberKey = (bankCode: string) =>
  bankCode === TELEBIRR ? 'verify.phoneMasked' : 'verify.accountMasked';
