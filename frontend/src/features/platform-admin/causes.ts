import type { TFunction } from 'i18next';

/** A server problem's cause in words: "bank_timeout:DAS" → "Dashen receipt site timed out". */
export function causeText(t: TFunction, cause: string): string {
  const [kind = '', arg = ''] = cause.split(':');
  if (kind === 'bank_timeout' || kind === 'bank_unreachable') {
    return t(`platformAdmin.health.causes.${kind}`, { bank: t(`platformAdmin.banks.${arg}`) });
  }
  if (kind === 'error') return t('platformAdmin.health.causes.error', { name: arg });
  if (kind === 'db_error') return t('platformAdmin.health.causes.db_error', { code: arg });
  return t(`platformAdmin.health.causes.${kind}`, { defaultValue: cause });
}
